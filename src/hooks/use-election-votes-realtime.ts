import { useEffect, useRef } from 'react'

import { supabase } from '@/lib/supabase/client'

export function useElectionVotesRealtime(electionId: string | undefined, onEvent: () => void) {
  const cb = useRef(onEvent)

  useEffect(() => {
    cb.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!electionId) return

    const channelId = `election-votes:${electionId}:${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `election_id=eq.${electionId}` },
        () => cb.current(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [electionId])
}
