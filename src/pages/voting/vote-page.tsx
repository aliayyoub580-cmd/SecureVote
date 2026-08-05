import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { CheckCircle2, ShieldCheck, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

import { ElectionCountdown } from '@/components/elections/election-countdown'
import { VoteCandidatePickCard } from '@/components/voting/vote-candidate-pick-card'
import { Textarea } from '@/components/ui/textarea'
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
import { VoteConfirmDialog } from '@/components/voting/vote-confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { ROUTES } from '@/constants/routes'
import { useElectionLiveStats } from '@/hooks/use-election-live-stats'
import { getDisplayPhase, maskVotingCode } from '@/lib/election-utils'
import { voteBallotSchema } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { electionsService } from '@/services/elections.service'
import { pollsService } from '@/services/polls.service'
import { votesService } from '@/services/votes.service'
import type { Database } from '@/types/database'
import { Skeleton } from '@/components/ui/skeleton'

type Candidate = Database['public']['Tables']['election_candidates']['Row']
type Poll = Database['public']['Tables']['election_polls']['Row']
type Form = z.infer<typeof voteBallotSchema>

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
}

export function VotePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [election, setElection] = useState<Database['public']['Tables']['elections']['Row'] | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [alreadyVoted, setAlreadyVoted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const form = useForm<Form>({ resolver: zodResolver(voteBallotSchema), defaultValues: { secretToken: '' } })

  const reloadElection = useCallback(async () => {
    if (!id) return
    const e = await electionsService.getById(id)
    setElection(e)
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      await votesService.tryAutocloseExpiredElections()
      const [e, c, p] = await Promise.all([
        electionsService.getById(id),
        electionsService.listCandidates(id),
        pollsService.list(id),
      ])
      if (cancelled) return
      setElection(e)
      setCandidates(c)
      setPolls(p)
      const init: Record<string, string> = {}
      const initComments: Record<string, string> = {}
      for (const pol of p) {
        init[pol.id] = ''
        initComments[pol.id] = ''
      }
      setPicks(init)
      setComments(initComments)

      if (user?.id) {
        try {
          const used = await votesService.ballotUsed(id, user.id)
          if (!cancelled) setAlreadyVoted(used)
        } catch {
          if (!cancelled) setAlreadyVoted(false)
        }
      } else if (!cancelled) {
        setAlreadyVoted(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, user?.id])

  const byPoll = useMemo(() => {
    const map = new Map<string, { poll: Poll; candidates: Candidate[] }>()
    for (const pol of polls) {
      const list = candidates
        .filter((c) => c.poll_id === pol.id)
        .sort((a, b) => a.display_order - b.display_order)
      map.set(pol.id, { poll: pol, candidates: list })
    }
    return map
  }, [polls, candidates])

  const phase = election ? getDisplayPhase(election) : null
  const canVote = phase === 'voting' && !alreadyVoted

  const { stats, loading: statsLoading } = useElectionLiveStats(id, Boolean(id && election))

  const confirmLines = useMemo(() => {
    return polls.map((p) => {
      const cid = picks[p.id]
      const c = candidates.find((x) => x.id === cid)
      return { label: p.title, value: c?.name ?? '—' }
    })
  }, [polls, picks, candidates])

  const openConfirm = async () => {
    if (!id) return
    for (const p of polls) {
      if (!picks[p.id]) {
        toast.error(`Selection missing for: ${p.title}`)
        return
      }
    }
    const ok = await form.trigger()
    if (!ok) return
    setConfirmOpen(true)
  }

  const handleConfirmSubmit = async () => {
    if (!id) return
    const token = form.getValues('secretToken')
    const selections = polls.map((p) => ({ poll_id: p.id, candidate_id: picks[p.id], comment: comments[p.id] }))
    setConfirming(true)
    try {
      await votesService.submitBallot(id, token, selections)
      setConfirmOpen(false)
      setShowSuccess(true)
      setAlreadyVoted(true)
      toast.success('Vote recorded successfully.')
      form.reset({ secretToken: '' })
      setPicks((prev) => {
        const n = { ...prev }
        for (const p of polls) n[p.id] = ''
        return n
      })
      setComments((prev) => {
        const n = { ...prev }
        for (const p of polls) n[p.id] = ''
        return n
      })
      void reloadElection()
      window.setTimeout(() => setShowSuccess(false), 4000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid Secret ID or registration issue.')
    } finally {
      setConfirming(false)
    }
  }

  if (!id) return null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 min-h-screen transition-colors duration-500">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-12"
      >
        {/* Header Section */}
        <motion.div variants={item} className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 border-b border-border pb-12">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <ShieldCheck className="size-4" />
                Secure Voting Session
              </div>
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter mb-4 leading-none">Voting Panel</h1>
            <p className="text-muted-foreground max-w-2xl text-lg font-medium leading-relaxed">
              {election?.title ? (
                <span className="text-foreground font-bold">{election.title}</span>
              ) : (
                'Connecting to election server...'
              )}
            </p>
          </div>
          {election ? (
            <div className="shrink-0 p-1 bg-card border border-border rounded-3xl shadow-sm">
              <ElectionCountdown startsAt={election.starts_at} endsAt={election.ends_at} className="min-w-[260px]" />
            </div>
          ) : (
            <Skeleton className="h-24 w-64 rounded-3xl" />
          )}
        </motion.div>

        {/* Live Stats */}
        {election && (
          <motion.div variants={item}>
            <Card className="rounded-[2rem] border-border bg-card shadow-sm overflow-hidden relative group">
              <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between p-8 lg:p-12 gap-12 relative z-10">
                <div className="grid grid-cols-2 gap-8 lg:flex lg:items-center lg:gap-16">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Votes Cast</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-black text-foreground tabular-nums tracking-tighter">
                        {statsLoading ? '—' : stats.ballots_completed}
                      </span>
                      <span className="text-sm font-bold text-muted-foreground">/ {statsLoading ? '—' : stats.registered}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Registered</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-black text-primary tabular-nums tracking-tighter">
                        {statsLoading ? '—' : stats.registered}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="max-w-[280px]">
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed border-l-4 border-primary/20 pl-4 italic">
                    Real-time participation stats. Your individual vote remains completely private and encrypted.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Closed/Ended Notice */}
        {!canVote && phase !== 'voting' ? (
          <motion.div variants={item}>
            <Card className="rounded-[2rem] border-orange-500/20 bg-orange-500/5 p-8 lg:p-12 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-4 text-orange-600 mb-6">
                <div className="size-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                   <Lock className="size-6" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">Voting is Closed</CardTitle>
              </div>
              <p className="text-muted-foreground text-lg font-medium leading-relaxed mb-8 max-w-2xl">
                The voting panel is currently inactive. Votes can only be cast during the official election period.
                <span className="block mt-4 text-foreground font-bold uppercase text-[10px] tracking-widest bg-orange-500/10 w-fit px-3 py-1.5 rounded-full border border-orange-500/20">Phase: {phase ?? 'Unknown'}</span>
              </p>
              <div className="flex items-center gap-4">
                <Button asChild variant="outline" className="rounded-xl border-border bg-background hover:bg-muted h-12 px-8 font-bold uppercase tracking-widest text-[10px]">
                  <Link to={ROUTES.electionDetail(id)}>Back to Details</Link>
                </Button>
                {phase === 'scheduled' && (
                  <p className="text-xs font-bold text-primary uppercase tracking-widest animate-pulse">Starts on {election && format(new Date(election.starts_at), 'MMM d, HH:mm')}</p>
                )}
              </div>
            </Card>
          </motion.div>
        ) : null}

        {/* Empty Ballot Case */}
        {canVote && polls.length === 0 ? (
          <motion.div variants={item}>
            <Card className="rounded-[2rem] border-border bg-card p-12 text-center shadow-sm">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="size-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Empty Ballot</h2>
              <p className="text-muted-foreground max-w-sm mx-auto font-medium mb-8">
                This election is live, but no voting sections or candidates have been configured yet.
              </p>
              <Button asChild variant="outline" className="rounded-xl h-12 px-8 font-bold uppercase tracking-widest text-[10px]">
                <Link to={ROUTES.electionDetail(id)}>Return to Detail</Link>
              </Button>
            </Card>
          </motion.div>
        ) : null}

        {/* Already Voted Notice */}
        {phase === 'voting' && alreadyVoted ? (
          <motion.div variants={item}>
            <Card className="rounded-[2rem] border-emerald-500/20 bg-emerald-500/5 p-8 lg:p-12 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-4 text-emerald-600 mb-6">
                <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle2 className="size-6" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">You have already voted</CardTitle>
              </div>
              <p className="text-muted-foreground text-lg font-medium leading-relaxed mb-8 max-w-2xl">
                Your vote has been securely recorded for this election. Each participant can only vote once to ensure a fair process.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild className="rounded-xl premium-gradient h-12 px-8 font-bold uppercase tracking-widest text-[10px] shadow-sm">
                  <Link to={ROUTES.electionResults(id)}>View Live Results</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl border-border bg-background hover:bg-muted h-12 px-8 font-bold uppercase tracking-widest text-[10px]">
                  <Link to={ROUTES.electionDetail(id)}>Back to Details</Link>
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {/* Ballot Content */}
        {canVote ? (
          <div className="space-y-16">
            <div className="space-y-24">
              {polls.map((p, idx) => {
                const bucket = byPoll.get(p.id)
                const list = bucket?.candidates ?? []
                return (
                  <motion.section key={p.id} variants={item} className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full border border-primary/20">Step {idx + 1}</span>
                        </div>
                        <h2 className="text-3xl font-bold text-foreground tracking-tight">{p.title}</h2>
                        <p className="text-muted-foreground font-medium mt-2 text-lg">Select one candidate for this position.</p>
                      </div>
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-2">
                      {list.map((c) => (
                        <VoteCandidatePickCard
                          key={c.id}
                          candidate={c}
                          selected={picks[p.id] === c.id}
                          onSelect={() => setPicks((prev) => ({ ...prev, [p.id]: c.id }))}
                        />
                      ))}
                    </div>
                    
                    {list.length === 0 && (
                      <div className="p-12 rounded-[2rem] border border-dashed border-border bg-muted/20 text-center">
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">No candidates found for this section.</p>
                      </div>
                    )}

                    {p.allow_comments && (
                      <div className="mt-6 space-y-3 bg-muted/20 p-6 rounded-2xl border border-border">
                        <label htmlFor={`comment-${p.id}`} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                          Optional Comment
                        </label>
                        <Textarea
                          id={`comment-${p.id}`}
                          placeholder="Leave feedback or a reason for your choice (optional)..."
                          className="min-h-[100px] resize-y rounded-xl bg-background border-border text-sm"
                          value={comments[p.id] || ''}
                          onChange={(e) => setComments(prev => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      </div>
                    )}
                  </motion.section>
                )
              })}
            </div>

            {/* Secret ID Input */}
            <motion.div variants={item}>
              <Card className="rounded-2xl sm:rounded-[2.5rem] border-border bg-card p-5 sm:p-8 lg:p-12 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-12">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                        <Lock className="size-6 text-primary" />
                      </div>
                      <CardTitle className="text-2xl font-bold text-foreground tracking-tight">Enter Voting Code</CardTitle>
                    </div>
                    <p className="text-muted-foreground font-medium leading-relaxed text-base">
                      To cast your vote, please enter your unique **Voting Code** provided during registration. 
                      <span className="block mt-2 text-primary font-bold text-sm underline decoration-primary/30 underline-offset-4">
                        Check your email or system notifications for your secure code.
                      </span>
                    </p>
                  </div>
                  <div className="w-full lg:w-96 space-y-4 bg-muted/20 p-6 rounded-3xl border border-border/50">
                    <div className="space-y-3">
                      <Label htmlFor="secret" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Voting Code Authorization</Label>
                      <Input
                        id="secret"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="ENTER VOTING CODE"
                        className={cn(
                          'h-14 bg-background border-border rounded-xl font-mono text-xs tracking-widest focus-visible:ring-primary/20 text-center font-black text-foreground shadow-sm uppercase',
                          form.formState.errors.secretToken ? 'border-rose-500/30' : '',
                        )}
                        {...form.register('secretToken')}
                      />
                      <div className="flex items-center justify-between mt-1 px-1">
                        {form.formState.errors.secretToken ? (
                          <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest animate-pulse">Invalid Code Format</p>
                        ) : (
                          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Enter your secure voting ID sent to your email</p>
                        )}
                        <Link 
                          to={ROUTES.electionDetail(id)} 
                          className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline decoration-primary/30 underline-offset-4"
                        >
                          Forgot Code?
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Submit Button */}
            <motion.div variants={item} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-8 pb-12">
              <Button 
                type="button" 
                size="lg" 
                onClick={() => void openConfirm()} 
                disabled={form.formState.isSubmitting}
                className="flex-1 h-16 rounded-2xl premium-gradient text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all group overflow-hidden"
              >
                <span className="flex items-center gap-3">
                  Submit My Ballot <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1 h-16 rounded-2xl border-border bg-muted/30 hover:bg-muted font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground hover:text-foreground transition-all">
                <Link to={ROUTES.electionResults(id)}>View Live Results</Link>
              </Button>
            </motion.div>
          </div>
        ) : null}

        <VoteConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          electionTitle={election?.title ?? 'Election'}
          lines={confirmLines}
          tokenMasked={maskVotingCode(form.watch('secretToken'))}
          confirming={confirming}
          onConfirm={() => void handleConfirmSubmit()}
        />

        {/* Success Overlay */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              key="success"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="flex max-w-md flex-col items-center gap-8 rounded-[3rem] border border-emerald-500/20 bg-card p-12 text-center shadow-2xl relative"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25 }}
              >
                <div className="size-24 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle2 className="size-12 text-emerald-600" />
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-3xl font-black text-foreground tracking-tight leading-none">Vote Recorded!</h3>
                  <p className="text-muted-foreground font-medium leading-relaxed text-lg">
                    Your vote has been securely recorded and finalized. Thank you for participating.
                  </p>
                </div>

                <div className="pt-4 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="size-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">System Synchronized</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
