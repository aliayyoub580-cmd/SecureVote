import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  Square,
  Users,
  Activity,
  Clock,
  CheckCircle2,
  Hourglass,
  Trophy,
  ShieldCheck,
  Settings,
  BarChart2,
  AlertTriangle,
  Trash2,
  ChevronRight,
  Eye,
} from 'lucide-react'
import { toast } from '@/lib/toast'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ElectionStatusBadge } from '@/modules/elections/election-status-badge'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { electionsService } from '@/services/elections.service'
import { votesService } from '@/services/votes.service'
import { groupResultsByPoll, computePollWinners, type PollWinnerInfo } from '@/lib/election-results-analytics'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Election = Database['public']['Tables']['elections']['Row']

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
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 22, stiffness: 120 } },
}

/** Mask voter ID: first 4 chars + dots + last 4 chars */
function maskUserId(uid: string): string {
  if (!uid) return '••••••••••••'
  const clean = uid.replace(/-/g, '')
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••${clean.slice(-2)}`
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`
}

export function ElectionEditPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [election, setElection] = useState<Election | null>(null)
  const [loading, setLoading] = useState(true)
  const [registrants, setRegistrants] = useState<RegistrantRow[]>([])
  const [liveStats, setLiveStats] = useState({ votes_cast: 0, registered: 0, ballots_completed: 0 })
  const [winners, setWinners] = useState<PollWinnerInfo[]>([])
  const [deleting, setDeleting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = async () => {
    if (!id || !profile) return
    try {
      const [data, regs, stats] = await Promise.all([
        electionsService.getById(id),
        electionsService.listRegistrants(id),
        votesService.getLiveStats(id).catch(() => ({ votes_cast: 0, registered: 0, ballots_completed: 0 })),
      ])
      if (!data) {
        toast.error('Election not found')
        navigate(ROUTES.electionsManage)
        return
      }
      setElection(data)
      setRegistrants((regs as unknown as RegistrantRow[]) ?? [])
      setLiveStats(stats)
      // Load results when closed to show winner
      if (data.status === 'closed' || new Date(data.ends_at) < new Date()) {
        const resultRows = await votesService.getResults(id).catch(() => [])
        const sections = groupResultsByPoll(resultRows)
        setWinners(computePollWinners(sections))
      }
    } catch {
      toast.error('Failed to load election data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
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
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (!election) return null

  const isLocked = election.status === 'active' || election.status === 'closed'
  const votedCount = registrants.filter((r) => r.has_voted).length
  const notVotedCount = registrants.length - votedCount
  const turnoutPct = registrants.length > 0 ? Math.round((votedCount / registrants.length) * 100) : 0

  const handleStartVoting = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await electionsService.creatorStartVotingNow(id)
      toast.success('Election started! Voting is now live.')
      await loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start election')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStopVoting = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await electionsService.creatorCloseVotingNow(id)
      toast.success('Election stopped. Voting is now closed.')
      await loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to stop election')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!window.confirm(`Are you sure you want to permanently delete "${election.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await electionsService.deleteForCreator(id)
      toast.success('Election deleted.')
      navigate(ROUTES.electionsManage)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete election')
      setDeleting(false)
    }
  }

  return (
    <motion.div
      className="p-6 lg:p-10 max-w-6xl mx-auto w-full space-y-10"
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
        <span className="text-[var(--muted-foreground)]">/</span>
        <span className="text-sm font-black text-[var(--primary)]">Manage</span>
      </motion.div>

      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-8 border-b border-[var(--border)]">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <ElectionStatusBadge election={election} />
            {election.status === 'active' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block" /> Live
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">{election.title}</h1>
          <p className="text-[var(--muted-foreground)] font-medium">
            {election.organization || 'Independent Campaign'} · Control Panel
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Button asChild variant="outline" className="h-10 rounded-lg gap-2 text-xs font-bold uppercase tracking-widest bg-[var(--card)] border-[var(--border)]">
            <Link to={ROUTES.electionCreatorView(election.id)}>
              <BarChart2 className="size-4" /> View Report
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-lg gap-2 text-xs font-bold uppercase tracking-widest bg-[var(--card)] border-[var(--border)]">
            <Link to={ROUTES.electionDetail(election.id)}>
              <Eye className="size-4" /> Public View
            </Link>
          </Button>
          {!isLocked && (
            <Button asChild className="btn-primary h-10 rounded-lg gap-2 text-xs font-bold uppercase tracking-widest">
              <Link to={ROUTES.electionWizard(election.id)}>
                <Settings className="size-4" /> Edit Setup
              </Link>
            </Button>
          )}
        </div>
      </motion.div>

      {/* Live Stats Row */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Registered', value: election.registrant_count || 0, sub: election.max_voters ? `/ ${election.max_voters} max` : 'voters', icon: Users, color: 'text-[var(--primary)]', bg: 'bg-[var(--primary)]/10 border-[var(--primary)]/20' },
          { label: 'Waitlisted', value: election.waitlist_count || 0, sub: 'on queue', icon: Hourglass, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Votes Cast', value: votedCount, sub: 'completed ballots', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Turnout', value: `${turnoutPct}%`, sub: `${notVotedCount} not voted`, icon: Activity, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
        ].map((s) => (
          <Card key={s.label} className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('size-9 rounded-lg flex items-center justify-center border shrink-0', s.bg)}>
                  <s.icon className={cn('size-4', s.color)} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">{s.label}</p>
              </div>
              <p className={cn('text-3xl font-black', s.color)}>{s.value}</p>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Winner Banner — shown when election is closed */}
      {(election.status === 'closed' || new Date(election.ends_at) < new Date()) && winners.length > 0 && (
        <motion.div variants={item}>
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Trophy className="size-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--foreground)] uppercase tracking-widest">Election Results</h2>
                <p className="text-xs text-[var(--muted-foreground)]">Final winners — voting is now closed</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {winners.map((w, i) => (
                <div key={i} className="rounded-xl bg-[var(--card)] border border-amber-500/20 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">{w.pollTitle}</p>
                  {w.leaders.length === 0 || w.totalVotesInPoll === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">No votes recorded</p>
                  ) : w.isTie ? (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Tie</span>
                      {w.leaders.map((l) => (
                        <p key={l.candidate_id} className="font-black text-[var(--foreground)]">{l.name} <span className="text-[var(--muted-foreground)] font-normal text-xs">— {l.votes} votes</span></p>
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

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Voter Table */}
        <motion.div variants={item} className="lg:col-span-2 space-y-6">

          {/* Voter Participation Table */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <div>
                <CardTitle className="text-lg font-bold">Voter Access Log</CardTitle>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Registration & voting status · Candidate selections are never shown · Voter IDs are masked for privacy
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {registrants.length === 0 ? (
                <div className="py-14 text-center">
                  <Users className="size-8 text-[var(--muted-foreground)] mx-auto mb-3 opacity-30" />
                  <p className="text-sm text-[var(--muted-foreground)]">No voters registered yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">#</th>
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Voter ID</th>
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Registered On</th>
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Vote Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrants.map((r, i) => (
                        <motion.tr
                          key={r.user_id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.025 }}
                          className="border-b border-[var(--border)] hover:bg-[var(--muted)]/30 transition-colors"
                        >
                          <td className="px-6 py-3 text-[var(--muted-foreground)] font-bold text-xs">{i + 1}</td>
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
                  <strong className="text-[var(--foreground)]">Voting is anonymous.</strong> You can only see who voted — never what they selected.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Turnout Bar */}
          {registrants.length > 0 && (
            <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Live Turnout</p>
                  <p className="text-lg font-black text-[var(--primary)]">{turnoutPct}%</p>
                </div>
                <div className="h-3 rounded-full bg-[var(--muted)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${turnoutPct}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="h-full rounded-full bg-[var(--primary)]"
                  />
                </div>
                <div className="flex gap-4 text-xs text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500 inline-block" />{votedCount} voted</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500 inline-block" />{notVotedCount} pending</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--border)] inline-block" />{election.registrant_count || 0} total</span>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Right: Controls */}
        <motion.div variants={item} className="space-y-6">

          {/* Election Controls */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Election Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Force Start */}
              {election.status !== 'active' && election.status !== 'closed' ? (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black h-11 rounded-xl text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all gap-2"
                  onClick={handleStartVoting}
                  disabled={actionLoading}
                >
                  <Play className="size-4" strokeWidth={3} />
                  {actionLoading ? 'Starting...' : 'Force Start Voting'}
                </Button>
              ) : (
                <Button
                  disabled
                  className="w-full font-black h-11 rounded-xl text-[10px] uppercase tracking-widest opacity-40 cursor-not-allowed gap-2"
                  variant="outline"
                >
                  <Play className="size-4" strokeWidth={3} /> Force Start Voting
                </Button>
              )}

              {/* Stop */}
              {election.status === 'active' || election.status === 'approved' ? (
                <Button
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black h-11 rounded-xl text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(244,63,94,0.15)] transition-all gap-2"
                  onClick={handleStopVoting}
                  disabled={actionLoading}
                >
                  <Square className="size-4" strokeWidth={3} />
                  {actionLoading ? 'Stopping...' : 'Stop Voting Now'}
                </Button>
              ) : (
                <Button
                  disabled
                  className="w-full font-black h-11 rounded-xl text-[10px] uppercase tracking-widest opacity-40 cursor-not-allowed gap-2"
                  variant="outline"
                >
                  <Square className="size-4" strokeWidth={3} /> Stop Voting Now
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Voting Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                <Clock className="size-4 text-[var(--primary)] shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Starts</p>
                  <p className="text-sm font-semibold">{new Date(election.starts_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                <Clock className="size-4 text-rose-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Ends</p>
                  <p className="text-sm font-semibold">{new Date(election.ends_at).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-between h-11 rounded-xl bg-[var(--background)] border-[var(--border)] text-xs font-bold">
                <Link to={ROUTES.electionCandidates(election.id)}>
                  <span className="flex items-center gap-2"><Users className="size-4 text-[var(--primary)]" /> Candidate Management</span>
                  <ChevronRight className="size-4 text-[var(--muted-foreground)]" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between h-11 rounded-xl bg-[var(--background)] border-[var(--border)] text-xs font-bold">
                <Link to={ROUTES.electionCreatorView(election.id)}>
                  <span className="flex items-center gap-2"><BarChart2 className="size-4 text-emerald-500" /> View Election Report</span>
                  <ChevronRight className="size-4 text-[var(--muted-foreground)]" />
                </Link>
              </Button>
              {!isLocked && (
                <Button asChild variant="outline" className="w-full justify-between h-11 rounded-xl bg-[var(--background)] border-[var(--border)] text-xs font-bold">
                  <Link to={`${ROUTES.electionWizard(election.id)}?step=0`}>
                    <span className="flex items-center gap-2"><Settings className="size-4 text-sky-500" /> Edit Election Details</span>
                    <ChevronRight className="size-4 text-[var(--muted-foreground)]" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full justify-between h-11 rounded-xl bg-[var(--background)] border-[var(--border)] text-xs font-bold">
                <Link to={ROUTES.electionResults(election.id)}>
                  <span className="flex items-center gap-2"><Activity className="size-4 text-amber-500" /> Results & Analytics</span>
                  <ChevronRight className="size-4 text-[var(--muted-foreground)]" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="saas-card bg-[var(--card)] border-rose-500/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-rose-500">
                <AlertTriangle className="size-4" /> Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--muted-foreground)] mb-4">
                Permanently delete this election and all its data. This action cannot be undone.
              </p>
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500 text-xs font-black uppercase tracking-widest gap-2"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="size-4" />
                {deleting ? 'Deleting...' : 'Delete Election'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
