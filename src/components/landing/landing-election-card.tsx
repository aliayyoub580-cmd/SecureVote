import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { BarChart2, Clock, ArrowUpRight, ShieldCheck, Search, Lock, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import { useCountdown } from '@/hooks/use-countdown'
import { getDisplayPhase } from '@/lib/election-utils'
import type { PublicElection } from '@/lib/landing-utils'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { printVoteLedgerPdf } from '@/lib/results-export'
import { votesService as vs } from '@/services/votes.service'

type LandingElectionCardProps = {
  election: PublicElection
  voteCount: number
  className?: string
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

function CountdownPill({ targetIso, label }: { targetIso: string; label: string }) {
  const target = new Date(targetIso).getTime()
  const cd = useCountdown(target)
  if (!cd || cd.done) return <span className="text-muted-foreground font-bold">{label} ended</span>
  const parts = [
    cd.days > 0 ? `${cd.days}d` : null,
    `${cd.hours}h`,
    `${String(cd.minutes).padStart(2, '0')}m`,
    `${String(cd.seconds).padStart(2, '0')}s`,
  ].filter(Boolean)
  return <span className="font-mono text-sm font-black tabular-nums tracking-tighter text-foreground">{parts.join(' : ')}</span>
}

export function LandingElectionCard({ election, voteCount, className }: LandingElectionCardProps) {
  const [ledger, setLedger] = useState<{ voter_code: string; candidate_name: string; poll_title: string; voted_at: string }[]>([])
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Load ledger details immediately when modal opens
  useEffect(() => {
    if (isOpen) {
      void (async () => {
        setLoadingLedger(true)
        try {
          if (String(election.id).startsWith('mock-')) {
            setLedger([
              { voter_code: 'POLL-G-3ACF0001', candidate_name: 'Alice Johnson', poll_title: 'Executive Seat', voted_at: new Date().toISOString() },
              { voter_code: 'POLL-G-F29D0002', candidate_name: 'Bob Smith', poll_title: 'Executive Seat', voted_at: new Date(Date.now() - 3600000).toISOString() },
              { voter_code: 'POLL-G-A87E0003', candidate_name: 'Alice Johnson', poll_title: 'Executive Seat', voted_at: new Date(Date.now() - 7200000).toISOString() },
            ])
            return
          }
          const data = await vs.getVoteLedger(election.id).catch((err) => {
            console.error('[getVoteLedger Error]:', err)
            return []
          })
          setLedger(data)
        } finally {
          setLoadingLedger(false)
        }
      })()
    } else {
      setLedger([])
    }
  }, [isOpen, election.id])

  const filteredLedger = useMemo(() => {
    if (!ledgerSearch.trim()) return ledger
    const q = ledgerSearch.toLowerCase()
    return ledger.filter(
      (r) =>
        r.voter_code.toLowerCase().includes(q) ||
        r.candidate_name.toLowerCase().includes(q) ||
        r.poll_title.toLowerCase().includes(q)
    )
  }, [ledger, ledgerSearch])

  const phase = getDisplayPhase(election)
  const max = election.max_voters
  const turnoutPct = max && max > 0 ? Math.min(100, Math.round((voteCount / max) * 100)) : null

  const badge =
    phase === 'voting' ? (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        Voting Live
      </span>
    ) : phase === 'scheduled' ? (
      <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600">
        Coming Soon
      </span>
    ) : (
      <span className="rounded-full bg-muted border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Completed
      </span>
    )

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -8, scale: 1.025, borderColor: 'hsl(var(--primary))', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm transition-all duration-300',
        className,
      )}
    >
      <div className="relative p-6 lg:p-8 flex-1 flex flex-col">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          {badge}
          {election.category ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
              {election.category}
            </span>
          ) : null}
        </div>
        
        <h3 className="text-xl font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-2">
          {election.title}
        </h3>
        
        {election.organization ? (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="size-3.5" /> {election.organization}
          </p>
        ) : null}
        
        {election.description ? (
          <p className="mt-4 line-clamp-2 text-sm font-medium leading-relaxed text-muted-foreground">{election.description}</p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="uppercase tracking-widest text-[9px] font-bold text-muted-foreground">Starts</span>
            <span className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Clock className="size-3.5 text-primary" />
              {format(new Date(election.starts_at), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="uppercase tracking-widest text-[9px] font-bold text-muted-foreground">Total Votes</span>
            <span className="flex items-center gap-2 text-xs font-bold text-foreground">
              <BarChart2 className="size-3.5 text-emerald-500" />
              {voteCount.toLocaleString()}
            </span>
          </div>
        </div>

        {turnoutPct != null ? (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Turnout</span>
              <span className="text-xs font-black tabular-nums text-foreground">{turnoutPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted border border-border">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                whileInView={{ width: `${turnoutPct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-auto pt-6">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {phase === 'voting' ? 'Closes in' : phase === 'scheduled' ? 'Starts in' : 'Ended on'}
              </span>
              {phase === 'voting' ? (
                <CountdownPill targetIso={election.ends_at} label="Voting" />
              ) : phase === 'scheduled' ? (
                <CountdownPill targetIso={election.starts_at} label="Start" />
              ) : (
                <span className="text-xs font-bold text-foreground">
                  {format(new Date(election.ends_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="mt-4 w-full h-11 rounded-xl bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary hover:text-primary font-bold uppercase tracking-widest text-[9px] gap-2"
              >
                <ShieldCheck className="size-4" />
                Verify Audit Ledger
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 text-white rounded-[2rem] p-6 lg:p-8">
              <DialogHeader className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/5">
                    <ShieldCheck className="size-5 text-primary" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Decentralized Audit Trail</div>
                </div>
                <DialogTitle className="text-2xl font-black text-white tracking-tight leading-none">{election.title}</DialogTitle>
                <p className="text-zinc-500 font-medium text-sm">
                  This public verification ledger displays cryptographically masked voter ID credentials mapping to their designated selections.
                </p>
              </DialogHeader>

              <div className="mt-6 flex items-center gap-4">
                <div className="relative group flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Search Voter ID..."
                    className="h-10 w-full rounded-xl bg-zinc-900 border border-white/10 pl-9 pr-4 text-sm font-medium focus:ring-primary/20 focus:border-primary/50 text-white transition-all"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => {
                    printVoteLedgerPdf({
                      electionTitle: election.title,
                      electionId: election.id,
                      stats: null,
                      ledger
                    })
                  }}
                  disabled={ledger.length === 0}
                  className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-[10px] uppercase tracking-widest gap-2"
                >
                  Download PDF
                </Button>
              </div>

              <div className="mt-6 border border-white/5 rounded-xl bg-zinc-900/30 overflow-hidden max-h-[300px] overflow-y-auto">
                {loadingLedger ? (
                  <div className="py-12 text-center text-zinc-500 text-xs font-semibold">Loading verification block data...</div>
                ) : filteredLedger.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-xs font-semibold">
                    {ledger.length === 0 ? 'No votes recorded for this election yet.' : 'No matching audit records found.'}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left text-xs text-zinc-300">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Voter Code</th>
                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Candidate Choice</th>
                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredLedger.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="p-4 font-mono font-bold text-white tracking-wider">
                            {maskPublicId(row.voter_code)}
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary">
                              {row.candidate_name}
                            </span>
                          </td>
                          <td className="p-4 text-zinc-500 text-[10px] font-semibold">
                            {new Date(row.voted_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border mt-auto">
        <Button asChild variant="ghost" className="h-14 rounded-none bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-[10px]">
          <Link to={ROUTES.login}>Sign In</Link>
        </Button>
        <Button asChild variant="ghost" className="h-14 rounded-none bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-[10px] group/btn">
          <Link to={ROUTES.register} className="flex items-center justify-center gap-2">
            Join Now <ArrowUpRight className="size-3.5 opacity-50 group-hover/btn:opacity-100 transition-all" />
          </Link>
        </Button>
      </div>
    </motion.article>
  )
}
