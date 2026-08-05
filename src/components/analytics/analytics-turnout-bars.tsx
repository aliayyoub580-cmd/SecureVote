import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

type TurnoutBarsProps = {
  participationPct: number
  capPct: number | null
  className?: string
}

function BarTrack({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
        <motion.div
          className={cn('h-full rounded-full', colorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
      </div>
    </div>
  )
}

export function AnalyticsTurnoutBars({ participationPct, capPct, className }: TurnoutBarsProps) {
  return (
    <div className={cn('space-y-4 p-1', className)}>
      <BarTrack label="Ballot return rate (completed ÷ issued)" value={participationPct} colorClass="bg-primary" />
      {capPct != null ? (
        <BarTrack label="Participation vs registration cap" value={capPct} colorClass="bg-violet-500 dark:bg-violet-400" />
      ) : null}
    </div>
  )
}
