import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type StatTileProps = {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  delay?: number
  className?: string
}

export function AnalyticsStatTile({ icon: Icon, label, value, hint, delay = 0, className }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28, delay: delay * 0.05 }}
      className={cn(
        'flex flex-col gap-1 rounded-2xl border border-border/45 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 p-4 shadow-sm backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0 text-primary/90" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint ? <p className="text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </motion.div>
  )
}
