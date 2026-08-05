import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'

import { AuthSplitLayout } from '@/components/auth/auth-split-layout'
import { TurnstileField } from '@/components/security/turnstile-field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { assertClientAuthRateLimit, resetClientAuthRateLimit } from '@/lib/client-rate-limit'
import { getPublicEnv } from '@/lib/env'
import { loginSchema } from '@/lib/schemas'
import { supabase } from '@/lib/supabase/client'
import { auditService } from '@/services/audit.service'
import { authService } from '@/services/auth.service'
import { emailService } from '@/services/email.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

type Form = z.infer<typeof loginSchema>

const container: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item: any = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
}

export function LoginPage() {
  const { turnstileSiteKey } = getPublicEnv()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // MFA State
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [sessionData, setSessionData] = useState<any>(null)

  const form = useForm<Form>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  const handleQuickFillAdmin = () => {
    form.setValue('email', 'admin@gmail.com')
    form.setValue('password', 'admin123')
    toast.success('Admin credentials filled!')
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      assertClientAuthRateLimit('login')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Too many attempts')
      return
    }
    if (turnstileSiteKey && !turnstileToken) {
      toast.error('Please complete the verification challenge.')
      return
    }
    const { data: signInData, error } = await authService.signIn(values.email, values.password, Boolean(values.rememberMe))
    if (error) {
      toast.error(error.message)
      return
    }
    const mfaStatus = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (mfaStatus.data?.nextLevel === 'aal2') {
      void emailService.sendSuspiciousLoginEmail(values.email)
      setSessionData(signInData)
      setMfaRequired(true)
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const totp = factorsData?.all.find(f => f.factor_type === 'totp' && f.status === 'verified')
      if (totp) setMfaFactorId(totp.id)
      return
    }

    await proceedToDashboard(signInData)
  })

  const proceedToDashboard = async (signInData: any) => {
    resetClientAuthRateLimit('login')
    void auditService.log(
      'auth.login',
      'session',
      null,
      { method: 'password', captcha: Boolean(turnstileSiteKey) },
      { enrichClient: true },
    )
    toast.success('Access granted. Redirecting...')

    let destination = ROUTES.dashboard
    try {
      const userId = signInData?.user?.id
      if (userId) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
        if (profile?.role === 'super_admin') {
          destination = ROUTES.admin
        } else if (profile?.role === 'election_creator') {
          destination = ROUTES.creatorDashboard
        } else {
          destination = ROUTES.dashboard
        }
      }
    } catch {
      // fallback
    }
    window.location.replace(destination)
  }

  const handleMfaSubmit = async () => {
    if (!mfaFactorId || mfaCode.length !== 6) return
    setMfaLoading(true)
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challenge.error) throw challenge.error
      const verify = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code: mfaCode
      })
      if (verify.error) throw verify.error

      setMfaRequired(false)
      await proceedToDashboard(sessionData)
    } catch (err: any) {
      toast.error('Invalid 2FA code. Please try again.')
    } finally {
      setMfaLoading(false)
    }
  }

  return (
    <AuthSplitLayout
      title="Welcome Back"
      subtitle="Sign in to manage your elections and voting activity."
      footer={
        <p className="text-[var(--muted-foreground)] font-medium">
          Don't have an account?{' '}
          <Link className="font-black text-primary hover:text-primary/80 transition-all" to={ROUTES.register}>
            Create Account
          </Link>
        </p>
      }
    >
      <motion.form
        variants={container}
        initial="hidden"
        animate="show"
        onSubmit={onSubmit}
        className="space-y-8"
        noValidate
      >
        <div className="space-y-6">
          {/* Quick Admin Credentials */}
          <motion.div
            variants={item}
            className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-primary/20 text-primary shrink-0">
                <ShieldCheck className="size-4" />
              </div>
              <div className="truncate">
                <p className="font-bold text-[var(--foreground)] truncate">Admin Credentials</p>
                <p className="text-[11px] text-[var(--muted-foreground)] truncate">admin@gmail.com • admin123</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuickFillAdmin}
              className="h-8 rounded-xl font-bold text-xs shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-white transition-all shadow-none"
            >
              Fill Credentials
            </Button>
          </motion.div>

          {/* Email Field */}
          <motion.div variants={item} className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)] ml-1">Email Address</Label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                <Mail className="size-4" />
              </div>
              <Input
                {...form.register('email')}
                type="email"
                placeholder="you@organization.com"
                className="h-14 bg-[var(--muted)] border-[var(--border)] pl-12 rounded-2xl focus-visible:ring-primary/40 focus-visible:bg-[var(--card)] transition-all duration-300 font-medium"
              />
              <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity -z-10 blur-xl" />
            </div>
            {form.formState.errors.email && (
              <motion.p initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] font-black text-red-500 ml-2 uppercase tracking-widest">
                {form.formState.errors.email.message}
              </motion.p>
            )}
          </motion.div>

          {/* Password Field */}
          <motion.div variants={item} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Password</Label>
              <Link to={ROUTES.forgotPassword} className="text-[10px] font-black text-primary hover:text-primary/80 uppercase tracking-widest">
                Forgot Password?
              </Link>
            </div>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                <Lock className="size-4" />
              </div>
              <Input
                {...form.register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                className="h-14 bg-[var(--muted)] border-[var(--border)] pl-12 pr-12 rounded-2xl focus-visible:ring-primary/40 focus-visible:bg-[var(--card)] transition-all duration-300 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus:outline-none z-10"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity -z-10 blur-xl" />
            </div>
            {form.formState.errors.password && (
              <motion.p initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] font-black text-red-500 ml-2 uppercase tracking-widest">
                {form.formState.errors.password.message}
              </motion.p>
            )}
          </motion.div>
        </div>

        {/* Remember Me */}
        <motion.div variants={item} className="flex items-center space-x-3 ml-1">
          <Controller
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="remember"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="size-5 rounded-lg border-[var(--border)] data-[state=checked]:bg-primary shadow-2xl transition-all"
                />
                <label htmlFor="remember" className="text-sm font-bold text-[var(--muted-foreground)] cursor-pointer select-none hover:text-[var(--foreground)] transition-colors">
                  Remember me
                </label>
              </div>
            )}
          />
        </motion.div>

        {/* Captcha */}
        {turnstileSiteKey && (
          <motion.div variants={item} className="flex justify-center py-2">
            <TurnstileField
              siteKey={turnstileSiteKey}
              onToken={(t) => setTurnstileToken(t)}
              onExpire={() => setTurnstileToken(null)}
            />
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.div variants={item}>
          <Button
            type="submit"
            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-sm uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-primary/20"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                Sign In <ArrowRight className="size-5" />
              </span>
            )}
          </Button>
        </motion.div>
      </motion.form>

      {/* MFA Challenge Dialog */}
      <Dialog open={mfaRequired} onOpenChange={(open) => !open && setMfaRequired(false)}>
        <DialogContent className="sm:max-w-[420px] bg-[var(--card)] border-[var(--border)] rounded-[2rem] p-8 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black text-[var(--foreground)] tracking-tight">Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-sm font-medium text-[var(--muted-foreground)]">
              A security alert has been sent to your email. Please enter the 6-digit code from your authenticator app to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Input
              value={mfaCode}
              onChange={e => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={6}
              className="h-16 text-center text-3xl font-bold tracking-[1em] rounded-xl border-2 border-[var(--primary)]/20 focus-visible:border-[var(--primary)] bg-[var(--background)] pl-[1.2em]"
              placeholder="------"
            />
            <Button
              onClick={handleMfaSubmit}
              disabled={mfaCode.length !== 6 || mfaLoading}
              className="w-full h-12 rounded-xl bg-[var(--primary)] font-bold text-sm text-white"
            >
              {mfaLoading ? <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : 'Verify Code'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AuthSplitLayout>
  )
}
