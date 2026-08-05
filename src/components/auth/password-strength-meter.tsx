import { motion } from 'framer-motion'

import { passwordStrengthScore } from '@/lib/schemas/auth'
import { cn } from '@/lib/utils'

const LABELS = ['Weak', 'Weak', 'Medium', 'Strong', 'Strong']

export function PasswordStrengthMeter({ password }: { password: string }) {
  const score = passwordStrengthScore(password)
  const pct = (score / 4) * 100

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-900 border border-white/5">
        <motion.div
          className={cn(
            'h-full rounded-full',
            score <= 1 && 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
            score === 2 && 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]',
            score >= 3 && 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]',
          )}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        />
      </div>
      {password.length > 0 && (
        <p className={cn(
          "text-[10px] font-black uppercase tracking-widest text-right",
          score <= 1 && 'text-red-500',
          score === 2 && 'text-amber-500',
          score >= 3 && 'text-emerald-500'
        )}>
          {LABELS[score]}
        </p>
      )}
    </div>
  )
}
