import { motion } from 'framer-motion'
import { Activity, Radio } from 'lucide-react'
import { useMemo } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { LandingSectionShell } from '@/components/landing/landing-section-shell'
import type { PublicElection } from '@/lib/landing-utils'
import type { ResultRow } from '@/services/votes.service'
import { useTheme } from '@/contexts/theme-context'

function aggregateByCandidate(rows: ResultRow[]): { name: string; votes: number }[] {
  const totals = new Map<string, { name: string; votes: number }>()
  for (const r of rows) {
    const cur = totals.get(r.candidate_id)
    const nextVotes = (cur?.votes ?? 0) + r.votes
    totals.set(r.candidate_id, { name: r.name || 'Option', votes: nextVotes })
  }
  return [...totals.values()].sort((a, b) => b.votes - a.votes).slice(0, 6)
}

type LandingLiveResultsProps = {
  liveElections: PublicElection[]
  preview: Record<string, ResultRow[]>
  voteTotals: Record<string, number>
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#f59e0b', '#a855f7']

export function LandingLiveResults({ liveElections, preview, voteTotals }: LandingLiveResultsProps) {
  const { resolved } = useTheme()
  const slides = useMemo(() => {
    return liveElections.slice(0, 4).map((e) => {
      const chart = aggregateByCandidate(preview[e.id] ?? [])
      return { election: e, chart, total: voteTotals[e.id] ?? 0 }
    })
  }, [liveElections, preview, voteTotals])

  return (
    <LandingSectionShell
      id="results"
      eyebrow="Live Results"
      title="Real-time consensus."
      description="Vote totals refresh instantly. Watch the results emerge with absolute transparency."
    >
      {slides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-border bg-card rounded-[2.5rem] shadow-sm">
          <Radio className="size-12 text-muted-foreground mb-6 opacity-20" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">No active elections found</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {slides.map(({ election, chart, total }, idx) => (
            <motion.div
              key={election.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="group rounded-[2rem] border border-border bg-card p-8 shadow-sm relative overflow-hidden"
            >
              <div className="mb-8 flex flex-wrap items-start justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">
                      Live Results
                    </p>
                  </div>
                  <h3 className="text-xl font-bold text-foreground line-clamp-1">{election.title}</h3>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-muted border border-border px-3 py-1.5 text-[10px] font-bold tracking-widest text-foreground tabular-nums">
                  <Activity className="size-3.5 text-primary" />
                  {total.toLocaleString()} votes
                </div>
              </div>
              
              {chart.length === 0 ? (
                <div className="py-12 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Awaiting initial votes</p>
                </div>
              ) : (
                <div className="h-[240px] w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                    <BarChart data={chart} layout="vertical" margin={{ left: -20, right: 10, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fill: resolved === 'dark' ? '#71717a' : '#a1a1aa', fontSize: 11, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          padding: '12px'
                        }}
                        itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={20} animationDuration={1000}>
                        {chart.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </LandingSectionShell>
  )
}
