import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { ResultsHistoryPoint } from '@/hooks/use-results-history'

// SVG text cannot use CSS vars — use Tailwind gray-400 which reads well
// on both dark and light card backgrounds
const TICK_COLOR = '#9ca3af'

function CustomXTick(props: any) {
  const { x, y, payload } = props
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" fill={TICK_COLOR} fontSize={10}>
      {payload.value}
    </text>
  )
}

function CustomYTick(props: any) {
  const { x, y, payload } = props
  return (
    <text x={x - 4} y={y} dy={4} textAnchor="end" fill={TICK_COLOR} fontSize={10}>
      {payload.value}
    </text>
  )
}

type Props = {
  data: ResultsHistoryPoint[]
  className?: string
}

export function AnalyticsActivityLine({ data, className }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    label: format(new Date(d.t), 'HH:mm:ss'),
    short: format(new Date(d.t), 'HH:mm'),
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 }}
      className={className}
    >
      {chartData.length < 2 ? (
        <p className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-center text-sm text-muted-foreground">
          Historical trace builds as totals change while you keep this page open.
        </p>
      ) : (
        <div className="h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
              <XAxis
                dataKey="short"
                tick={<CustomXTick />}
                stroke="hsl(var(--border))"
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                width={32}
                tick={<CustomYTick />}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { label?: string } | undefined
                  return p?.label ?? ''
                }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card) / 0.96)',
                  color: 'hsl(var(--foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
                itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: TICK_COLOR }} />
              <Line
                type="monotone"
                dataKey="ballots_completed"
                name="Ballots done"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                animationDuration={700}
              />
              <Line
                type="monotone"
                dataKey="votes_cast"
                name="Vote rows"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 2 }}
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}
