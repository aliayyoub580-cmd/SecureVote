import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'

import { Eye, EyeOff, Copy, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { maskVoterPublicId } from '@/lib/voter-public-id'
import { voterPublicIdGenerator } from '@/services/voter-public-id-generator'
import { voterSecretIdService } from '@/services/voter-secret-id.service'

type VoterSecretIdCardProps = {
  electionId: string
  electionTitle: string
  /** When just registered, parent can pass the fresh id before RPC round-trip. */
  initialPublicId?: string | null
  onChanged?: () => void
}

export function VoterSecretIdCard({ electionId, electionTitle, initialPublicId, onChanged }: VoterSecretIdCardProps) {
  const [publicId, setPublicId] = useState<string | null>(initialPublicId ?? null)
  const [reveal, setReveal] = useState(false)
  const [loading, setLoading] = useState(!initialPublicId)
  const [regenOpen, setRegenOpen] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [newlyRegeneratedSecret, setNewlyRegeneratedSecret] = useState<string | null>(null)
  const [showNewSecretDialog, setShowNewSecretDialog] = useState(false)

  useEffect(() => {
    if (initialPublicId) {
      setPublicId(initialPublicId)
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const s = await voterSecretIdService.getMine(electionId)
        if (!cancelled) setPublicId(s.publicId)
      } catch {
        if (!cancelled) setPublicId(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [electionId, initialPublicId])

  const sendEmail = async () => {
    setEmailBusy(true)
    try {
      const r = await voterSecretIdService.requestEmailDelivery(electionId)
      if (r.skipped) {
        toast.message('Email not configured', { description: r.message ?? 'Add Resend secrets to the Edge Function.' })
      } else if (r.ok) {
        toast.success('If configured, your voter ID was emailed to your account address.')
      } else {
        toast.error('Could not queue email')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Email request failed')
    } finally {
      setEmailBusy(false)
    }
  }

  const doRegenerate = async () => {
    try {
      const { secretToken, publicId: next } = await voterSecretIdService.regenerateFullToken(electionId)
      setPublicId(next)
      setNewlyRegeneratedSecret(secretToken)
      setRegenOpen(false)
      setShowNewSecretDialog(true)
      toast.success('New Voting Code issued!')
      onChanged?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Regeneration failed')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Secret voter ID</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!publicId) {
    return (
      <Card className="rounded-[2rem] border-muted bg-muted/20">
        <CardHeader className="p-8">
          <CardTitle className="text-xl font-bold">Voting Credentials</CardTitle>
          <CardDescription className="text-sm font-medium">No verification ID is linked to your registration yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card className="rounded-[2.5rem] border-border bg-card shadow-sm overflow-hidden group">
        <CardHeader className="p-8 lg:p-10 pb-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black text-foreground tracking-tight">Voting Credentials</CardTitle>
              <CardDescription className="text-sm font-medium mt-1">
                Your secure identification for this election.
              </CardDescription>
            </div>
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              <ShieldCheck className="size-6 text-primary" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 lg:p-10 space-y-8">
          {/* Verification ID Display */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Verification ID</label>
              <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">Publicly Visible</span>
            </div>
            <div className="relative group/id">
              <div className="rounded-2xl border border-border/60 bg-muted/50 px-6 py-4 font-mono text-lg tracking-widest font-black text-foreground shadow-inner transition-all group-hover/id:bg-muted">
                {reveal ? publicId : maskVoterPublicId(publicId)}
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" className="h-10 rounded-xl hover:bg-background" onClick={() => setReveal((r) => !r)}>
                  {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-10 rounded-xl hover:bg-background"
                  onClick={async () => {
                    if (publicId) await navigator.clipboard.writeText(publicId)
                    toast.success('Verification ID copied')
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Lost Code Recovery Section */}
          <div className="p-6 rounded-[1.5rem] bg-rose-500/5 border border-rose-500/20 space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-rose-500" />
              <h4 className="text-sm font-black text-rose-600 uppercase tracking-widest">Lost your Voting Code?</h4>
            </div>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
              If you have lost your private **Voting Code** (the lamba hash code), you can issue a new one. 
              <span className="text-rose-600/80 font-bold block mt-1">Warning: Your previous code will be permanently deactivated.</span>
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" size="sm" variant="destructive" className="h-10 rounded-xl font-bold uppercase tracking-widest text-[9px] px-6 shadow-lg shadow-rose-500/20" onClick={() => setRegenOpen(true)}>
                Regenerate Code
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-10 rounded-xl border-border bg-background font-bold uppercase tracking-widest text-[9px] px-6" disabled={emailBusy} onClick={() => void sendEmail()}>
                {emailBusy ? 'Sending…' : 'Email Current ID'}
              </Button>
            </div>
          </div>

          <p className="text-[10px] font-medium text-muted-foreground italic border-l-2 border-border pl-3">
            Your Verification ID follows the pattern: <span className="font-bold text-foreground">{voterPublicIdGenerator.example}</span>. 
            It is used for support and public list verification.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent className="rounded-[2rem] border-border bg-card shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-foreground tracking-tight">Regenerate Voting Code?</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium leading-relaxed">
              Your current ID <span className="font-mono font-bold text-rose-500">{maskVoterPublicId(publicId)}</span> and associated **Voting Code** will stop working immediately. 
              You will receive a brand new set of credentials for “{electionTitle}”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="rounded-xl border-border bg-muted/50 font-bold uppercase tracking-widest text-[9px] h-12 flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-rose-500 hover:bg-rose-600 font-bold uppercase tracking-widest text-[9px] h-12 flex-1 shadow-lg shadow-rose-500/20" onClick={() => void doRegenerate()}>
              Issue New Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Secret Token Display Dialog */}
      <Dialog open={showNewSecretDialog} onOpenChange={setShowNewSecretDialog}>
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] border-border bg-card p-10 shadow-2xl">
          <DialogHeader className="mb-8">
            <div className="size-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 shadow-sm">
              <Sparkles className="size-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-3xl font-black text-foreground tracking-tighter leading-none text-left">New Voting Code</DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium leading-relaxed mt-4 text-lg text-left">
              Registration updated! Here is your new **Voting Code**. Save it carefully; it will be masked for security once you close this window.
            </DialogDescription>
          </DialogHeader>
          <div className="mb-8">
            <div className="relative rounded-2xl border border-emerald-500/20 bg-muted p-8 font-mono text-xl break-all text-emerald-600 text-center shadow-inner tracking-[0.3em] leading-relaxed font-black">
              {newlyRegeneratedSecret}
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-border bg-background hover:bg-muted h-14 px-8 font-bold uppercase tracking-widest text-[10px] flex-1"
              onClick={async () => {
                if (newlyRegeneratedSecret) await navigator.clipboard.writeText(newlyRegeneratedSecret)
                toast.success('New Voting Code copied')
              }}
            >
              <Copy className="size-4 mr-2" /> Copy Code
            </Button>
            <Button 
              type="button" 
              onClick={() => setShowNewSecretDialog(false)}
              className="rounded-xl premium-gradient h-14 px-8 font-bold uppercase tracking-widest text-[10px] flex-1 shadow-lg"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
