import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { 
  ArrowLeft, 
  Users, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Calendar,
  AlertCircle
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import { ROUTES } from '@/constants/routes'
import { supabase } from '@/lib/supabase/client'
import { electionsService } from '@/services/elections.service'
import { voterRegistrationService } from '@/services/voter-registration.service'
import { votesService } from '@/services/votes.service'
import type { Database } from '@/types/database'
import { toast } from '@/lib/toast'
import { isRegistrationOpen } from '@/lib/election-utils'
import { emailService } from '@/services/email.service'

type Election = Database['public']['Tables']['elections']['Row']
type Candidate = Database['public']['Tables']['election_candidates']['Row']

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 100 } }
}

function formatSimpleVotingCode(token: string) {
  if (!token) return 'SV-0000'
  const short = token.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()
  return `SV-${short}`
}

function maskVotingCode(code: string) {
  if (code.length < 7) return code
  return `${code.substring(0, 3)}••${code.substring(code.length - 2)}`
}

export function ElectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [election, setElection] = useState<Election | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isRegistered, setIsRegistered] = useState(false)
  const [isWaitlisted, setIsWaitlisted] = useState<number | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [votingCode, setVotingCode] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [data, candData] = await Promise.all([
          electionsService.getById(id),
          electionsService.listCandidates(id)
        ])
        if (cancelled) return
        if (!data) {
          navigate(ROUTES.elections, { replace: true })
          return
        }
        setElection(data)
        setCandidates(candData)

        if (profile?.id) {
          const [status, voted] = await Promise.all([
            voterRegistrationService.getStatus(id),
            votesService.ballotUsed(id, profile.id)
          ])
          if (!cancelled) {
            setIsRegistered(status.hasBallot)
            setIsWaitlisted(status.waitlistPosition)
            setHasVoted(voted)
            if (status.hasBallot) {
              setVotingCode(formatSimpleVotingCode(profile.id + id))
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, profile?.id, navigate])

  const handleJoinElection = async () => {
    if (!id || !profile?.id) {
      navigate(ROUTES.login)
      return
    }

    setIsRegistering(true)
    toast.loading('Confirming participation...')

    const timeoutId = setTimeout(() => {
      setIsRegistering(false)
      toast.error('Registration is taking longer than expected. Please refresh.')
    }, 15000)

    try {
      if (!isRegistered) {
        const { data, error } = await supabase.rpc('register_for_election', {
          p_election_id: id,
          p_accept_terms: true
        })

        if (error) throw error

        const row = (Array.isArray(data) ? data[0] : data ?? {}) as any

        clearTimeout(timeoutId)

        if (row.secret_token) {
          setIsRegistered(true)
          const code = row.secret_token
          setVotingCode(code)
          toast.success('Registration successful!')

          if (profile?.email && election?.title) {
            void emailService.sendVotingCodeEmail(profile.email, election.title, code)
          }

          setTimeout(() => {
            toast.success('Complete voting code sent to your email.')
          }, 1500)
        } else if (row.status === 'waitlisted') {
          setIsWaitlisted(row.queue_position || 0)
          toast.success(`Added to waitlist (Position: ${row.queue_position || 0})`)
        } else {
          setIsRegistered(true)
          setVotingCode(formatSimpleVotingCode(profile.id + id))
          toast.success('Registration successful!')
        }
      } else {
        clearTimeout(timeoutId)
        toast.success('You are already registered.')
      }
    } catch (e: any) {
      clearTimeout(timeoutId)
      console.error('Registration error:', e)
      let msg = e?.message || 'Registration failed. Check connection or try again.'
      if (
        msg.toLowerCase().includes('registration_full') ||
        msg.toLowerCase().includes('full') ||
        msg.toLowerCase().includes('limit')
      ) {
        msg = `Registration Limit Reached! The creator has capped this election at ${election?.max_voters || 3} voters, and all slots have been filled. No new registrations are allowed.`
      } else if (msg.toLowerCase().includes('registration_window_closed')) {
        msg = 'Registration is now closed for this election.'
      }
      toast.error(msg)
    } finally {
      setIsRegistering(false)
    }
  }

  if (loading || !election) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-8">
        <Skeleton className="h-10 w-32 rounded-lg bg-[var(--muted)]" />
        <Skeleton className="h-40 w-full rounded-2xl bg-[var(--muted)]" />
        <div className="grid gap-8 lg:grid-cols-3">
          <Skeleton className="h-[400px] lg:col-span-2 rounded-2xl bg-[var(--muted)]" />
          <Skeleton className="h-[400px] rounded-2xl bg-[var(--muted)]" />
        </div>
      </div>
    )
  }

  const now = new Date()
  const start = new Date(election.starts_at)
  const end = new Date(election.ends_at)
  const isRegistrationClosed = !isRegistrationOpen(election)
  const isVotingLive = election.status === 'active' && now >= start && now <= end

  return (
    <motion.div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-6 sm:space-y-8" variants={container} initial="hidden" animate="show">

      {/* Top Nav */}
      <motion.div variants={item}>
        <Button asChild variant="link" className="px-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] group mb-2">
          <Link to={ROUTES.elections} className="flex items-center gap-2">
            <ArrowLeft className="size-4" />
            <span>Back to Browse Elections</span>
          </Link>
        </Button>
      </motion.div>

      {/* Header */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {isVotingLive ? (
            <span className="badge-success">Voting Live</span>
          ) : isRegistrationClosed ? (
            <span className="badge-error">Registration Closed</span>
          ) : (
            <span className="badge-warning">Registration Open</span>
          )}
        </div>
        <h1 className="page-title text-2xl sm:text-3xl lg:text-4xl">{election.title}</h1>
        <p className="text-[var(--muted-foreground)] font-medium text-sm sm:text-base">Organization: {election.organization || 'Independent'}</p>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
        {/* Left: Details + Candidates */}
        <motion.div variants={item} className="lg:col-span-2 space-y-6 sm:space-y-8">
          <Card className="saas-card p-5 sm:p-8">
            <h3 className="section-title mb-4">Election Details</h3>
            <p className="text-[var(--foreground)] leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
              {election.description || 'No description provided.'}
            </p>
          </Card>

          <Card className="saas-card p-5 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="section-title">Candidates</h3>
              <span className="badge-neutral">{candidates.length} Available</span>
            </div>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              {candidates.map((c) => (
                <div key={c.id} className="p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 flex items-center gap-3 sm:gap-4">
                  <div className="size-10 sm:size-12 rounded-full bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
                    {c.image_path ? (
                      <img src={c.image_path} alt={c.name} className="size-full object-cover" />
                    ) : (
                      <Users className="size-4 sm:size-5 text-[var(--muted-foreground)]" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-[var(--foreground)] text-sm sm:text-base">{c.name}</h4>
                    <p className="text-xs text-[var(--muted-foreground)]">{c.designation || 'Candidate'}</p>
                  </div>
                </div>
              ))}
              {candidates.length === 0 && (
                <p className="text-[var(--muted-foreground)] text-sm col-span-full">No candidates announced yet.</p>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Right Sidebar: Registration & Actions */}
        <motion.div variants={item}>
          <Card className="saas-card p-5 sm:p-6 space-y-6 sm:space-y-8 lg:sticky lg:top-6">

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="section-title">Timeline</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="size-5 text-[var(--muted-foreground)] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">Registration</p>
                    <p className="text-xs text-[var(--muted-foreground)]">From {start.toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="size-5 text-[var(--muted-foreground)] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">Voting Ends</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{end.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action area */}
            <div className="pt-4 sm:pt-6 border-t border-white/[0.04] space-y-4">
              {hasVoted ? (
                <div className="p-4 rounded-xl bg-[var(--muted)] border border-[var(--border)] text-center space-y-2">
                  <CheckCircle2 className="size-6 text-emerald-500 mx-auto" />
                  <p className="text-sm font-medium text-[var(--foreground)]">Vote Submitted Successfully</p>
                </div>
              ) : isRegistered ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--muted)] border border-[var(--border)] text-center space-y-2">
                    <ShieldCheck className="size-6 text-emerald-500 mx-auto" />
                    <p className="text-sm font-medium text-[var(--foreground)]">Registration Confirmed</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Your voting code: {votingCode ? maskVotingCode(votingCode) : 'Sent to email'}
                    </p>
                  </div>
                  <Button className="btn-primary w-full" asChild>
                    <Link to={ROUTES.electionVote(id!)}>Proceed to Vote</Link>
                  </Button>
                </div>
              ) : isWaitlisted !== null ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
                  <Clock className="size-6 text-amber-500 mx-auto" />
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Waitlisted</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Position in queue: {isWaitlisted}</p>
                </div>
              ) : isRegistrationClosed ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
                  <AlertCircle className="size-6 text-rose-500 mx-auto" />
                  <p className="text-sm font-medium text-rose-600 dark:text-rose-400">Registration Closed</p>
                </div>
              ) : (
                <Button
                  className="btn-primary w-full"
                  onClick={() => void handleJoinElection()}
                  disabled={isRegistering}
                >
                  {isRegistering ? 'Registering...' : 'Join Election'}
                </Button>
              )}
            </div>

            {/* Share Election */}
            <div className="pt-4 sm:pt-6 border-t border-border/40 space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Share & Invite</h4>
              <p className="text-[11px] text-muted-foreground font-medium">
                Invite others to register and cast their vote in this election.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={window.location.origin + `/elections/${election.id}`}
                  className="flex-1 h-10 px-3 bg-[var(--muted)] border border-border/40 rounded-xl text-xs font-mono font-bold text-[var(--foreground)] select-all min-w-0"
                />
                <Button
                  variant="outline"
                  className="h-10 px-3 sm:px-4 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-muted shrink-0"
                  onClick={() => {
                    void navigator.clipboard.writeText(window.location.origin + `/elections/${election.id}`)
                    toast.success('Share link copied!')
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>

          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
