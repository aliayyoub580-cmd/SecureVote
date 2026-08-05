import { useEffect, useRef } from 'react'

import { supabase } from '@/lib/supabase/client'

/** Super-admin audit dashboard: new rows appear without manual refresh. */
export function useAdminAuditRealtime(enabled: boolean, onEvent: () => void) {
  const cb = useRef(onEvent)
  useEffect(() => {
    cb.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled) return
    const channelId = `admin-audit-realtime:${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => {
        cb.current()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled])
}
