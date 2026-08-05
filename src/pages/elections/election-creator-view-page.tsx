import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import {
  ArrowLeft,
  Users,
  Clock,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Hourglass,
  Activity,
  Settings,
  Tag,
  Building2,
  Globe,
  Hash,
  Trophy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ElectionStatusBadge } from '@/modules/elections/election-status-badge'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { electionsService } from '@/services/elections.service'
import { votesService } from '@/services/votes.service'
import { groupResultsByPoll, computePollWinners, type PollWinnerInfo } from '@/lib/election-results-analytics'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Election = Database['public']['Tables']['elections']['Row']
type Candidate = Database['public']['Tables']['election_candidates']['Row']

type RegistrantRow = {
  user_id: string
  registered_at: string
  has_voted: boolean
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 22, stiffness: 120 } },
}

/** Always mask voter ID: show first 4 + last 4 chars only */
function maskUserId(uid: string): string {
  if (!uid) return '••••••••••••'
  const clean = uid.replace(/-/g, '')
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••${clean.slice(-2)}`
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`
}

export function ElectionCreatorViewPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [election, setElection] = useState<Election | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [registrants, setRegistrants] = useState<RegistrantRow[]>([])
  const [ledger, setLedger] = useState<{ voter_code: string; candidate_name: string; poll_title: string; voted_at: string; comment?: string | null }[]>([])
  const [winners, setWinners] = useState<PollWinnerInfo[]>([])

  useEffect(() => {
    if (!id || !profile) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [data, candData] = await Promise.all([
          electionsService.getById(id),
          electionsService.listCandidates(id),
        ])
        if (cancelled) return
        if (!data) {
          toast.error('Election not found')
          navigate(ROUTES.electionsManage)
          return
        }
        if (data.created_by !== profile.id && profile.role !== 'super_admin') {
          toast.error('Access denied')
          navigate(ROUTES.electionsManage)
          return
        }
        setElection(data)
        setCandidates(candData)

        const [regs, ledgerData] = await Promise.all([
          electionsService.listRegistrants(id),
          votesService.getVoteLedger(id).catch(() => []),
        ])
        if (!cancelled) {
          setRegistrants((regs as unknown as RegistrantRow[]) ?? [])
          setLedger(ledgerData)
        }

        // Load winners when election has ended
        if (data.status === 'closed' || new Date(data.ends_at) < new Date()) {
          const resultRows = await votesService.getResults(id).catch(() => [])
          const sections = groupResultsByPoll(resultRows)
          if (!cancelled) setWinners(computePollWinners(sections))
        }
      } catch {
        toast.error('Failed to load election details')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, profile?.id, navigate])

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-8">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (!election) return null

  const votedCount = registrants.filter((r) => r.has_voted).length
  const notVotedCount = registrants.length - votedCount
  const turnoutPct = registrants.length > 0 ? Math.round((votedCount / registrants.length) * 100) : 0
  const isEnded = election.status === 'closed' || new Date(election.ends_at) < new Date()

  return (
    <motion.div
      className="p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-10"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Breadcrumb */}
      <motion.div variants={item} className="flex items-center gap-3">
        <Button asChild variant="link" className="px-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] group">
          <Link to={ROUTES.electionsManage} className="flex items-center gap-2">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            My Elections
          </Link>
        </Button>
        <span className="text-[var(--muted-foreground)]">/</span>
        <span className="text-sm font-semibold text-[var(--foreground)] truncate max-w-xs">{election.title}</span>
      </motion.div>

      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-[var(--border)] pb-8">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <ElectionStatusBadge election={election} />
            <span className="px-2.5 py-1 rounded-full bg-[var(--muted)] border border-[var(--border)] text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              Read-Only View
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">{election.title}</h1>
          <p className="text-[var(--muted-foreground)] font-medium">
            {election.organization || 'Independent Campaign'} · {election.category || 'Uncategorised'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          {['active', 'closed'].includes(election.status) && (
            <Button asChild variant="secondary" className="h-10 rounded-lg gap-2 text-xs font-bold uppercase tracking-widest">
              <Link to={ROUTES.electionResults(election.id)}>
                <Activity className="size-4" /> View Results
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="h-10 rounded-lg gap-2 text-xs font-bold uppercase tracking-widest bg-[var(--card)] border-[var(--border)]">
            <Link to={ROUTES.electionEdit(election.id)}>
              <Settings className="size-4" /> Manage
            </Link>
          </Button>
          {['draft', 'pending_approval', 'rejected'].includes(election.status) && (
            <Button asChild className="btn-primary h-10 rounded-lg gap-2 text-xs font-bold uppercase tracking-widest">
              <Link to={ROUTES.electionWizard(election.id)}>Edit Setup</Link>
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Registered', value: election.registrant_count || 0, icon: Users, color: 'text-[var(--primary)]', bg: 'bg-[var(--primary)]/10 border-[var(--primary)]/20' },
          { label: 'Votes Cast', value: votedCount, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Not Voted', value: notVotedCount, icon: Hourglass, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Turnout', value: `${turnoutPct}%`, icon: Activity, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
        ].map((s) => (
          <Card key={s.label} className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn('size-10 rounded-xl flex items-center justify-center border shrink-0', s.bg)}>
                <s.icon className={cn('size-5', s.color)} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">{s.label}</p>
                <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Share Campaign Link Banner */}
      <motion.div variants={item}>
        <Card className="saas-card bg-[var(--card)] border-[var(--primary)]/30 shadow-sm overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--primary)]" />
          <CardContent className="p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)] flex items-center gap-2">
                <Globe className="size-3" /> Share Campaign Link
              </p>
              <h3 className="text-base font-bold text-[var(--foreground)]">Invite Voters to Participate</h3>
              <p className="text-xs text-[var(--muted-foreground)] font-medium max-w-lg">
                Copy and distribute this link to your voters. They will use it to access the voting portal, review candidates, and cast their secure vote.
              </p>
            </div>
            <div className="flex w-full md:w-auto items-center gap-2">
              <input 
                readOnly 
                value={window.location.origin + `/elections/${election.id}`}
                className="flex-1 md:w-64 h-10 px-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs font-mono font-bold text-[var(--foreground)] select-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 transition-all"
              />
              <Button 
                className="h-10 px-6 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0"
                onClick={() => {
                  void navigator.clipboard.writeText(window.location.origin + `/elections/${election.id}`)
                  toast.success('Campaign voting link copied!')
                }}
              >
                Copy Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Winner Banner — shown when election has ended */}
      {isEnded && winners.length > 0 && (
        <motion.div variants={item}>
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Trophy className="size-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--foreground)] uppercase tracking-widest">Final Results</h2>
                <p className="text-xs text-[var(--muted-foreground)]">Voting is closed — official winners declared below</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {winners.map((w, i) => (
                <div key={i} className="rounded-xl bg-[var(--card)] border border-amber-500/20 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">{w.pollTitle}</p>
                  {w.leaders.length === 0 || w.totalVotesInPoll === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">No votes recorded</p>
                  ) : w.isTie ? (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Tie</span>
                      {w.leaders.map((l) => (
                        <p key={l.candidate_id} className="font-black text-[var(--foreground)]">
                          {l.name} <span className="text-[var(--muted-foreground)] font-normal text-xs">— {l.votes} votes</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Trophy className="size-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-black text-lg text-[var(--foreground)] leading-tight">{w.leaders[0]?.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {w.leaders[0]?.votes} votes · {Math.round(((w.leaders[0]?.votes ?? 0) / w.totalVotesInPoll) * 100)}% of section
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Details + Candidates + Voter Table */}
        <motion.div variants={item} className="lg:col-span-2 space-y-8">

          {/* Election Info */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Election Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Tag className="size-4 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Category</p>
                    <p className="font-semibold text-sm">{election.category || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Organization</p>
                    <p className="font-semibold text-sm">{election.organization || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Visibility</p>
                    <p className="font-semibold text-sm capitalize">{election.visibility}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="size-4 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Max Voters</p>
                    <p className="font-semibold text-sm">{election.max_voters ?? 'Unlimited'}</p>
                  </div>
                </div>
              </div>
              {election.description && (
                <div className="pt-4 border-t border-[var(--border)]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)] mb-2">Description</p>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{election.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidates */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-bold">Candidates</CardTitle>
              <span className="px-2.5 py-1 rounded-full bg-[var(--muted)] text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                {candidates.length} Total
              </span>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] py-6 text-center">No candidates added yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {candidates.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                      <div className="size-10 rounded-full bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
                        {c.image_path ? (
                          <img src={c.image_path} alt={c.name} className="size-full object-cover" />
                        ) : (
                          <Users className="size-4 text-[var(--muted-foreground)]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[var(--foreground)] truncate">{c.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)] truncate">{c.designation || 'Candidate'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voter Participation Table — masked IDs, no toggle */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Voter Participation</CardTitle>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Who voted · Who has not voted · Voter IDs masked for privacy · Candidate selections never shown
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {registrants.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="size-8 text-[var(--muted-foreground)] mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-[var(--muted-foreground)]">No voters registered yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">#</th>
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Voter ID</th>
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Registered</th>
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Vote Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrants.map((r, i) => (
                        <motion.tr
                          key={r.user_id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-[var(--border)] hover:bg-[var(--muted)]/30 transition-colors"
                        >
                          <td className="px-6 py-3 text-[var(--muted-foreground)] font-bold">{i + 1}</td>
                          <td className="px-6 py-3">
                            <code className="font-mono text-xs bg-[var(--muted)] px-2 py-0.5 rounded text-[var(--foreground)]">
                              {maskUserId(r.user_id)}
                            </code>
                          </td>
                          <td className="px-6 py-3 text-[var(--muted-foreground)] text-xs">
                            {new Date(r.registered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-3">
                            {r.has_voted ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                                <CheckCircle2 className="size-3" /> Voted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                <Hourglass className="size-3" /> Pending
                              </span>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)]/20 flex items-center gap-3">
                <ShieldCheck className="size-4 text-[var(--primary)] shrink-0" />
                <p className="text-[11px] text-[var(--muted-foreground)] font-medium">
                  <strong className="text-[var(--foreground)]">Voting is anonymous.</strong> Candidate selections are never shown — only participation status.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Voter Comments */}
          {ledger.some(l => l.comment) && (
            <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
              <CardHeader className="pb-4 border-b border-[var(--border)]">
                <CardTitle className="text-lg font-bold">Voter Comments</CardTitle>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Anonymous feedback provided by voters during ballot submission.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-[var(--border)]">
                  {ledger.filter(l => l.comment).map((l, i) => (
                    <div key={i} className="p-5 space-y-3 hover:bg-[var(--muted)]/20 transition-colors">
                      <div className="flex items-center flex-wrap gap-2">
                        <code className="font-mono text-[10px] font-bold bg-[var(--muted)] px-2 py-0.5 rounded text-[var(--foreground)]">
                          {l.voter_code}
                        </code>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                          · {l.poll_title}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">
                          {new Date(l.voted_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--foreground)] leading-relaxed p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] shadow-sm">
                        "{l.comment}"
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Right: Timeline & Turnout */}
        <motion.div variants={item} className="space-y-6">
          {/* Timeline */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Voting Starts', value: new Date(election.starts_at).toLocaleString(), icon: Calendar, color: 'text-[var(--primary)]' },
                { label: 'Voting Ends', value: new Date(election.ends_at).toLocaleString(), icon: Clock, color: 'text-rose-500' },
                ...(election.registration_opens_at ? [{ label: 'Reg. Opens', value: new Date(election.registration_opens_at).toLocaleString(), icon: Calendar, color: 'text-emerald-500' }] : []),
                ...(election.registration_closes_at ? [{ label: 'Reg. Closes', value: new Date(election.registration_closes_at).toLocaleString(), icon: Clock, color: 'text-amber-500' }] : []),
              ].map((t) => (
                <div key={t.label} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                  <t.icon className={cn('size-4 mt-0.5 shrink-0', t.color)} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">{t.label}</p>
                    <p className="text-sm font-semibold">{t.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Turnout */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Turnout Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-center">
                <p className="text-5xl font-black text-[var(--primary)]">{turnoutPct}%</p>
                <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-widest mt-1">Voter Turnout</p>
              </div>
              <div className="h-3 w-full rounded-full bg-[var(--muted)] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${turnoutPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  className="h-full rounded-full bg-[var(--primary)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-lg font-black text-emerald-500">{votedCount}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Voted</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-lg font-black text-amber-500">{notVotedCount}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Not Yet</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Capacity */}
          {election.max_voters && (
            <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
              <CardContent className="p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)] mb-2">Capacity</p>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-2xl font-black text-[var(--foreground)]">{election.registrant_count || 0}</span>
                  <span className="text-sm text-[var(--muted-foreground)] font-bold">/ {election.max_voters} max</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--muted)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.round(((election.registrant_count || 0) / election.max_voters) * 100))}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                    className="h-full rounded-full bg-[var(--primary)]"
                  />
                </div>
              </CardContent>
            </Card>
          )}


        </motion.div>
      </div>
    </motion.div>
  )
}
