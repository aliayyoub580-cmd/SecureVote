import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { User, ShieldCheck, Mail, Phone, Building, Lock, ArrowRight, Check, Globe, AlertCircle, Eye, EyeOff } from 'lucide-react'

import { AuthSplitLayout } from '@/components/auth/auth-split-layout'
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter'
import { TurnstileField } from '@/components/security/turnstile-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { assertClientAuthRateLimit, resetClientAuthRateLimit } from '@/lib/client-rate-limit'
import { getPublicEnv } from '@/lib/env'
import { registerSchema } from '@/lib/schemas'
import { auditService } from '@/services/audit.service'
import { authService } from '@/services/auth.service'
import { cn } from '@/lib/utils'

type Form = z.infer<typeof registerSchema>

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
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "circOut" } }
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { turnstileSiteKey } = getPublicEnv()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [alreadyRegisteredEmail, setAlreadyRegisteredEmail] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form = useForm<Form>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      organization: '',
      accountType: 'voter',
      password: '',
      confirm: '',
    },
  })

  const pwd = form.watch('password')

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      assertClientAuthRateLimit('register')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Too many attempts')
      return
    }
    if (turnstileSiteKey && !turnstileToken) {
      toast.error('Security verification required. Please complete the challenge.')
      return
    }
    const { data, error } = await authService.signUp({
      email: values.email,
      password: values.password,
      fullName: values.fullName,
      phone: values.phone?.trim() || undefined,
      organization: values.organization?.trim() || undefined,
      accountType: values.accountType,
    })
    if (error) {
      const msg = error.message ?? ''
      if (
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('forgot password')
      ) {
        setAlreadyRegisteredEmail(values.email)
      } else {
        toast.error(msg || 'Registration failed. Please try again.')
      }
      return
    }
    setAlreadyRegisteredEmail(null)
    resetClientAuthRateLimit('register')
    void auditService.log(
      'auth.signup_verify_pending',
      'session',
      null,
      { email_domain: values.email.split('@')[1] ?? 'unknown', captcha: Boolean(turnstileSiteKey) },
      { enrichClient: true },
    )
    toast.success('Verification code sent!', {
      description: 'Please check your inbox for the 6-digit code.',
    })
    void navigate(ROUTES.verifyEmail, { replace: true, state: { email: values.email } })
  })

  return (
    <AuthSplitLayout
      title="Create Your Account"
      subtitle="Join SecureVote and participate in secure online elections."
      footer={
        <p className="text-[var(--muted-foreground)] font-bold uppercase tracking-widest text-[10px]">
          Already have an account?{' '}
          <Link className="text-primary hover:text-primary/80 transition-all border-b border-primary/20 pb-0.5 ml-2" to={ROUTES.login}>
            Sign In
          </Link>
        </p>
      }
    >
      <motion.form 
        variants={container}
        initial="hidden"
        animate="show"
        onSubmit={onSubmit} 
        className="space-y-6" 
        noValidate
      >
        {/* Already Registered Banner */}
        <AnimatePresence>
          {alreadyRegisteredEmail && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="size-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">Email Already Registered</span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                <span className="text-[var(--foreground)] font-semibold">{alreadyRegisteredEmail}</span> is already linked to an account.
              </p>
              <div className="flex gap-3 pt-1">
                <Link
                  to={ROUTES.login}
                  className="flex-1 text-center text-xs font-bold py-2 px-3 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to={ROUTES.forgotPassword}
                  className="flex-1 text-center text-xs font-bold py-2 px-3 rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:bg-[var(--border)] transition-all"
                >
                  Forgot Password?
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-5">
          {/* Identity Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div variants={item} className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Full Name</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                  <User className="size-3.5" />
                </div>
                <Input 
                  {...form.register('fullName')} 
                  placeholder="John Doe"
                  className="h-11 bg-card/40 border-[var(--border)] pl-11 rounded-xl focus-visible:ring-primary/20 focus-visible:bg-card/60 transition-all duration-500 font-semibold tracking-tight shadow-inner" 
                />
              </div>
              {form.formState.errors.fullName && (
                <p className="text-[10px] font-black text-red-500/80 ml-2 uppercase tracking-widest">{form.formState.errors.fullName.message}</p>
              )}
            </motion.div>
            <motion.div variants={item} className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Email Address</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                  <Mail className="size-3.5" />
                </div>
                <Input 
                  {...form.register('email')} 
                  type="email"
                  placeholder="you@example.com"
                  className="h-11 bg-card/40 border-[var(--border)] pl-11 rounded-xl focus-visible:ring-primary/20 focus-visible:bg-card/60 transition-all duration-500 font-semibold tracking-tight shadow-inner" 
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-[10px] font-black text-red-500/80 ml-2 uppercase tracking-widest">{form.formState.errors.email.message}</p>
              )}
            </motion.div>
          </div>

          {/* Org Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div variants={item} className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Phone Number</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                  <Phone className="size-3.5" />
                </div>
                <Input 
                  {...form.register('phone')} 
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className="h-11 bg-card/40 border-[var(--border)] pl-11 rounded-xl focus-visible:ring-primary/20 focus-visible:bg-card/60 transition-all duration-500 font-semibold tracking-tight shadow-inner" 
                />
              </div>
            </motion.div>
            <motion.div variants={item} className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Organization</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                  <Building className="size-3.5" />
                </div>
                <Input 
                  {...form.register('organization')} 
                  placeholder="Your Company or School"
                  className="h-11 bg-card/40 border-[var(--border)] pl-11 rounded-xl focus-visible:ring-primary/20 focus-visible:bg-card/60 transition-all duration-500 font-semibold tracking-tight shadow-inner" 
                />
              </div>
            </motion.div>
          </div>

          {/* Account Type Selection */}
          <Controller
            control={form.control}
            name="accountType"
            render={({ field }) => (
              <motion.div variants={item} className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Role</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { id: 'voter', icon: Globe, title: 'Voter', desc: 'Participate and cast your vote.' },
                    { id: 'request_creator', icon: ShieldCheck, title: 'Election Creator', desc: 'Create and manage elections.' },
                  ].map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => field.onChange(role.id)}
                      className={cn(
                        "group relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 text-left overflow-hidden",
                        field.value === role.id 
                          ? "border-primary/40 bg-primary/5 shadow-primary/10" 
                           : "border-[var(--border)] bg-[var(--card)] hover:border-primary/20 hover:bg-[var(--muted)]"
                      )}
                    >
                      <div className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300",
                        field.value === role.id 
                           ? "bg-primary text-primary-foreground border-primary/20 scale-105 shadow-primary/20" 
                           : "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"
                      )}>
                        <role.icon className="size-5" />
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <span className={cn("text-sm font-bold tracking-tight transition-colors block", field.value === role.id ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>
                          {role.title}
                        </span>
                        <p className="text-[10px] font-medium text-[var(--muted-foreground)] leading-tight transition-colors">
                          {role.desc}
                        </p>
                      </div>
                      <AnimatePresence>
                        {field.value === role.id && (
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute right-3 size-5 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-[var(--background)]"
                          >
                            <Check className="size-3 text-primary-foreground stroke-[3]" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          />

          {/* Security Config */}
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div variants={item} className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Password</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                  <Lock className="size-3.5" />
                </div>
                <Input 
                  {...form.register('password')} 
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="h-11 bg-[var(--muted)] border-[var(--border)] pl-11 pr-11 rounded-xl focus-visible:ring-primary/20 focus-visible:bg-[var(--card)] transition-all duration-500 font-semibold tracking-tight shadow-inner" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus:outline-none z-10"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-[10px] font-black text-red-500/80 ml-2 uppercase tracking-widest leading-tight">{form.formState.errors.password.message}</p>
              )}
              <div className="pt-1">
                <PasswordStrengthMeter password={pwd} />
              </div>
            </motion.div>
            <motion.div variants={item} className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] ml-1">Confirm Password</Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                  <Lock className="size-3.5" />
                </div>
                <Input 
                  {...form.register('confirm')} 
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat your password"
                  className="h-11 bg-[var(--muted)] border-[var(--border)] pl-11 pr-11 rounded-xl focus-visible:ring-primary/20 focus-visible:bg-[var(--card)] transition-all duration-500 font-semibold tracking-tight shadow-inner" 
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus:outline-none z-10"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {form.formState.errors.confirm && (
                <p className="text-[10px] font-black text-red-500/80 ml-2 uppercase tracking-widest leading-tight">{form.formState.errors.confirm.message}</p>
              )}
            </motion.div>
          </div>
        </div>

        {/* Verification */}
        {turnstileSiteKey && (
          <motion.div variants={item} className="flex justify-center py-1">
            <div className="scale-90 origin-center">
              <TurnstileField
                siteKey={turnstileSiteKey}
                onToken={(t) => setTurnstileToken(t)}
                onExpire={() => setTurnstileToken(null)}
              />
            </div>
          </motion.div>
        )}

        {/* Submit */}
        <motion.div variants={item}>
          <Button 
            type="submit" 
            className="w-full h-14 rounded-2xl premium-gradient text-lg font-bold shadow-lg hover:scale-[1.01] active:scale-95 transition-all group overflow-hidden relative" 
            disabled={form.formState.isSubmitting}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
            
            {form.formState.isSubmitting ? (
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" as any }}
                  className="size-5 border-2 border-[var(--foreground)]/20 border-t-[var(--foreground)] rounded-full"
                />
                <span className="uppercase tracking-widest text-xs">Creating Account...</span>
              </div>
            ) : (
              <span className="flex items-center gap-3 uppercase tracking-wider text-sm">
                Create Account <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </Button>
        </motion.div>
      </motion.form>
    </AuthSplitLayout>
  )
}



