import { LandingElectionCard } from '@/components/landing/landing-election-card'
import { LandingSectionShell } from '@/components/landing/landing-section-shell'
import type { PublicElection } from '@/lib/landing-utils'

type LandingElectionSectionProps = {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  elections: PublicElection[]
  voteTotals: Record<string, number>
  emptyMessage: string
  filterControls?: React.ReactNode
}

export function LandingElectionSection({
  id,
  eyebrow,
  title,
  description,
  elections,
  voteTotals,
  emptyMessage,
  filterControls,
}: LandingElectionSectionProps) {
  return (
    <LandingSectionShell id={id} eyebrow={eyebrow} title={title} description={description}>
      {filterControls}
      {elections.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:snap-none md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
          {elections.map((e) => (
            <LandingElectionCard
              key={e.id}
              election={e}
              voteCount={voteTotals[e.id] ?? 0}
              className="min-w-[min(100%,280px)] shrink-0 snap-center md:min-w-0"
            />
          ))}
        </div>
      )}
    </LandingSectionShell>
  )
}
