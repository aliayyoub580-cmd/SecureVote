import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Candidate = Database['public']['Tables']['election_candidates']['Row']

type VoteCandidatePickCardProps = {
  candidate: Candidate
  selected: boolean
  onSelect: () => void
}

export function VoteCandidatePickCard({ candidate, selected, onSelect }: VoteCandidatePickCardProps) {
  const initials = candidate.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'relative flex w-full cursor-pointer flex-col gap-3 rounded-2xl border p-4 text-left shadow-sm transition-colors',
        selected
          ? 'border-primary/60 bg-gradient-to-br from-primary/15 via-primary/5 to-card ring-2 ring-primary/25'
          : 'border-border/60 bg-card/70 hover:border-primary/35 hover:bg-card',
      )}
    >
      {selected ? (
        <motion.span
          layoutId={`vote-check-${candidate.poll_id}-${candidate.id}`}
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        >
          <Check className="size-4" strokeWidth={3} />
        </motion.span>
      ) : null}

      <div className="flex items-start gap-3">
        <Avatar className="size-14 shrink-0 rounded-xl border border-border/50">
          {candidate.image_path ? (
            <AvatarImage src={candidate.image_path} alt="" className="rounded-xl object-cover" />
          ) : null}
          <AvatarFallback className="rounded-xl text-sm font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 pr-8">
          <p className="font-semibold leading-snug tracking-tight">{candidate.name}</p>
          {candidate.designation ? (
            <p className="mt-0.5 text-xs font-medium text-primary/90">{candidate.designation}</p>
          ) : null}
          {candidate.bio ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{candidate.bio}</p>
          ) : null}
        </div>
      </div>
    </motion.button>
  )
}
