import { Badge } from '@/components/ui/badge'
import { getDisplayPhase, phaseLabel } from '@/lib/election-utils'
import type { ElectionStatus } from '@/types/database'

type ElectionLike = {
  status: ElectionStatus
  starts_at: string
  ends_at: string
}

const variantFor = (phase: ReturnType<typeof getDisplayPhase>) => {
  if (phase === 'voting' || phase === 'active') return 'success' as const
  if (phase === 'ended' || phase === 'closed') return 'secondary' as const
  if (phase === 'rejected') return 'destructive' as const
  if (phase === 'pending_approval') return 'warning' as const
  if (phase === 'draft') return 'outline' as const
  return 'default' as const
}

export function ElectionStatusBadge({ election, className }: { election: ElectionLike, className?: string }) {
  const phase = getDisplayPhase(election)
  const v = variantFor(phase)
  return <Badge variant={v} className={className}>{phaseLabel(phase)}</Badge>
}
