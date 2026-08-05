import { motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'

import type { ElectionInsight } from '@/lib/election-results-analytics'
import { cn } from '@/lib/utils'

type Props = { insights: ElectionInsight[] }

const toneBorder: Record<ElectionInsight['tone'], string> = {
  neutral: 'border-border/60 bg-muted/15',
  positive: 'border-emerald-500/30 bg-emerald-500/5',
  attention: 'border-amber-500/35 bg-amber-500/10',
}

export function AnalyticsInsightsList({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Lightbulb className="size-4 text-amber-500" />
        Election insights
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {insights.map((ins, i) => (
          <motion.li
            key={ins.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={cn('rounded-xl border p-3 text-sm', toneBorder[ins.tone])}
          >
            <p className="font-medium text-foreground">{ins.title}</p>
            <p className="mt-1 leading-snug text-muted-foreground">{ins.body}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
