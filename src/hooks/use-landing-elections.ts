import { useCallback, useEffect, useMemo, useState } from 'react'

import { getDisplayPhase } from '@/lib/election-utils'
import { bucketForElection, filterElections, type PublicElection } from '@/lib/landing-utils'
import { supabase } from '@/lib/supabase/client'
import { fetchLandingVoteTotals, fetchPublicElections, fetchResultsPreview, fetchTotalUsersCount } from '@/services/landing-stats.service'
import type { ResultRow } from '@/services/votes.service'

export function useLandingElections(search: string) {
  const [elections, setElections] = useState<PublicElection[]>([])
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({})
  const [preview, setPreview] = useState<Record<string, ResultRow[]>>({})
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const loadAll = useCallback(async () => {
    const [el, totals, userCount] = await Promise.all([
      fetchPublicElections(), 
      fetchLandingVoteTotals(),
      fetchTotalUsersCount()
    ])
    setElections(el)
    setVoteTotals(totals)
    setTotalUsers(userCount)
    const liveIds = el.filter((e) => getDisplayPhase(e) === 'voting').slice(0, 8).map((e) => e.id)
    const entries = await Promise.all(
      liveIds.map(async (id) => {
        try {
          const r = await fetchResultsPreview(id)
          return [id, r] as const
        } catch {
          return [id, [] as ResultRow[]] as const
        }
      }),
    )
    const map: Record<string, ResultRow[]> = {}
    for (const [id, r] of entries) map[id] = r
    setPreview(map)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (tick === 0) setLoading(true)
      try {
        await loadAll()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadAll, tick])

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 8000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const channelId = `landing-elections:${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'elections' }, () => {
        setTick((t) => t + 1)
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const filtered = useMemo(() => filterElections(elections, search), [elections, search])

  const byBucket = useMemo(() => {
    const live = filtered.filter((e) => bucketForElection(e) === 'live')
    const upcoming = filtered.filter((e) => bucketForElection(e) === 'upcoming')
    const completed = filtered.filter((e) => bucketForElection(e) === 'completed')
    return { live, upcoming, completed }
  }, [filtered])

  const totalVotes = useMemo(() => Object.values(voteTotals).reduce((a, b) => a + b, 0), [voteTotals])

  return {
    elections,
    filtered,
    byBucket,
    voteTotals,
    preview,
    loading,
    totalVotes,
    totalUsers,
    refetch: () => setTick((t) => t + 1),
  }
}
