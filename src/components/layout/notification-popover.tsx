import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, Clock, X, Check } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import { notificationsService } from '@/services/notifications.service'
import type { Database } from '@/types/database'
import { cn } from '@/lib/utils'

type Row = Database['public']['Tables']['notifications']['Row']

export function NotificationPopover() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Row[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = async () => {
    if (!user?.id) return
    const data = await notificationsService.listRecent(user.id, 10)
    setNotifications(data)
    setUnreadCount(data.filter(n => !n.read_at).length)
  }

  useEffect(() => {
    if (!user?.id) return
    void fetchNotifications()

    const channel = supabase.channel(`popover-notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => void fetchNotifications()
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [user?.id])

  const handleNotificationClick = async (n: Row) => {
    if (!n.read_at) {
      await notificationsService.markRead(n.id)
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
    setOpen(false)
    if (n.link_path) {
      navigate(n.link_path)
    }
  }

  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount === 0) return
    await notificationsService.markAllRead(user.id)
    setNotifications(prev => prev.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
    setUnreadCount(0)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] relative cursor-pointer outline-none">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-bold text-white ring-2 ring-[var(--card)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 sm:w-96 p-0 rounded-2xl bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="font-black text-sm uppercase tracking-widest text-[var(--foreground)]">Notifications</h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMarkAllRead} 
              disabled={unreadCount === 0}
              className="h-6 text-[10px] font-bold uppercase tracking-widest text-[var(--primary)] hover:text-[var(--primary)]/80 px-2 rounded-md disabled:opacity-50"
            >
              Mark all read
            </Button>
            <Button variant="ghost" size="icon" className="size-6 rounded-full hover:bg-[var(--muted)] text-[var(--muted-foreground)]" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--muted-foreground)] opacity-70">
              <Bell className="size-8 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">No notifications</p>
            </div>
          ) : (
            <div className="flex flex-col p-2 space-y-1">
              {notifications.map((n) => (
                <div 
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "flex gap-3 p-3 rounded-xl cursor-pointer transition-all",
                    !n.read_at ? "bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10" : "hover:bg-[var(--muted)]/50"
                  )}
                >
                  {/* Indicator / Icon */}
                  <div className="relative pt-1 shrink-0">
                    {!n.read_at && <div className="absolute -left-1 top-3.5 size-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]" />}
                    <div className={cn(
                      "size-8 rounded-full flex items-center justify-center border",
                      !n.read_at ? "bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]"
                    )}>
                      {!n.read_at ? <Bell className="size-4" /> : <Check className="size-4" />}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-[13px] truncate", !n.read_at ? "font-bold text-[var(--foreground)]" : "font-semibold text-[var(--muted-foreground)]")}>
                        {n.title}
                      </p>
                      <span className="text-[10px] whitespace-nowrap text-[var(--muted-foreground)] font-medium">
                        {format(new Date(n.created_at), 'MMM d')}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-[var(--border)] bg-[var(--card)]">
          <Button 
            asChild 
            className="w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold h-10 shadow-lg shadow-blue-500/20"
            onClick={() => setOpen(false)}
          >
            <Link to={ROUTES.notifications} className="flex items-center justify-center gap-2">
              View all activity
              {unreadCount > 0 && (
                <span className="flex items-center justify-center bg-white/20 text-white size-5 rounded-full text-[10px] font-black">
                  {unreadCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
