import { useEffect, useMemo, useState } from 'react'

import { LandingElectionSection } from '@/components/landing/landing-election-section'
import { LandingFeatures } from '@/components/landing/landing-features'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works'
import { LandingLiveResults } from '@/components/landing/landing-live-results'
import { LandingNavbar } from '@/components/landing/landing-navbar'
import { LandingSecurity } from '@/components/landing/landing-security'
import { LandingSeo } from '@/components/landing/landing-seo'
import { LandingStatsCharts, LandingStatsStrip } from '@/components/landing/landing-stats'
import { LandingTeam } from '@/components/landing/landing-team'
import { LandingTestimonials } from '@/components/landing/landing-testimonials'
import { Skeleton } from '@/components/ui/skeleton'
import { useLandingElections } from '@/hooks/use-landing-elections'
import type { PublicElection } from '@/lib/landing-utils'

const MOCK_UPCOMING: PublicElection[] = [
  {
    id: 'mock-upcoming-1',
    title: 'Executive Council Voting 2026',
    description: 'Annual election for the executive board of directors and student governing body leadership positions.',
    category: 'Student Body',
    organization: 'Supreme Council Org',
    starts_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'approved',
    suspended: false,
    max_voters: 1500,
    created_at: new Date().toISOString(),
    created_by: 'mock-user-1',
    require_otp: true,
    voter_limit: 1500
  } as any,
  {
    id: 'mock-upcoming-2',
    title: 'Department Chair & Senate Selection',
    description: 'Official departmental selection for the representative academic senate seats and dean advisory panel.',
    category: 'Faculty',
    organization: 'Senate Division',
    starts_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'approved',
    suspended: false,
    max_voters: 500,
    created_at: new Date().toISOString(),
    created_by: 'mock-user-2',
    require_otp: true,
    voter_limit: 500
  } as any
]

export function LandingPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [liveSortBy, setLiveSortBy] = useState<'recent' | 'popular' | 'title'>('recent')
  const [upcomingSortBy, setUpcomingSortBy] = useState<'recent' | 'popular' | 'title'>('recent')
  const [completedSortBy, setCompletedSortBy] = useState<'recent' | 'popular' | 'title'>('recent')

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput), 280)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const { elections, filtered, byBucket, voteTotals, preview, loading, totalVotes, totalUsers } = useLandingElections(search)

  const sortedLiveElections = useMemo(() => {
    const list = [...byBucket.live]
    if (liveSortBy === 'recent') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (liveSortBy === 'popular') {
      list.sort((a, b) => (voteTotals[b.id] || 0) - (voteTotals[a.id] || 0))
    } else if (liveSortBy === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }
    return list
  }, [byBucket.live, liveSortBy, voteTotals])

  const sortedUpcomingElections = useMemo(() => {
    const list = [...byBucket.upcoming]
    if (upcomingSortBy === 'recent') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (upcomingSortBy === 'popular') {
      list.sort((a, b) => (voteTotals[b.id] || 0) - (voteTotals[a.id] || 0))
    } else if (upcomingSortBy === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }
    return list
  }, [byBucket.upcoming, upcomingSortBy, voteTotals])

  const sortedCompletedElections = useMemo(() => {
    const list = [...byBucket.completed]
    if (completedSortBy === 'recent') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (completedSortBy === 'popular') {
      list.sort((a, b) => (voteTotals[b.id] || 0) - (voteTotals[a.id] || 0))
    } else if (completedSortBy === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }
    return list
  }, [byBucket.completed, completedSortBy, voteTotals])

  const totalPublished = filtered.length

  return (
    <div className="min-h-dvh bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <LandingSeo />
      <LandingNavbar search={searchInput} onSearchChange={setSearchInput} />
      <main>
        <LandingHero 
          totalVotes={totalVotes}
          totalUsers={totalUsers}
          totalElections={elections.length}
        />
        {loading ? (
          <div className="mx-auto max-w-[1400px] space-y-4 px-6 py-20 lg:px-8">
            <Skeleton className="mx-auto h-24 max-w-4xl rounded-[2rem] bg-muted" />
            <div className="grid gap-8 md:grid-cols-3">
              <Skeleton className="h-80 rounded-[3rem] bg-muted" />
              <Skeleton className="h-80 rounded-[3rem] bg-muted" />
              <Skeleton className="h-80 rounded-[3rem] bg-muted" />
            </div>
          </div>
        ) : (
          <>
            <LandingStatsStrip
              totalPublished={totalPublished}
              live={byBucket.live.length}
              upcoming={byBucket.upcoming.length}
              completed={byBucket.completed.length}
              totalVotes={totalVotes}
            />
            <div id="elections" className="scroll-mt-32 space-y-24 md:space-y-32">
              <LandingElectionSection
                id="live"
                eyebrow="Active Elections"
                title="Live Elections"
                description="Browse and participate in elections that are currently active and accepting votes."
                elections={sortedLiveElections}
                voteTotals={voteTotals}
                emptyMessage="No active elections at the moment. Please check back later."
                filterControls={
                  <div className="flex items-center justify-end gap-3 mb-8 bg-card border border-border p-3 rounded-2xl max-w-xs ml-auto">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sort By</span>
                    <select
                      value={liveSortBy}
                      onChange={(e) => setLiveSortBy(e.target.value as any)}
                      className="h-8 px-2.5 rounded-lg bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                    >
                      <option value="recent">Recent</option>
                      <option value="popular">Most Voted</option>
                      <option value="title">Alphabetical (A-Z)</option>
                    </select>
                  </div>
                }
              />
              <LandingElectionSection
                id="upcoming"
                eyebrow="Pending Elections"
                title="Upcoming Elections"
                description="View elections that are scheduled to start soon. You can verify your eligibility in advance."
                elections={sortedUpcomingElections}
                voteTotals={voteTotals}
                emptyMessage="No upcoming elections scheduled at this time."
                filterControls={
                  <div className="flex items-center justify-end gap-3 mb-8 bg-card border border-border p-3 rounded-2xl max-w-xs ml-auto">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sort By</span>
                    <select
                      value={upcomingSortBy}
                      onChange={(e) => setUpcomingSortBy(e.target.value as any)}
                      className="h-8 px-2.5 rounded-lg bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                    >
                      <option value="recent">Recent</option>
                      <option value="popular">Most Voted</option>
                      <option value="title">Alphabetical (A-Z)</option>
                    </select>
                  </div>
                }
              />
              <LandingElectionSection
                id="completed"
                eyebrow="Election Archive"
                title="Completed Elections"
                description="View the results of past elections. All outcomes are permanently archived and verifiable."
                elections={sortedCompletedElections}
                voteTotals={voteTotals}
                emptyMessage="No completed elections in the archive."
                filterControls={
                  <div className="flex items-center justify-end gap-3 mb-8 bg-card border border-border p-3 rounded-2xl max-w-xs ml-auto">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sort By</span>
                    <select
                      value={completedSortBy}
                      onChange={(e) => setCompletedSortBy(e.target.value as any)}
                      className="h-8 px-2.5 rounded-lg bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                    >
                      <option value="recent">Recent</option>
                      <option value="popular">Most Voted</option>
                      <option value="title">Alphabetical (A-Z)</option>
                    </select>
                  </div>
                }
              />
            </div>
            <LandingLiveResults liveElections={byBucket.live} preview={preview} voteTotals={voteTotals} />
            <LandingStatsCharts
              live={byBucket.live.length}
              upcoming={byBucket.upcoming.length}
              completed={byBucket.completed.length}
              totalVotes={totalVotes}
            />
          </>
        )}
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingTeam />
        <LandingTestimonials />
        <LandingSecurity />
      </main>
      <LandingFooter />
    </div>
  )
}
