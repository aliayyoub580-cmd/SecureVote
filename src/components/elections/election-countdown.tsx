import { intervalToDuration, isBefore, isPast } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

type Phase = 'upcoming' | 'live' | 'ended'

export function ElectionCountdown({
  startsAt,
  endsAt,
  className,
}: {
  startsAt: string
  endsAt: string
  className?: string
}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const start = new Date(startsAt)
  const end = new Date(endsAt)

  let phase: Phase = 'live'
  if (isBefore(now, start)) phase = 'upcoming'
  else if (isPast(end)) phase = 'ended'

  const target = phase === 'upcoming' ? start : end
  const label = phase === 'upcoming' ? 'Opens in' : phase === 'live' ? 'Closes in' : 'Closed'

  const dur =
    phase === 'ended'
      ? null
      : intervalToDuration({
          start: now,
          end: target,
        })

  const parts =
    dur == null
      ? []
      : [
          dur.days ? `${dur.days}d` : null,
          dur.hours != null ? `${dur.hours}h` : null,
          dur.minutes != null ? `${dur.minutes}m` : null,
          dur.seconds != null ? `${dur.seconds}s` : null,
        ].filter(Boolean)

  const text = phase === 'ended' ? 'Voting window ended' : parts.length ? parts.join(' ') : '—'

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase + text}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25 }}
        className={cn(
          'inline-flex flex-col rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-3 shadow-sm',
          className,
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono text-lg font-semibold tabular-nums tracking-tight text-foreground">{text}</span>
      </motion.div>
    </AnimatePresence>
  )
}
