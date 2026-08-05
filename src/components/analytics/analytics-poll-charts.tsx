import { motion } from 'framer-motion'
import { Award, Scale, Trophy } from 'lucide-react'
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { CardContent } from '@/components/ui/card'
import { AnalyticsGlassCard } from '@/components/analytics/analytics-glass-card'
import type { PollWinnerInfo } from '@/lib/election-results-analytics'
import { cn } from '@/lib/utils'
import type { ResultRow } from '@/services/votes.service'

export const ANALYTICS_CHART_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#059669',
  '#d97706',
  '#db2777',
  '#0d9488',
  '#4f46e5',
  '#ea580c',
]

// SVG elements cannot use CSS variables — use a neutral grey that is
// legible on both dark and light card backgrounds.
const TICK_COLOR = '#9ca3af' // Tailwind gray-400

// Custom XAxis tick — renders angled text in the correct colour
function CustomXTick(props: any) {
  const { x, y, payload } = props
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="end"
        fill={TICK_COLOR}
        fontSize={10}
        transform="rotate(-20)"
      >
        {payload.value}
      </text>
    </g>
  )
}

// Custom YAxis tick
function CustomYTick(props: any) {
  const { x, y, payload } = props
  return (
    <text x={x - 4} y={y} dy={4} textAnchor="end" fill={TICK_COLOR} fontSize={11}>
      {payload.value}
    </text>
  )
}

type PollChartsBlockProps = {
  sectionTitle: string
  description?: string
  list: ResultRow[]
  sectionIndex: number
  winner: PollWinnerInfo | undefined
  isOfficial: boolean
}

export function AnalyticsPollChartsBlock({
  sectionTitle,
  description,
  list,
  sectionIndex,
  winner,
  isOfficial,
}: PollChartsBlockProps) {
  const pieData = list.map((r, i) => ({
    name: r.name,
    value: r.votes,
    fill: ANALYTICS_CHART_COLORS[(i + sectionIndex * 2) % ANALYTICS_CHART_COLORS.length],
  }))

  const subtotal = list.reduce((s, r) => s + r.votes, 0)

  // Tooltip uses a regular HTML div — CSS vars resolve fine here
  const tooltipStyle = {
    borderRadius: 12,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card) / 0.96)',
    color: 'hsl(var(--foreground))',
  }

  return (
    <AnalyticsGlassCard delay={sectionIndex + 1} className="overflow-hidden">
      {/* ── Section Header ── */}
      <div className="border-b border-border/40 bg-muted/20 px-6 py-5 space-y-3">
        {/* Title + description */}
        <div>
          <h3 className="text-lg font-bold text-foreground tracking-tight leading-snug">
            {sectionTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground font-medium">
            {description ?? 'Anonymous tallies for this ballot section.'}
          </p>
        </div>

        {/* Winner badge — always below title on its own row */}
        {winner && winner.totalVotesInPoll > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'inline-flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm w-full sm:w-auto',
              winner.isTie
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-emerald-500/35 bg-emerald-500/10',
            )}
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {winner.isTie
                ? <Scale className="size-3.5" />
                : <Trophy className="size-3.5 text-amber-500" />}
              {isOfficial
                ? winner.isTie ? 'Tie — Official Result' : 'Winner'
                : winner.isTie ? 'Tie — Provisional' : 'Currently Leading'}
            </span>
            <span className="font-bold text-foreground text-base leading-snug">
              {winner.leaders.map((l) => l.name).join(' · ')}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                ({winner.leaders[0]?.votes ?? 0} vote
                {(winner.leaders[0]?.votes ?? 0) === 1 ? '' : 's'})
              </span>
            </span>
          </motion.div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <Award className="size-3.5 shrink-0" />
            No votes in this section yet.
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      <CardContent className="grid gap-8 p-4 pt-6 lg:grid-cols-2">
        {/* Bar Chart */}
        <div className="h-[min(360px,55vw)] min-h-[220px] w-full min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={list} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <XAxis
                dataKey="name"
                tick={<CustomXTick />}
                stroke="hsl(var(--border))"
                interval={0}
                height={60}
              />
              <YAxis
                allowDecimals={false}
                width={36}
                tick={<CustomYTick />}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.15)' }}
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
                itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                animationDuration={200}
              />
              <Bar dataKey="votes" radius={[8, 8, 0, 0]} animationDuration={700}>
                {list.map((_, i) => (
                  <Cell
                    key={`cell-bar-${i}`}
                    fill={
                      ANALYTICS_CHART_COLORS[(i + sectionIndex * 2) % ANALYTICS_CHART_COLORS.length]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut / Pie Chart */}
        <div className="h-[min(360px,55vw)] min-h-[220px] w-full min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={96}
                paddingAngle={2}
                animationDuration={800}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-pie-${entry.name}-${index}`}
                    fill={
                      entry.fill ?? ANALYTICS_CHART_COLORS[index % ANALYTICS_CHART_COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
                itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: TICK_COLOR }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Footer */}
        <div className="col-span-full flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4 text-sm text-muted-foreground lg:col-span-2">
          <span>
            Section total:{' '}
            <span className="font-semibold text-foreground">{subtotal}</span> vote rows
          </span>
        </div>
      </CardContent>
    </AnalyticsGlassCard>
  )
}
