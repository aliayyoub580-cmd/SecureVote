import { useCallback, useEffect, useRef } from 'react'

import { supabase } from '@/lib/supabase/client'

import { useElectionVotesRealtime } from './use-election-votes-realtime'

const DEBOUNCE_MS = 380

/**
 * Refreshes results when vote rows change or the election row updates (e.g. votes_version).
 * Debounced to coalesce bursts from multi-poll ballots.
 */
export function useElectionResultsLive(electionId: string | undefined, onRefresh: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cb = useRef(onRefresh)

  useEffect(() => {
    cb.current = onRefresh
  }, [onRefresh])

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      cb.current()
    }, DEBOUNCE_MS)
  }, [])

  useElectionVotesRealtime(electionId, schedule)

  useEffect(() => {
    if (!electionId) return

    const channelId = `election-results-live:${electionId}:${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'elections',
          filter: `id=eq.${electionId}`,
        },
        () => schedule(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [electionId, schedule])
}
