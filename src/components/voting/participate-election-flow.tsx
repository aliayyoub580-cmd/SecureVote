import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ClipboardList, Loader2, Shield } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/lib/toast'

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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RegistrationProgressIndicator } from '@/components/voting/registration-progress-indicator'
import { useElectionRegistrationRealtime } from '@/hooks/use-election-registration-realtime'
import { getDisplayPhase } from '@/lib/election-utils'
import { voterTermsSchema } from '@/lib/schemas/voter-registration'
import {
  evaluateRegistrationEligibility,
  isRegistrationCapReached,
  mapRegistrationRpcError,
} from '@/lib/voter-registration-utils'
import { voterRegistrationService, type VoterRegisterResult } from '@/services/voter-registration.service'
import type { Database } from '@/types/database'
import { cn } from '@/lib/utils'

type Election = Database['public']['Tables']['elections']['Row']

type ParticipateElectionFlowProps = {
  election: Election
  registrationStatus: { hasBallot: boolean; waitlistPosition: number | null }
  onComplete: (result: VoterRegisterResult) => void
  onRefresh: () => Promise<void>
}

export function ParticipateElectionFlow({
  election,
  registrationStatus,
  onComplete,
  onRefresh,
}: ParticipateElectionFlowProps) {
  const phase = getDisplayPhase(election)
  const phaseEndedOrClosed = phase === 'ended' || phase === 'closed'
  const eligibility = evaluateRegistrationEligibility(election, {
    hasBallot: registrationStatus.hasBallot,
    waitlistPosition: registrationStatus.waitlistPosition,
    phaseEndedOrClosed,
  })

  const { registrantCount: rtReg, waitlistCount: rtWl } = useElectionRegistrationRealtime(election.id)
  const registrantCount = rtReg ?? election.registrant_count ?? 0
  const waitlistCount = rtWl ?? election.waitlist_count ?? 0
  const capReached = isRegistrationCapReached(election, registrantCount)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)

  const tryOpenConfirm = () => {
    const parsed = voterTermsSchema.safeParse({ acceptTerms })
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors.acceptTerms?.[0] ?? 'Accept the terms to continue.'
      setTermsError(msg)
      return
    }
    setTermsError(null)
    setLocalError(null)
    setConfirmOpen(true)
  }

  const submit = async () => {
    setSubmitting(true)
    setLocalError(null)
    try {
      const result = await voterRegistrationService.registerForElection(election.id, true)
      setConfirmOpen(false)
      setAcceptTerms(false)
      onComplete(result)
      await onRefresh()
      if (result.status === 'waitlisted') {
        toast.success(`You are #${result.queuePosition} on the waitlist`)
      } else {
        toast.success('Registration complete — save your secret token')
      }
    } catch (e) {
      const msg = mapRegistrationRpcError(e instanceof Error ? e.message : String(e))
      setLocalError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!eligibility.ok) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">Registration unavailable</CardTitle>
          <CardDescription>{eligibility.message}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card className="rounded-[2.5rem] border-border/40 bg-zinc-950/20 shadow-2xl backdrop-blur-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <Shield className="size-48 text-primary" />
        </div>
        <CardHeader className="p-8 lg:p-10 pb-6 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <ClipboardList className="size-5 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Voter Access</span>
          </div>
          <CardTitle className="text-3xl font-black text-foreground tracking-tighter leading-none mb-4">Participate in Election</CardTitle>
          <CardDescription className="text-muted-foreground font-medium text-lg leading-relaxed max-w-2xl">
            Join this secure voting system. You will receive a unique <span className="font-bold text-foreground">Voting Code</span> required to cast your ballot.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 lg:p-10 pt-0 space-y-10 relative z-10">
          <div className="p-8 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 shadow-inner">
            <RegistrationProgressIndicator
              registrantCount={registrantCount}
              maxVoters={election.max_voters}
              waitlistCount={waitlistCount}
            />
          </div>

          {capReached ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
            >
              <Shield className="mt-0.5 size-4 shrink-0" />
              <span>Ballot cap reached — continuing will add you to the waitlist (no token yet).</span>
            </motion.div>
          ) : null}

          <div className={cn(
            "flex flex-row items-start gap-4 rounded-[2rem] border p-8 transition-all duration-500",
            acceptTerms ? "border-primary/30 bg-primary/5" : "border-zinc-800 bg-zinc-900/30"
          )}>
            <Checkbox
              id="accept-terms"
              className="size-5 rounded-lg border-zinc-700 mt-1"
              checked={acceptTerms}
              onCheckedChange={(c) => {
                setAcceptTerms(c === true)
                setTermsError(null)
              }}
            />
            <div className="space-y-3">
              <Label htmlFor="accept-terms" className="text-lg font-bold text-foreground leading-none cursor-pointer">
                I accept the participation protocols
              </Label>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                I acknowledge that my <span className="font-bold text-foreground">Voting Code</span> is immutable and cannot be reset by administrators. I agree to maintain absolute confidentiality of my credentials.
              </p>
              {termsError ? <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest pt-2 animate-pulse">{termsError}</p> : null}
            </div>
          </div>

          {localError ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </p>
          ) : null}

          <AnimatePresence mode="wait">
            {submitting && confirmOpen ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Securing your registration…
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-primary"
                    animate={{ x: ['-100%', '300%'] }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button 
                  type="button" 
                  className={cn(
                    "h-16 rounded-2xl px-12 font-black uppercase tracking-[0.2em] text-[10px] transition-all duration-500 shadow-2xl",
                    acceptTerms ? "premium-gradient shadow-primary/20 hover:scale-[1.02]" : "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700"
                  )} 
                  disabled={!acceptTerms} 
                  onClick={() => tryOpenConfirm()}
                >
                  Register for Election
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm registration</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  You are registering for <span className="font-medium text-foreground">{election.title}</span>.
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Terms accepted — eligibility verified at submit time.</li>
                  <li>
                    {capReached
                      ? 'You will be added to the waitlist without a ballot token until a slot opens.'
                      : 'You will receive a one-time secret ballot token after confirmation.'}
                  </li>
                  <li>Duplicate registrations are rejected server-side.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={submitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              disabled={submitting}
              onClick={(ev) => {
                ev.preventDefault()
                void submit()
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" />
                  Confirm
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
