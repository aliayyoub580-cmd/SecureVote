import { useEffect, useState, useRef } from 'react'
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
  Trophy,
  BarChart3,
  Download,
  AlertTriangle,
  Play,
  Square,
  Lock,
  Unlock,
  Ban,
  UserCheck,
  Trash2,
  Search,
  Mail,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
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
import { AnalyticsExportMenu } from '@/components/analytics/analytics-export-menu'

type Election = Database['public']['Tables']['elections']['Row']
type Candidate = Database['public']['Tables']['election_candidates']['Row']

type RegistrantRow = {
  user_id: string
  registered_at: string
  has_voted: boolean
}

type VoterRow = {
  ballot_token_id: string
  user_id: string
  registered_at: string
  has_voted: boolean
  is_blocked: boolean
  full_name: string | null
  email: string | null
  voter_public_id: string | null
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

export function SuperAdminElectionManagePage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [election, setElection] = useState<Election | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [registrants, setRegistrants] = useState<RegistrantRow[]>([])
  const [voterRows, setVoterRows] = useState<VoterRow[]>([])
  const [voterSearch, setVoterSearch] = useState('')
  const [removeTarget, setRemoveTarget] = useState<VoterRow | null>(null)
  const [winners, setWinners] = useState<PollWinnerInfo[]>([])
  const [resultsRows, setResultsRows] = useState<any[]>([])
  const [liveStats, setLiveStats] = useState({ votes_cast: 0, registered: 0, ballots_completed: 0 })
  const [actionLoading, setActionLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = async (cancelled = false) => {
    if (!id || !profile) return
    try {
      const [data, candData] = await Promise.all([
        electionsService.getById(id),
        electionsService.listCandidates(id),
      ])
      if (cancelled) return
      if (!data) {
        toast.error('Election not found')
        navigate(ROUTES.adminElections)
        return
      }
      setElection(data)
      setCandidates(candData)

      const [regs, voters, stats] = await Promise.all([
        electionsService.listRegistrants(id),
        electionsService.adminListVoters(id).catch(() => [] as VoterRow[]),
        votesService.getLiveStats(id).catch(() => ({ votes_cast: 0, registered: 0, ballots_completed: 0 })),
      ])
      if (!cancelled) {
        setRegistrants((regs as unknown as RegistrantRow[]) ?? [])
        setVoterRows(voters)
        setLiveStats(stats)
      }

      // Load winners when election has ended or is closed
      if (data.status === 'closed' || new Date(data.ends_at) < new Date()) {
        const resultRows = await votesService.getResults(id).catch(() => [])
        const sections = groupResultsByPoll(resultRows)
        if (!cancelled) {
          setResultsRows(resultRows)
          setWinners(computePollWinners(sections))
        }
      }
    } catch {
      toast.error('Failed to load election details')
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadData(cancelled)
    return () => { cancelled = true }
  }, [id, profile?.id])

  // Live polling when election is active
  useEffect(() => {
    if (election?.status === 'active') {
      pollingRef.current = setInterval(() => void loadData(), 15000)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [election?.status])

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto w-full space-y-8">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
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
  const isLive = election.status === 'active'

  const handleToggleSuspend = async () => {
    if (!id) return
    if (!window.confirm(`Are you sure you want to ${election.suspended ? 'resume' : 'suspend'} this election?`)) return
    setActionLoading(true)
    try {
      await electionsService.setSuspended(id, !election.suspended)
      toast.success(`Election ${election.suspended ? 'resumed' : 'suspended'} successfully.`)
      await loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlockVoter = async (voter: VoterRow) => {
    if (!id) return
    try {
      await electionsService.adminBlockVoter(id, voter.ballot_token_id)
      toast.success(`${voter.full_name || 'Voter'} has been blocked from voting.`)
      setVoterRows(prev => prev.map(v => v.ballot_token_id === voter.ballot_token_id ? { ...v, is_blocked: true } : v))
    } catch (e: any) {
      toast.error(e?.message || 'Failed to block voter')
    }
  }

  const handleUnblockVoter = async (voter: VoterRow) => {
    if (!id) return
    try {
      await electionsService.adminUnblockVoter(id, voter.ballot_token_id)
      toast.success(`${voter.full_name || 'Voter'} has been unblocked.`)
      setVoterRows(prev => prev.map(v => v.ballot_token_id === voter.ballot_token_id ? { ...v, is_blocked: false } : v))
    } catch (e: any) {
      toast.error(e?.message || 'Failed to unblock voter')
    }
  }

  const handleRemoveVoter = async (voter: VoterRow) => {
    if (!id) return
    try {
      await electionsService.adminRemoveVoter(id, voter.ballot_token_id)
      toast.success(`${voter.full_name || 'Voter'} removed from election.`)
      setVoterRows(prev => prev.filter(v => v.ballot_token_id !== voter.ballot_token_id))
      setRemoveTarget(null)
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.includes('already_voted')) {
        toast.error('Cannot remove a voter who has already cast their ballot.')
      } else {
        toast.error(msg || 'Failed to remove voter')
      }
      setRemoveTarget(null)
    }
  }

  const filteredVoters = voterRows.filter(v => {
    const q = voterSearch.toLowerCase()
    if (!q) return true
    return (
      (v.full_name || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.voter_public_id || '').toLowerCase().includes(q)
    )
  })

  return (
    <motion.div
      className="p-6 lg:p-10 max-w-6xl mx-auto w-full space-y-10"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Breadcrumb & Back */}
      <motion.div variants={item} className="flex items-center gap-3">
        <Button asChild variant="link" className="px-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] group">
          <Link to={ROUTES.adminElections} className="flex items-center gap-2">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            Admin Elections
          </Link>
        </Button>
        <span className="text-[var(--muted-foreground)]">/</span>
        <span className="text-sm font-semibold text-[var(--foreground)] truncate max-w-xs">{election.title}</span>
        <span className="text-[var(--muted-foreground)]">/</span>
        <span className="text-sm font-black text-rose-500">Super Admin Monitoring</span>
      </motion.div>

      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-[var(--border)] pb-8">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <ElectionStatusBadge election={election} />
            <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-[10px] font-black uppercase tracking-widest text-rose-500">
              Admin Transparency Mode
            </span>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block" /> Monitoring Live
              </span>
            )}
            {election.suspended && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-widest">
                <Lock className="size-3" /> Suspended
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">{election.title}</h1>
          <p className="text-[var(--muted-foreground)] font-medium">
            Organization: <strong className="text-[var(--foreground)]">{election.organization || 'Independent'}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Button
            variant="outline"
            className={cn("h-10 rounded-lg gap-2 text-xs font-bold uppercase tracking-widest border-[var(--border)]",
              election.suspended ? "hover:bg-emerald-500 hover:text-white" : "hover:bg-red-500 hover:text-white"
            )}
            onClick={handleToggleSuspend}
            disabled={actionLoading}
          >
            {election.suspended ? <Unlock className="size-4" /> : <Lock className="size-4" />}
            {election.suspended ? 'Resume Election' : 'Suspend Election'}
          </Button>
          <AnalyticsExportMenu electionId={id!} electionTitle={election.title} rows={resultsRows} sections={groupResultsByPoll(resultsRows)} stats={liveStats} />
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Registered Voters', value: election.registrant_count || 0, icon: Users, color: 'text-[var(--primary)]', bg: 'bg-[var(--primary)]/10 border-[var(--primary)]/20' },
          { label: 'Votes Submitted', value: votedCount, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Pending Voters', value: notVotedCount, icon: Hourglass, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Participation Rate', value: `${turnoutPct}%`, icon: Activity, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
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

      {/* Winner Banner — shown when election has ended */}
      {isEnded && winners.length > 0 && (
        <motion.div variants={item}>
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Trophy className="size-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--foreground)] uppercase tracking-widest">Election Winner</h2>
                <p className="text-xs text-[var(--muted-foreground)]">Voting Completed — verified results</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                          {w.leaders[0]?.votes} votes · {Math.round(((w.leaders[0]?.votes ?? 0) / w.totalVotesInPoll) * 100)}% of total
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
        {/* Left: Candidates + Voter Table */}
        <motion.div variants={item} className="lg:col-span-2 space-y-8">

          {/* Candidates */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[var(--border)]">
              <CardTitle className="text-lg font-bold">Candidates</CardTitle>
              <span className="px-2.5 py-1 rounded-full bg-[var(--muted)] text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                {candidates.length} Total
              </span>
            </CardHeader>
            <CardContent className="pt-4">
              {candidates.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] py-6 text-center">No candidates registered.</p>
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

          {/* Voter Management Table */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4 border-b border-[var(--border)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-3">
                    Voter Management
                    <span className="px-2.5 py-1 rounded-full bg-[var(--muted)] text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                      {voterRows.length} Registered
                    </span>
                  </CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Block or remove fake/suspicious voters · Voting selections remain hidden
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--muted-foreground)]" />
                  <Input
                    value={voterSearch}
                    onChange={e => setVoterSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="h-9 pl-8 rounded-xl text-xs bg-[var(--background)] border-[var(--border)]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {voterRows.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="size-8 text-[var(--muted-foreground)] mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-[var(--muted-foreground)]">No voters registered yet.</p>
                </div>
              ) : filteredVoters.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="size-8 text-[var(--muted-foreground)] mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-[var(--muted-foreground)]">No voters match your search.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[560px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-[var(--border)] bg-[var(--muted)]/60">
                        <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">#</th>
                        <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Voter</th>
                        <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Voter ID</th>
                        <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Registered</th>
                        <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Vote</th>
                        <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Block</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVoters.map((v, i) => (
                        <motion.tr
                          key={v.ballot_token_id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.01 }}
                          className={cn(
                            'border-b border-[var(--border)] transition-colors',
                            v.is_blocked ? 'bg-rose-500/5 hover:bg-rose-500/10' : 'hover:bg-[var(--muted)]/30'
                          )}
                        >
                          <td className="px-5 py-3 text-[var(--muted-foreground)] font-bold text-xs">{i + 1}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-[var(--foreground)] text-xs">{v.full_name || 'Unknown'}</span>
                              <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                                <Mail className="size-3" /> {v.email || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <code className="font-mono text-[10px] bg-[var(--muted)] px-2 py-0.5 rounded text-[var(--foreground)]">
                              {v.voter_public_id ? v.voter_public_id.slice(0, 12) + '…' : maskUserId(v.user_id)}
                            </code>
                          </td>
                          <td className="px-5 py-3 text-[var(--muted-foreground)] text-xs">
                            {new Date(v.registered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-3">
                            {v.has_voted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                                <CheckCircle2 className="size-3" /> Voted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase tracking-widest">
                                <Hourglass className="size-3" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {v.is_blocked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[9px] font-black uppercase tracking-widest">
                                <Ban className="size-3" /> Blocked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)] text-[9px] font-black uppercase tracking-widest">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {v.is_blocked ? (
                                <button
                                  onClick={() => void handleUnblockVoter(v)}
                                  title="Unblock voter"
                                  className="size-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                                >
                                  <UserCheck className="size-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => void handleBlockVoter(v)}
                                  title="Block voter"
                                  disabled={v.has_voted}
                                  className="size-8 rounded-lg flex items-center justify-center bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-rose-500/10 hover:text-rose-500 border border-[var(--border)] hover:border-rose-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Ban className="size-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setRemoveTarget(v)}
                                title={v.has_voted ? 'Cannot remove — already voted' : 'Remove from election'}
                                disabled={v.has_voted}
                                className="size-8 rounded-lg flex items-center justify-center bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-rose-500/10 hover:text-rose-500 border border-[var(--border)] hover:border-rose-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-6 py-4 border-t border-[var(--border)] bg-rose-500/5 flex items-center gap-3">
                <ShieldCheck className="size-4 text-rose-500 shrink-0" />
                <p className="text-[11px] text-[var(--muted-foreground)] font-medium">
                  <strong className="text-rose-500">Security Rule:</strong> Voting choices are anonymous and never exposed. Block prevents future voting; Remove only works if no ballot has been cast.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Remove Voter Confirm Dialog */}
          <AlertDialog open={!!removeTarget} onOpenChange={o => !o && setRemoveTarget(null)}>
            <AlertDialogContent className="rounded-[2rem] border-[var(--border)] bg-[var(--card)] p-10 shadow-2xl">
              <AlertDialogHeader className="space-y-4">
                <div className="size-14 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 mx-auto lg:mx-0">
                  <Trash2 className="size-7 text-rose-600" />
                </div>
                <AlertDialogTitle className="text-2xl font-bold text-[var(--foreground)] tracking-tight leading-none">Remove Voter?</AlertDialogTitle>
                <AlertDialogDescription className="text-[var(--muted-foreground)] font-medium text-base">
                  Remove <strong className="text-[var(--foreground)]">{removeTarget?.full_name || 'this voter'}</strong> ({removeTarget?.email}) from the election?
                  Their registration and voter ID will be permanently deleted. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="pt-8 gap-4">
                <AlertDialogCancel className="h-12 rounded-xl border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] px-8 font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="h-12 rounded-xl bg-rose-500 hover:bg-rose-600 text-white px-8 font-bold uppercase tracking-widest text-[10px] shadow-lg border-0"
                  onClick={() => removeTarget && void handleRemoveVoter(removeTarget)}
                >
                  Remove Voter
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>

        {/* Right: Live Monitoring */}
        <motion.div variants={item} className="space-y-6">
          {/* Live Turnout Progress */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="size-4 text-[var(--primary)]" /> Live Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-center">
                <p className="text-5xl font-black text-[var(--primary)]">{turnoutPct}%</p>
                <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-widest mt-1">Participation Progress</p>
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
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Submitted</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-lg font-black text-amber-500">{notVotedCount}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline & Countdown */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Schedule Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Voting Started', value: new Date(election.starts_at).toLocaleString(), icon: Calendar, color: 'text-[var(--primary)]' },
                { label: 'Voting Ends', value: new Date(election.ends_at).toLocaleString(), icon: Clock, color: 'text-rose-500' },
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

          {/* Admin Tools */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Transparency Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
               <Button asChild variant="outline" className="w-full justify-start h-10 rounded-xl text-xs font-bold bg-[var(--background)] border-[var(--border)]">
                 <Link to={ROUTES.adminAudit}>
                   <ShieldCheck className="size-4 mr-2 text-[var(--primary)]" />
                   View Audit Logs
                 </Link>
               </Button>
               {isEnded && (
                  <Button asChild variant="outline" className="w-full justify-start h-10 rounded-xl text-xs font-bold bg-[var(--background)] border-[var(--border)]">
                    <Link to={ROUTES.electionResults(election.id)}>
                      <BarChart3 className="size-4 mr-2 text-emerald-500" />
                      Detailed Result Analytics
                    </Link>
                  </Button>
               )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
