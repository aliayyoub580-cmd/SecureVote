import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { motion } from 'framer-motion'
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react'

import { AuthSplitLayout } from '@/components/auth/auth-split-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { forgotPasswordSchema } from '@/lib/schemas'
import { authService } from '@/services/auth.service'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

type Form = z.infer<typeof forgotPasswordSchema>

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const form = useForm<Form>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await authService.requestPasswordReset(values.email)
    if (error) {
      console.error('Full Reset Error:', error)
      const msg = error.message || JSON.stringify(error) || 'An unknown error occurred'
      toast.error(msg)
      return
    }
    toast.success('OTP Code sent', {
      description: 'Please check the notification on your screen for the code.'
    })
    
    // Navigate to OTP entry page
    navigate(ROUTES.resetPassword, { state: { email: values.email } })
  })

  return (
    <AuthSplitLayout
      title="Forgot Password"
      subtitle="Enter your email address and we'll send you a link to reset your password."
      footer={
        <p className="text-[var(--muted-foreground)] font-medium">
          Remembered your password?{' '}
          <Link className="font-black text-primary hover:text-primary/80 transition-all" to={ROUTES.login}>
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
        className="space-y-8 mt-6" 
        noValidate
      >
        <motion.div variants={item} className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)] ml-1">Email Address</Label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-primary">
              <Mail className="size-4" />
            </div>
            <Input 
              {...form.register('email')} 
              type="email"
              placeholder="you@example.com"
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

        <motion.div variants={item}>
          <Button 
            type="submit" 
            className="w-full h-16 rounded-[2rem] premium-gradient text-xl font-black shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all group overflow-hidden relative" 
            disabled={form.formState.isSubmitting}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
            
            {form.formState.isSubmitting ? (
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="size-6 border-4 border-[var(--foreground)]/20 border-t-[var(--foreground)] rounded-full"
                />
                <span className="uppercase tracking-[0.2em] text-sm">Sending...</span>
              </div>
            ) : (
              <span className="flex items-center gap-3">
                Send Verification Code <ArrowRight className="size-6 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </Button>
        </motion.div>

        {/* Security Badge */}
        <motion.div variants={item} className="flex items-center justify-center gap-2 pt-4 opacity-50">
          <ShieldCheck className="size-4 text-[var(--muted-foreground)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Secure Password Recovery</span>
        </motion.div>
      </motion.form>
    </AuthSplitLayout>
  )
}
