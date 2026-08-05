import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase/client'
import { votesService, type ElectionLiveStats } from '@/services/votes.service'

export type { ElectionLiveStats }

export function useElectionLiveStats(electionId: string | undefined, enabled: boolean) {
  const [stats, setStats] = useState<ElectionLiveStats>({
    votes_cast: 0,
    registered: 0,
    ballots_completed: 0,
  })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!electionId || !enabled) return
    try {
      const next = await votesService.getLiveStats(electionId)
      setStats(next)
    } finally {
      setLoading(false)
    }
  }, [electionId, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!electionId || !enabled) return

    const channelId = `election-live-stats:${electionId}:${Math.random().toString(36).slice(2, 9)}`
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
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [electionId, enabled, refresh])

  return { stats, loading, refresh }
}
