import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

type RegistrationProgressIndicatorProps = {
  registrantCount: number
  maxVoters: number | null
  waitlistCount: number
  className?: string
}

export function RegistrationProgressIndicator({
  registrantCount,
  maxVoters,
  waitlistCount,
  className,
}: RegistrationProgressIndicatorProps) {
  const pct =
    maxVoters != null && maxVoters > 0 ? Math.min(100, Math.round((registrantCount / maxVoters) * 100)) : null
  const capReached = maxVoters != null && registrantCount >= maxVoters

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Participants</p>
          <p className="text-2xl font-bold tabular-nums">
            {registrantCount.toLocaleString()}
            {maxVoters != null ? (
              <span className="text-base font-semibold text-muted-foreground"> / {maxVoters.toLocaleString()}</span>
            ) : (
              <span className="text-base font-medium text-muted-foreground"> registered</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Waitlist</p>
          <p className="text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">{waitlistCount.toLocaleString()}</p>
        </div>
      </div>
      {pct != null ? (
        <div className="space-y-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn(
                'h-full rounded-full bg-gradient-to-r from-primary to-violet-500',
                capReached && 'from-amber-500 to-orange-500',
              )}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {capReached ? 'Capacity reached — new signups join the waitlist.' : `${pct}% of declared capacity filled.`}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No voter cap set — open registration until the deadline.</p>
      )}
    </div>
  )
}
