import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, ArrowRight, CheckCircle2, ShieldCheck, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { authService } from '@/services/auth.service'
import { supabase } from '@/lib/supabase/client'
import { AuthSplitLayout } from '@/components/auth/auth-split-layout'
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter'

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
})

type Form = z.infer<typeof resetSchema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const [step, setStep] = useState<'otp' | 'password' | 'success'>('otp')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Guard: must arrive here from forgot-password with email in state
  if (!email && step === 'otp') {
    navigate(ROUTES.forgotPassword, { replace: true })
    return null
  }

  const form = useForm<Form>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const pwd = form.watch('password')

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleVerifyOTP = async () => {
    const code = otp.join('')
    if (code.length < 6) {
      toast.error('Enter the full 6-digit code')
      return
    }
    // We proceed to password step; the actual verification happens on password submit
    // to keep the flow seamless and secure.
    setStep('password')
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const code = otp.join('')
      
      // Perform Secure Atomic Password Reset (bypassing SMTP sessions)
      const { data: resetData, error: resetError } = await supabase.rpc('reset_password_with_token', {
        p_email: email,
        p_token: code,
        p_new_password: values.password
      })

      if (resetError) {
        throw new Error(resetError.message || 'Failed to update password. Please check your code.')
      }
      if (!resetData?.ok) {
        throw new Error(resetData?.error || 'Invalid or expired verification code.')
      }
      
      setStep('success')
      toast.success('Password updated successfully!')
      setTimeout(() => navigate(ROUTES.login), 2500)
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password. Please try again.')
      setStep('otp') // Go back to OTP if it failed
    }
  })

  return (
    <AuthSplitLayout
      title={step === 'otp' ? "Verify Identity" : step === 'password' ? "New Password" : "Success!"}
      subtitle={step === 'otp' ? "Enter the 6-digit code sent to your email." : step === 'password' ? "Set a new secure password." : "Your password has been reset."}
    >
      <div className="mt-8">
        <AnimatePresence mode="wait">
          {step === 'otp' && (
            <motion.div key="otp" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
               <div className="flex justify-between gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    className="size-11 sm:size-12 text-center text-xl font-bold bg-[var(--card)] border border-[var(--border)] rounded-xl focus:border-primary outline-none transition-all text-[var(--foreground)]"
                  />
                ))}
              </div>
              <Button onClick={handleVerifyOTP} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black">
                Continue to Password Reset
              </Button>
            </motion.div>
          )}

          {step === 'password' && (
            <motion.form key="password" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)] ml-1">New Password</Label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                      <Lock className="size-4" />
                    </div>
                    <Input {...form.register('password')} type={showPassword ? "text" : "password"} placeholder="••••••••" className="h-14 bg-[var(--muted)] border-[var(--border)] pl-12 pr-12 rounded-2xl font-medium" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus:outline-none z-10"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <PasswordStrengthMeter password={pwd} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)] ml-1">Confirm Password</Label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
                      <Lock className="size-4" />
                    </div>
                    <Input {...form.register('confirm')} type={showConfirm ? "text" : "password"} placeholder="••••••••" className="h-14 bg-[var(--muted)] border-[var(--border)] pl-12 pr-12 rounded-2xl font-medium" />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus:outline-none z-10"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full h-16 rounded-[2rem] premium-gradient text-xl font-black">
                {form.formState.isSubmitting ? <Loader2 className="size-6 animate-spin" /> : "Update Password"}
              </Button>
            </motion.form>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center py-10 space-y-6 text-center">
              <div className="size-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="size-12 text-emerald-500" />
              </div>
              <p className="text-[var(--muted-foreground)] font-medium">Redirecting to login...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthSplitLayout>
  )
}
