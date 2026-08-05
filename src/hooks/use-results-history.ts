import { useEffect, useState } from 'react'

import type { ElectionLiveStats } from '@/services/votes.service'

export type ResultsHistoryPoint = {
  t: number
  votes_cast: number
  ballots_completed: number
  registered: number
}

function key(electionId: string) {
  return `ems-results-history:${electionId}`
}

function load(electionId: string): ResultsHistoryPoint[] {
  try {
    const raw = sessionStorage.getItem(key(electionId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((p) => p as Record<string, unknown>)
      .filter((p) => typeof p.t === 'number')
      .map((p) => ({
        t: Number(p.t),
        votes_cast: Number(p.votes_cast ?? 0),
        ballots_completed: Number(p.ballots_completed ?? 0),
        registered: Number(p.registered ?? 0),
      }))
  } catch {
    return []
  }
}

function save(electionId: string, points: ResultsHistoryPoint[]) {
  sessionStorage.setItem(key(electionId), JSON.stringify(points.slice(-96)))
}

/**
 * Client-side time series while this dashboard is open (sessionStorage).
 * Useful for line charts without a dedicated analytics warehouse.
 */
export function useResultsHistory(electionId: string | undefined, stats: ElectionLiveStats | null) {
  const [series, setSeries] = useState<ResultsHistoryPoint[]>([])

  useEffect(() => {
    if (!electionId) {
      setSeries([])
      return
    }
    setSeries(load(electionId))
  }, [electionId])

  useEffect(() => {
    if (!electionId || !stats) return

    setSeries((prev) => {
      const base = prev.length ? prev : load(electionId)
      const last = base[base.length - 1]
      const same =
        last &&
        last.votes_cast === stats.votes_cast &&
        last.ballots_completed === stats.ballots_completed &&
        last.registered === stats.registered
      if (same) return base

      const next: ResultsHistoryPoint[] = [
        ...base,
        {
          t: Date.now(),
          votes_cast: stats.votes_cast,
          ballots_completed: stats.ballots_completed,
          registered: stats.registered,
        },
      ].slice(-96)
      save(electionId, next)
      return next
    })
  }, [electionId, stats])

  return series
}
