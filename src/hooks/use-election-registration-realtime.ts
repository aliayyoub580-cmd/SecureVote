import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase/client'

export function useElectionRegistrationRealtime(electionId: string | undefined) {
  const [registrantCount, setRegistrantCount] = useState<number | null>(null)
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null)

  useEffect(() => {
    if (!electionId) {
      setRegistrantCount(null)
      setWaitlistCount(null)
      return
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('elections')
        .select('registrant_count, waitlist_count')
        .eq('id', electionId)
        .maybeSingle()
      if (error || !data) return
      const r = data as { registrant_count: number; waitlist_count: number }
      setRegistrantCount(Number(r.registrant_count ?? 0))
      setWaitlistCount(Number(r.waitlist_count ?? 0))
    }

    void load()

    const channelId = `election-reg-counts-${electionId}:${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'elections', filter: `id=eq.${electionId}` },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [electionId])

  return { registrantCount, waitlistCount }
}
