import { useEffect } from 'react'

import { supabase } from '@/lib/supabase/client'

/** Realtime sync for elections owned by the creator (and nested poll changes use election updated_at via triggers — optional second channel). */
export function useCreatorElectionsRealtime(creatorId: string | undefined, onEvent: () => void) {
  useEffect(() => {
    if (!creatorId) return
    const channelId = `creator-elections:${creatorId}:${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'elections', filter: `created_by=eq.${creatorId}` },
        () => {
          onEvent()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [creatorId, onEvent])
}
