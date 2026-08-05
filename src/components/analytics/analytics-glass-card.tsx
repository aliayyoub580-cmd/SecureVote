import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type GlassCardProps = {
  children: ReactNode
  className?: string
  /** Stagger index for entrance animation */
  delay?: number
}

export function AnalyticsGlassCard({ children, className, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-2xl border border-border/50 bg-card/55 shadow-card backdrop-blur-xl',
        'ring-1 ring-white/5 dark:ring-white/10',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}
