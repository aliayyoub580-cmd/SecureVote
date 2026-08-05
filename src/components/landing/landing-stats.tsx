import { motion } from 'framer-motion'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp, Calendar, CheckCircle2, Activity, Zap, ShieldCheck, Vote } from 'lucide-react'

import { LandingSectionShell } from '@/components/landing/landing-section-shell'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

type LandingStatsStripProps = {
  totalPublished: number
  live: number
  upcoming: number
  completed: number
  totalVotes: number
}

export function LandingStatsStrip({ totalPublished, live, upcoming, completed, totalVotes }: LandingStatsStripProps) {
  const items = [
    { label: 'Total Elections', value: totalPublished, icon: Vote, color: 'text-primary' },
    { label: 'Active Voting', value: live, icon: Activity, color: 'text-emerald-500' },
    { label: 'Coming Soon', value: upcoming, icon: Calendar, color: 'text-blue-500' },
    { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-muted-foreground' },
    { label: 'Total Ballots', value: totalVotes, icon: ShieldCheck, color: 'text-indigo-500' },
  ]
  return (
    <div className="relative border-y border-border bg-muted/30 py-20 mt-20 overflow-hidden transition-colors duration-500">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8 justify-items-center">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group text-center"
            >
              <div className="mb-4 flex justify-center">
                <div className={cn(
                  "p-3 rounded-xl bg-card border border-border shadow-sm transition-transform group-hover:scale-110", 
                  item.color
                )}>
                  {item.icon && <item.icon className="size-5" />}
                </div>
              </div>
              <motion.div
                key={item.value}
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 + i * 0.1 }}
              >
                <p className="text-4xl font-black tracking-tighter text-foreground md:text-5xl tabular-nums mb-1">
                  {item.value.toLocaleString()}
                </p>
              </motion.div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

type LandingStatsChartsProps = {
  live: number
  upcoming: number
  completed: number
  totalVotes: number
}

const COLORS = ['#10b981', '#3b82f6', '#6366f1']

export function LandingStatsCharts({ live, upcoming, completed, totalVotes }: LandingStatsChartsProps) {
  const { resolved } = useTheme()
  const data = [
    { name: 'Live', value: live },
    { name: 'Upcoming', value: upcoming },
    { name: 'Archive', value: completed },
  ]

  return (
    <LandingSectionShell
      id="stats"
      eyebrow="Election Statistics"
      title="Real-time transparency."
      description="Track voting activity and election status as it happens across our secure platform."
    >
      <div className="grid gap-8 lg:grid-cols-5">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="lg:col-span-3 rounded-[2.5rem] border border-border bg-card p-8 md:p-12 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h4 className="text-xl font-bold text-foreground">Poll Distribution</h4>
              <p className="text-sm text-muted-foreground mt-1">Status overview of all elections</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" /> 
              SYSTEM ACTIVE
            </div>
          </div>
          
          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: resolved === 'dark' ? '#71717a' : '#a1a1aa', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: resolved === 'dark' ? '#71717a' : '#a1a1aa', fontSize: 11, fontWeight: 700 }} allowDecimals={false} />
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
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                  {data.map((_entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="lg:col-span-2 flex flex-col justify-between rounded-[2.5rem] border border-border bg-card p-8 md:p-12 shadow-sm"
        >
          <div>
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-6">
              <Zap className="size-6" />
            </div>
            <h4 className="text-xl font-bold text-foreground mb-2">Voting Activity</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Total number of secure votes processed across the entire SecureVote platform.
            </p>
          </div>

          <div className="py-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="text-6xl font-black text-foreground tracking-tighter">
                  {totalVotes.toLocaleString()}
                </span>
                <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="size-3" /> +12%
                </div>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Secure Votes</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="h-3 overflow-hidden rounded-full bg-muted border border-border">
              <motion.div
                className="h-full premium-gradient"
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.min(100, totalVotes === 0 ? 10 : 30 + (Math.log1p(totalVotes) / Math.log1p(20000)) * 70)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>Current Scale</span>
              <span>25k Goal</span>
            </div>
          </div>
        </motion.div>
      </div>
    </LandingSectionShell>
  )
}
