import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Activity, BarChart3, Users, ArrowRight, Sparkles, TrendingUp, ShieldCheck, Globe, Zap, Database, Loader2, ArrowLeft, Share2, Search } from 'lucide-react'
import { motion, type Variants } from 'framer-motion'

import { Input } from '@/components/ui/input'
import { AnalyticsActivityLine } from '@/components/analytics/analytics-activity-line'
import { AnalyticsExportMenu } from '@/components/analytics/analytics-export-menu'
import { AnalyticsGlassCard } from '@/components/analytics/analytics-glass-card'
import { AnalyticsInsightsList } from '@/components/analytics/analytics-insights-list'
import { AnalyticsPollChartsBlock } from '@/components/analytics/analytics-poll-charts'
import { AnalyticsStatTile } from '@/components/analytics/analytics-stat-tile'
import { AnalyticsTurnoutBars } from '@/components/analytics/analytics-turnout-bars'
import { Button } from '@/components/ui/button'
import { CardDescription, CardHeader, CardTitle, Card } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useElectionResultsLive } from '@/hooks/use-election-results-live'
import { useResultsHistory } from '@/hooks/use-results-history'
import {
  buildElectionInsights,
  computePollWinners,
  groupResultsByPoll,
  sumVoteRows,
  turnoutParticipationPercent,
  turnoutVsCapPercent,
} from '@/lib/election-results-analytics'
import { getDisplayPhase, phaseLabel } from '@/lib/election-utils'
import { cn } from '@/lib/utils'
import { electionsService } from '@/services/elections.service'
import type { ElectionLiveStats, ResultRow } from '@/services/votes.service'
import { votesService as vs } from '@/services/votes.service'
import type { Database as DBType } from '@/types/database'
import { printVoteLedgerPdf } from '@/lib/results-export'

type ElectionRow = DBType['public']['Tables']['elections']['Row']

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

function maskPublicId(id: string) {
  if (!id) return 'POLL-••••••••'
  const parts = id.split('-')
  if (parts.length < 3) return id
  const segment = parts[1]
  const tail = parts[2]
  if (tail.length < 8) return id
  const seq = tail.substring(4)
  return `POLL-${segment}-••••${seq}`
}

export function ResultsPage() {
  const { id } = useParams()
  const [election, setElection] = useState<ElectionRow | null>(null)
  const [rows, setRows] = useState<ResultRow[]>([])
  const [stats, setStats] = useState<ElectionLiveStats | null>(null)
  const [ledger, setLedger] = useState<{ voter_code: string; candidate_name: string; poll_title: string; voted_at: string; comment?: string | null }[]>([])
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!id) return
    try {
      const [e, r, s, l] = await Promise.all([
        electionsService.getById(id),
        vs.getResults(id),
        vs.getLiveStats(id),
        vs.getVoteLedger(id).catch(() => [])
      ])
      setElection(e)
      setRows(r)
      setStats(s)
      setLedger(l)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useElectionResultsLive(id, () => {
    void refresh()
  })

  const history = useResultsHistory(id, stats)

  const sections = useMemo(() => groupResultsByPoll(rows), [rows])
  const winners = useMemo(() => computePollWinners(sections), [sections])
  const displayPhase = election ? getDisplayPhase(election) : null
  const isOfficialResult = displayPhase === 'ended' || election?.status === 'closed'

  const filteredLedger = useMemo(() => {
    if (!ledgerSearch.trim()) return ledger
    const q = ledgerSearch.toLowerCase()
    return ledger.filter(
      (r) =>
        r.voter_code.toLowerCase().includes(q) ||
        r.candidate_name.toLowerCase().includes(q) ||
        r.poll_title.toLowerCase().includes(q) ||
        (r.comment && r.comment.toLowerCase().includes(q))
    )
  }, [ledger, ledgerSearch])
  const isLiveWindow = displayPhase === 'voting'

  const voteRowTotal = useMemo(() => sumVoteRows(rows), [rows])
  const participationPct = stats ? turnoutParticipationPercent(stats) : 0
  const capPct = stats && election ? turnoutVsCapPercent(stats, election.max_voters) : null

  const insights = useMemo(
    () =>
      buildElectionInsights({
        sections,
        winners,
        stats,
        phaseLabel: displayPhase ? phaseLabel(displayPhase) : 'Unknown',
      }),
    [sections, winners, stats, displayPhase],
  )

  if (!id) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="size-12 animate-spin text-primary" />
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Syncing Results Data...</p>
        </div>
      </div>
    )
  }

  const title = election?.title ?? 'Election Results'

  return (
    <motion.div 
      className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-12 bg-transparent"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* 1. TOP: Navigation & Hero */}
      <motion.div variants={item} className="space-y-10 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" className="h-11 px-6 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all group">
            <Link to={ROUTES.elections} className="flex items-center gap-3">
              <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
              Back to Elections
            </Link>
          </Button>
          <div className="flex items-center gap-3">
             <Button variant="outline" className="h-11 size-11 rounded-2xl border-border bg-card hover:bg-muted p-0">
               <Share2 className="size-4 text-foreground" />
             </Button>
             <AnalyticsExportMenu electionId={id} electionTitle={title} rows={rows} sections={sections} stats={stats} />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 border-b border-border pb-16 relative z-10">
          <div className="space-y-6 flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest shadow-lg shadow-primary/5">
                <Activity className="size-3.5 animate-pulse" />
                Live Performance
              </div>
              {isLiveWindow && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[10px] font-black text-[var(--accent-primary)] uppercase tracking-widest">
                  <Globe className="size-3.5 animate-spin-slow" />
                  Synchronized
                </div>
              )}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter leading-[0.9]">
              Election <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-500">Results.</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl font-medium text-xl leading-relaxed">
              Real-time analytics and participation dynamics for <span className="text-foreground font-black">{title}</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
             <Button asChild variant="outline" className="w-full sm:w-auto h-16 px-10 rounded-2xl border-border bg-card hover:bg-muted text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95">
                <Link to={ROUTES.electionVote(id)} className="flex items-center justify-center w-full h-full">Cast Vote</Link>
             </Button>
             <Button asChild className="btn-primary w-full sm:w-auto h-16 px-10 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95">
                <Link to={ROUTES.electionDetail(id)} className="flex items-center justify-center gap-3 w-full h-full">
                   Return to Election <ArrowRight className="size-4" />
                </Link>
             </Button>
          </div>
        </div>
        
        {/* Decorative Background Light */}
        <div className="absolute top-0 right-0 -mr-32 -mt-32 size-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      </motion.div>

      {/* 2. STATS TILES: 4-Column Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={item}>
          <AnalyticsStatTile
            icon={TrendingUp}
            label="Total Votes"
            value={voteRowTotal}
            hint="Across all polls"
            delay={0}
          />
        </motion.div>
        <motion.div variants={item}>
          <AnalyticsStatTile
            icon={Users}
            label="Voter Turnout"
            value={stats?.ballots_completed ?? '—'}
            hint="Completed ballots"
            delay={0.1}
          />
        </motion.div>
        <motion.div variants={item}>
          <AnalyticsStatTile
            icon={Zap}
            label="Participation Rate"
            value={stats ? `${participationPct}%` : '—'}
            hint="Voter turnout percentage"
            delay={0.2}
            className="text-[var(--accent-primary)]"
          />
        </motion.div>
        <motion.div variants={item}>
          <AnalyticsStatTile
            icon={ShieldCheck}
            label="Election Phase"
            value={displayPhase ? phaseLabel(displayPhase) : '—'}
            hint={election?.suspended ? 'Election suspended' : 'Election active'}
            delay={0.3}
            className={cn(election?.suspended ? 'text-[var(--accent-danger)]' : 'text-primary')}
          />
        </motion.div>
      </div>

      {/* 3. MAIN ANALYTICS: Split View */}
      <div className="grid gap-12 lg:grid-cols-12">
        {/* Sidebar: Insights & Engagement */}
        <motion.div variants={item} className="lg:col-span-4 space-y-12">
          <AnalyticsGlassCard className="saas-card bg-card/40 border-border">
            <CardHeader className="p-10 pb-8 border-b border-border">
              <div className="flex items-center gap-4 mb-3">
                <div className="size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <Sparkles className="size-6 text-amber-500" />
                </div>
                <CardTitle className="text-2xl font-black text-foreground tracking-tight">Election Insights</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground font-medium">Automated insights and pattern detection for this election.</CardDescription>
            </CardHeader>
            <div className="p-10">
              <AnalyticsInsightsList insights={insights} />
            </div>
          </AnalyticsGlassCard>

          <AnalyticsGlassCard className="saas-card bg-card/40 border-border">
            <CardHeader className="p-10 pb-8 border-b border-border">
              <div className="flex items-center gap-4 mb-3">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Activity className="size-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-black text-foreground tracking-tight">Engagement</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground font-medium">Voter participation and turnout progress.</CardDescription>
            </CardHeader>
            <div className="p-10">
              <AnalyticsTurnoutBars participationPct={participationPct} capPct={capPct} />
              {election?.max_voters != null && election.max_voters > 0 && (
                <div className="mt-10 pt-8 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Limit</span>
                  <span className="text-lg font-black text-foreground tabular-nums tracking-tighter">{election.max_voters} Voters</span>
                </div>
              )}
            </div>
          </AnalyticsGlassCard>
        </motion.div>

        {/* Main: Voting Activity Chart */}
        <motion.div variants={item} className="lg:col-span-8">
          <AnalyticsGlassCard className="saas-card h-full bg-card/40 border-border">
            <CardHeader className="p-10 pb-8 border-b border-border">
              <div className="flex items-center gap-4 mb-3">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <TrendingUp className="size-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-black text-foreground tracking-tight">Voting Activity</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground font-medium">Distribution of vote submissions over time.</CardDescription>
            </CardHeader>
            <div className="p-10 h-[500px]">
              <AnalyticsActivityLine data={history} />
            </div>
          </AnalyticsGlassCard>
        </motion.div>
      </div>

      {/* 4. CLUSTER BREAKDOWN: Poll Results */}
      <div className="space-y-12">
        <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border pb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center border border-border">
                <Database className="size-5 text-primary" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground">Poll Results</span>
            </div>
            <h2 className="text-5xl font-black text-foreground tracking-tighter leading-none">Results Breakdown</h2>
            <p className="text-muted-foreground font-medium text-lg max-w-3xl">Granular vote distribution across each poll.</p>
          </div>
        </motion.div>

        <div className="grid gap-12">
          {sections.length === 0 ? (
            <motion.div variants={item}>
              <Card className="saas-card p-32 text-center border-dashed border-border bg-card/40">
                <div className="flex flex-col items-center gap-10">
                  <div className="size-20 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground border border-border">
                    <BarChart3 className="size-10" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-foreground tracking-tight">Results Data Locked</h3>
                    <p className="text-muted-foreground font-medium max-w-md mx-auto">
                      {election?.suspended
                        ? 'The election is currently suspended. Vote recording is paused.'
                        : 'System online. Awaiting first ballot submission.'}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : (
            sections.map((sec, i) => (
              <motion.div key={`${sec.pollId ?? sec.pollTitle}-${i}`} variants={item}>
                <AnalyticsPollChartsBlock
                  sectionTitle={sec.pollTitle}
                  list={sec.rows}
                  sectionIndex={i}
                  winner={winners[i]}
                  isOfficial={isOfficialResult}
                />
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* 5. CRYPTOGRAPHIC LEDGER: Who voted for whom */}
      <div className="space-y-12 mt-20">
        <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border pb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center border border-border">
                <ShieldCheck className="size-5 text-primary" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground">Verification Ledger</span>
            </div>
            <h2 className="text-5xl font-black text-foreground tracking-tighter leading-none">Voter Decisions</h2>
            <p className="text-muted-foreground font-medium text-lg max-w-3xl">Verified ledger trail mapping masked voter public IDs to their designated candidates.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative group w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search ledger or comments..."
                className="h-11 w-full rounded-2xl bg-card border border-border pl-9 pr-4 text-sm font-medium focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/60 text-foreground"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
            </div>
            <Button
              onClick={() => {
                printVoteLedgerPdf({
                  electionTitle: election?.title ?? 'Election',
                  electionId: id ?? '',
                  stats,
                  ledger
                })
              }}
              disabled={ledger.length === 0}
              className="btn-primary h-11 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2"
            >
              <Share2 className="size-4" />
              Download Audit PDF
            </Button>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <AnalyticsGlassCard className="saas-card bg-card/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-foreground/80">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Masked Voter Code</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Position / Poll</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Choice Selected</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Comment</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-16 text-center text-muted-foreground font-medium">
                        {ledger.length === 0 
                          ? 'No verified ballots have been submitted for this election yet.' 
                          : 'No matching audit records found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors">
                        <td className="p-6 font-mono font-bold text-foreground text-xs tracking-wider">
                          {maskPublicId(row.voter_code)}
                        </td>
                        <td className="p-6 text-muted-foreground font-medium">{row.poll_title}</td>
                        <td className="p-6">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
                            {row.candidate_name}
                          </span>
                        </td>
                        <td className="p-6">
                          {row.comment ? (
                            <p className="text-foreground text-xs italic bg-muted/40 border border-border px-3 py-1.5 rounded-xl max-w-[240px] break-words whitespace-normal leading-relaxed shadow-inner">
                              "{row.comment}"
                            </p>
                          ) : (
                            <span className="text-muted-foreground/40 font-semibold">—</span>
                          )}
                        </td>
                        <td className="p-6 text-muted-foreground text-xs font-semibold">
                          {new Date(row.voted_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </AnalyticsGlassCard>
        </motion.div>
      </div>

      {/* Decorative Glow */}
      <div className="fixed bottom-0 left-0 -mb-48 -ml-48 size-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
    </motion.div>
  )
}
