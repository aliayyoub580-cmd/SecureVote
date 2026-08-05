import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Eye, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import type { Database } from '@/types/database'

type Candidate = Database['public']['Tables']['election_candidates']['Row']

type CandidateCardProps = {
  candidate: Candidate
  electionId: string
  pollTitle: string
  disableMoveUp: boolean
  disableMoveDown: boolean
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isLocked?: boolean
}

export function CandidateCard({
  candidate,
  electionId,
  pollTitle,
  disableMoveUp,
  disableMoveDown,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isLocked = false,
}: CandidateCardProps) {
  const initials = candidate.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all duration-300 rounded-[1.5rem]">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <Avatar className="size-20 rounded-2xl border border-border shadow-sm">
              {candidate.image_path ? (
                <AvatarImage
                  src={candidate.image_path}
                  alt={candidate.name}
                  className="rounded-2xl object-cover"
                />
              ) : null}
              <AvatarFallback className="rounded-2xl text-lg font-black bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{pollTitle}</p>
            <h3 className="text-xl font-black text-foreground tracking-tight">{candidate.name}</h3>
            {candidate.designation ? (
              <p className="text-sm font-bold text-primary">{candidate.designation}</p>
            ) : null}
            {candidate.bio ? (
              <p className="line-clamp-2 text-sm text-muted-foreground font-medium leading-relaxed">{candidate.bio}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground/60 font-medium">No bio provided</p>
            )}
          </div>
          <div className="flex flex-row flex-wrap items-center justify-end gap-2 border-t border-border pt-4 sm:flex-col sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <div className="flex gap-2 sm:flex-row">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-10 rounded-xl border-border bg-background hover:bg-muted"
                disabled={disableMoveUp || isLocked}
                onClick={onMoveUp}
                aria-label="Move up"
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-10 rounded-xl border-border bg-background hover:bg-muted"
                disabled={disableMoveDown || isLocked}
                onClick={onMoveDown}
                aria-label="Move down"
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <Button type="button" size="sm" variant="outline" className="rounded-xl h-9 px-4 font-bold text-xs" asChild>
                <Link to={ROUTES.electionCandidatePreview(electionId, candidate.id)}>
                  <Eye className="mr-1.5 size-3.5" />
                  Preview
                </Link>
              </Button>
              {!isLocked && (
                <Button type="button" size="sm" variant="outline" className="rounded-xl h-9 px-4 font-bold text-xs border-border hover:bg-muted" onClick={onEdit}>
                  <Pencil className="mr-1.5 size-3.5" />
                  Edit
                </Button>
              )}
              {!isLocked && (
                <Button type="button" size="sm" variant="ghost" className="rounded-xl h-9 px-4 font-bold text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600" onClick={onDelete}>
                  <Trash2 className="mr-1.5 size-3.5" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
