import { getDisplayPhase, type DisplayPhase } from '@/lib/election-utils'
import type { Database } from '@/types/database'

export type PublicElection = Database['public']['Tables']['elections']['Row']

export type LandingBucket = 'live' | 'upcoming' | 'completed'

export function bucketForElection(e: PublicElection): LandingBucket {
  const phase = getDisplayPhase(e)
  if (phase === 'voting') return 'live'
  if (phase === 'scheduled') return 'upcoming'
  if (phase === 'ended' || phase === 'closed') return 'completed'
  return 'completed'
}

export function phaseBadge(phase: DisplayPhase): string {
  if (phase === 'voting') return 'Live'
  if (phase === 'scheduled') return 'Upcoming'
  if (phase === 'ended' || phase === 'closed') return 'Completed'
  return phase
}

export function filterElections(
  list: PublicElection[],
  query: string,
): PublicElection[] {
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter((e) => {
    const hay = [e.title, e.description, e.category, e.organization]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}
