import * as React from 'react'
import { supabase } from '@/lib/supabase/client'
import { socialNotificationsService } from '@/services/social.service'
import type { SocialNotification } from '@/types/social'

export function useSocialNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = React.useState<SocialNotification[]>([])
  const [unreadCount,   setUnreadCount]   = React.useState(0)
  const [loading,       setLoading]       = React.useState(true)

  const fetchAll = React.useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [notifs, count] = await Promise.all([
        socialNotificationsService.getNotifications(userId),
        socialNotificationsService.getUnreadCount(userId),
      ])
      setNotifications(notifs)
      setUnreadCount(count)
    } finally {
      setLoading(false)
    }
  }, [userId])

  React.useEffect(() => { void fetchAll() }, [fetchAll])

  // Realtime inserts
  React.useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`social-notif-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'social_notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as SocialNotification, ...prev])
        setUnreadCount(c => c + 1)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId])

  const markAllRead = React.useCallback(async () => {
    if (!userId) return
    await socialNotificationsService.markAllRead(userId)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setUnreadCount(0)
  }, [userId])

  return { notifications, unreadCount, loading, markAllRead, refresh: fetchAll }
}
