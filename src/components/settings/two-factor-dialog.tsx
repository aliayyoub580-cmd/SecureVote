import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Copy, KeyRound, QrCode, Smartphone, X, AlertTriangle, ShieldCheck, Apple, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase/client'
import { useEffect } from 'react'

interface TwoFactorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TwoFactorDialog({ open, onOpenChange, onSuccess }: TwoFactorDialogProps) {
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCodeSvg, setQrCodeSvg] = useState<string>('')
  const [secret, setSecret] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Enrollment phase
  useEffect(() => {
    let active = true
    if (open) {
      setCode('')
      setError('')
      setQrCodeSvg('')
      setSecret('')
      const initMfa = async () => {
        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        
        if (factorsData && factorsData.all.length > 0) {
          const unverified = factorsData.all.filter(f => f.status === 'unverified')
          for (const f of unverified) {
             await supabase.auth.mfa.unenroll({ factorId: f.id })
          }
        }
        
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp'
        })
        if (enrollError) {
          if (active) setError(enrollError.message)
          return
        }
        if (active && data) {
          setFactorId(data.id)
          setQrCodeSvg(data.totp.qr_code)
          setSecret(data.totp.secret)
        }
      }
      void initMfa()
    }
    return () => { active = false }
  }, [open])

  const handleCopy = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Secret key copied to clipboard')
  }

  const handleVerify = async () => {
    if (code.length !== 6 || !factorId) {
      toast.error('Please enter a valid 6-digit code')
      return
    }
    setLoading(true)
    setError('')
    
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) throw challenge.error
      
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code
      })
      if (verify.error) throw verify.error
      
      toast.success('Two-Factor Authentication enabled successfully!')
      onSuccess?.()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to verify code')
      toast.error('Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] p-0 bg-[var(--card)] border-[var(--border)] overflow-hidden gap-0 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="bg-[var(--primary)]/10 p-5 sm:px-6 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/20 to-transparent pointer-events-none opacity-50" />
           <div className="flex items-center gap-4 relative z-10">
              <div className="size-12 rounded-xl bg-[var(--primary)]/20 flex items-center justify-center shrink-0 border border-[var(--primary)]/30">
                 <ShieldCheck className="size-6 text-[var(--primary)]" />
              </div>
              <div>
                 <DialogTitle className="text-lg sm:text-xl font-bold text-[var(--foreground)] tracking-tight">Enable Two-Factor Authentication</DialogTitle>
                 <DialogDescription className="text-[var(--muted-foreground)] font-medium mt-0.5 text-sm">
                   Secure your account with authenticator app verification.
                 </DialogDescription>
              </div>
           </div>
        </div>

        <div className="grid md:grid-cols-2 p-5 sm:p-6 gap-6">
          {/* Left Column: Setup */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <QrCode className="size-5 text-[var(--primary)]" />
              <h3 className="font-bold text-[var(--foreground)] text-sm">Authenticator Setup</h3>
            </div>
            
            <div className="aspect-square w-full max-w-[200px] mx-auto rounded-xl border border-dashed border-[var(--border)] bg-white p-3 flex items-center justify-center overflow-hidden">
               {error ? (
                 <div className="flex flex-col items-center text-center p-2">
                   <AlertTriangle className="size-8 text-rose-500 mb-2" />
                   <p className="text-xs font-bold text-rose-600">Failed to load setup</p>
                   <p className="text-[10px] text-rose-500/80 mt-1">{error}</p>
                 </div>
               ) : qrCodeSvg ? (
                 <img src={qrCodeSvg} alt="QR Code" className="size-full object-contain mix-blend-multiply" />
               ) : (
                 <div className="flex flex-col items-center">
                   <div className="size-8 rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin mb-3" />
                   <p className="text-xs font-bold text-[var(--muted-foreground)]">Generating QR...</p>
                 </div>
               )}
            </div>

            <div className="space-y-2">
               <p className="text-[11px] font-bold text-[var(--muted-foreground)]">Can't scan? Use the manual secret key:</p>
               <div className="flex items-center gap-2">
                 <div className="h-12 flex-1 rounded-xl bg-[var(--muted)]/50 border border-[var(--border)] flex items-center justify-center font-mono text-sm tracking-widest font-bold text-[var(--foreground)] break-all px-2 text-center">
                   {secret || 'Loading...'}
                 </div>
                 <Button variant="outline" size="icon" className="size-12 rounded-xl shrink-0 border-[var(--border)] bg-[var(--background)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors" onClick={handleCopy} disabled={!secret}>
                   {copied ? <Check className="size-5 text-emerald-500" /> : <Copy className="size-5" />}
                 </Button>
               </div>
            </div>
          </div>

          {/* Right Column: Verify */}
          <div className="space-y-6 md:border-l border-[var(--border)] md:pl-6">
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-[var(--primary)]" />
              <h3 className="font-bold text-[var(--foreground)] text-sm">Verify and Activate</h3>
            </div>
            
            <p className="text-xs text-[var(--muted-foreground)] font-medium leading-relaxed">
              Enter the current 6-digit code from your authenticator app.
            </p>

            <div className="py-4">
              <div className="flex justify-between max-w-[280px] mx-auto gap-2">
                 {/* Visual 6-box input mockup using standard input */}
                 <Input 
                   type="text" 
                   maxLength={6} 
                   value={code} 
                   onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                   className="h-16 text-center text-3xl font-bold tracking-[1em] rounded-xl border-2 border-[var(--primary)]/20 focus-visible:border-[var(--primary)] focus-visible:ring-0 bg-[var(--background)] shadow-sm pl-[1.2em]" 
                   placeholder="------"
                 />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button 
                onClick={handleVerify} 
                disabled={loading || code.length !== 6}
                className="w-full h-11 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-bold text-sm shadow-lg shadow-[var(--primary)]/20 gap-2 transition-all"
              >
                {loading ? <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Check className="size-4" />}
                Verify & Enable 2FA
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full h-11 rounded-xl border-[var(--border)] bg-transparent hover:bg-[var(--muted)] font-bold text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Cancel
              </Button>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
               <div className="flex items-center gap-2 mb-1.5">
                 <AlertTriangle className="size-4 text-amber-600 dark:text-amber-500" />
                 <h4 className="font-bold text-amber-800 dark:text-amber-400 text-[11px] uppercase tracking-widest">Important</h4>
               </div>
               <p className="text-[10px] text-amber-700/80 dark:text-amber-500/80 leading-relaxed font-medium">
                 Save your secret key as a backup for account recovery.<br/>
                 Never share your secret key or QR code with anyone.
               </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
