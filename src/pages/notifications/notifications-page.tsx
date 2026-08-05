import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { Bell, CheckCircle2, Clock, ArrowRight, Loader2, Inbox } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { notificationsService } from '@/services/notifications.service'
import type { Database } from '@/types/database'
import { cn } from '@/lib/utils'

type Row = Database['public']['Tables']['notifications']['Row']

export function NotificationsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!user?.id) return
    try {
      const data = await notificationsService.listRecent(user.id, 50)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    return notificationsService.subscribe(user.id, (row) => {
      setRows((prev) => [row, ...prev])
      toast.success(row.title, { description: row.body ?? undefined })
    })
  }, [user?.id])

  const mark = async (nid: string) => {
    try {
      await notificationsService.markRead(nid)
      setRows((prev) => prev.map(r => r.id === nid ? { ...r, read_at: new Date().toISOString() } : r))
    } catch {
      toast.error('Failed to mark as read')
    }
  }

  const handleClearAll = async () => {
    if (!user?.id) return
    try {
      await notificationsService.deleteAll(user.id)
      setRows([])
      toast.success('All notifications cleared')
    } catch {
      toast.error('Failed to clear notifications')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 transition-colors duration-500">
      <div className="space-y-8 sm:space-y-12">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:pb-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 sm:size-12 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center shrink-0 text-[var(--primary)]">
                <Bell className="size-5 sm:size-6" />
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter leading-none">Notifications</h1>
            </div>
            {rows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="h-9 sm:h-10 rounded-xl px-3 sm:px-4 font-bold border-border bg-card/50 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all text-xs shrink-0"
              >
                Clear all
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-muted/50 border border-border flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Realtime Active</span>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="grid gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {rows.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                layout
              >
                <Card
                  className={cn(
                    "group relative overflow-hidden transition-all duration-300 rounded-2xl sm:rounded-[1.5rem] border-border hover:shadow-md",
                    n.read_at ? 'bg-muted/30 opacity-80' : 'bg-card shadow-sm border-primary/10'
                  )}
                >
                  {/* Card Top Row: Icon + Title + Mark Read */}
                  <div className="flex items-start gap-3 p-4 sm:p-6">
                    {/* Icon */}
                    <div className={cn(
                      "mt-0.5 size-9 sm:size-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                      n.read_at ? "bg-muted border-border text-muted-foreground/50" : "bg-primary/10 border-primary/20 text-primary"
                    )}>
                      {n.read_at ? <Clock className="size-4 sm:size-5" /> : <Bell className="size-4 sm:size-5" />}
                    </div>

                    {/* Title + Date */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className={cn(
                        "text-sm sm:text-base leading-tight",
                        n.read_at ? "font-bold text-muted-foreground" : "font-black text-foreground"
                      )}>
                        {n.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {format(new Date(n.created_at), 'MMM d, yyyy · h:mm a')}
                        </span>
                        {!n.read_at && (
                          <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10 font-bold uppercase tracking-wider">
                            <div className="size-1 rounded-full bg-primary" />
                            New
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mark Read button */}
                    {!n.read_at && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-lg h-8 px-2 sm:px-3 font-bold text-[10px] hover:bg-primary/5 hover:text-primary transition-all shrink-0"
                        onClick={() => void mark(n.id)}
                      >
                        <CheckCircle2 className="size-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Mark Read</span>
                      </Button>
                    )}
                  </div>

                  {/* Body + Link */}
                  {n.body && (
                    <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0 ml-12 sm:ml-[52px]">
                      <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                        {n.body}
                      </p>
                      {n.link_path && (
                        <div className="mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-9 px-4 font-bold uppercase tracking-widest text-[10px] group/btn"
                            asChild
                          >
                            <Link to={n.link_path}>
                              View Details
                              <ArrowRight className="ml-2 size-3.5 group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 sm:py-24 text-center">
              <div className="size-16 sm:size-20 rounded-[2rem] bg-muted/50 border border-border flex items-center justify-center mb-6 text-muted-foreground/30">
                <Inbox className="size-8 sm:size-10" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mb-2">No notifications</h3>
              <p className="text-muted-foreground font-medium max-w-xs text-sm">
                You're all caught up! When you have new activity, it will show up here in real-time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
