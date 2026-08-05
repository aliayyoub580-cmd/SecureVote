import { ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity } from 'lucide-react'
import type { VoteTrendPoint } from '@/services/admin.service'

interface AdminVoteTrendChartProps {
  data: VoteTrendPoint[]
  className?: string
}

export function AdminVoteTrendChart({ data, className }: AdminVoteTrendChartProps) {
  return (
    <Card className={`saas-card bg-[var(--card)] border-[var(--border)] h-full flex flex-col ${className || ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[var(--border)]">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Activity className="size-4 text-[var(--primary)]" />
            Participation Activity
          </CardTitle>
          <p className="text-[10px] text-[var(--muted-foreground)] font-black uppercase tracking-widest mt-1">Platform wide voting trends</p>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">
          <Button size="sm" variant="ghost" className="h-7 px-3 rounded-md text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--foreground)]">7D</Button>
          <Button size="sm" className="h-7 px-3 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90">30D</Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-[300px] w-full pt-6 p-0 sm:p-6 sm:pt-6">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVote" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 600 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 600 }} 
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)',
                color: 'var(--foreground)'
              }}
              itemStyle={{
                color: 'var(--foreground)',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              labelStyle={{
                color: 'var(--muted-foreground)',
                fontSize: '10px',
                fontWeight: 'black',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="votes" 
              stroke="var(--primary)" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorVote)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
