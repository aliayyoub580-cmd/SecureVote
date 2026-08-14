import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { 
  Search, 
  Filter, 
  MoreHorizontal,
  FileSignature,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminService, type CreatorProfile } from '@/services/admin.service'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

type TabType = 'all' | 'pending' | 'approved' | 'rejected'

export function SuperAdminCreatorsPage() {
  const [rows, setRows] = useState<CreatorProfile[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabType>('pending')
  const [loading, setLoading] = useState(true)

  // Rejection Modal State
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const data = await adminService.listCreatorApplications()
      setRows(data)
    } catch (error) {
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchesSearch = 
        (r.full_name || '').toLowerCase().includes(search.toLowerCase()) || 
        (r.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.organization || '').toLowerCase().includes(search.toLowerCase())
      
      const matchesTab = 
        tab === 'all' || r.creator_application_status === tab

      return matchesSearch && matchesTab
    })
  }, [rows, search, tab])

  const handleApprove = async (id: string) => {
    try {
      await adminService.approveCreator(id)
      toast.success('Application approved successfully.')
      await load()
    } catch (err: any) {
      toast.error(err.message || 'Approval failed')
    }
  }

  const handleRejectSubmit = async () => {
    if (!rejectId) return
    if (!reason.trim()) {
      toast.error('Please provide a reason for rejection.')
      return
    }
    try {
      await adminService.rejectCreator(rejectId, reason)
      toast.success('Application rejected.')
      setRejectId(null)
      setReason('')
      await load()
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed')
    }
  }

  return (
    <motion.div 
      className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">Election Applications</h1>
          <p className="text-[var(--muted-foreground)] font-medium">
            Review and manage requests from organizations wanting to host elections.
          </p>
        </div>
      </motion.div>

      {/* Filters and Tabs */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar pb-2 sm:pb-0">
          {(['pending', 'approved', 'rejected', 'all'] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                tab === t 
                  ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" 
                  : "bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >
              {t === 'all' ? 'All Applications' : t}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applications..." 
            className="h-10 pl-9 rounded-xl border-[var(--border)] bg-[var(--card)] text-sm"
          />
        </div>
      </motion.div>

      {/* Grid of Applications */}
      <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="h-[200px] bg-[var(--card)] animate-pulse border-none rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[var(--muted-foreground)] font-medium bg-[var(--card)] rounded-2xl border border-[var(--border)]">
            No applications found for the selected filter.
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(app => (
              <motion.div 
                key={app.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="saas-card bg-[var(--card)] border-[var(--border)] h-full flex flex-col group hover:-translate-y-1 transition-all duration-300">
                  <CardHeader className="p-5 pb-3 flex-1 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border",
                        app.creator_application_status === 'pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        app.creator_application_status === 'approved' ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/20" :
                        "bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] border-[var(--accent-danger)]/20"
                      )}>
                        {app.creator_application_status}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] font-semibold">
                        <Calendar className="size-3" />
                        {format(new Date(app.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                    
                    <div className="space-y-1 z-10 relative">
                      <CardTitle className="text-lg font-bold text-[var(--foreground)] tracking-tight">
                        {app.full_name || 'Unnamed Organizer'}
                      </CardTitle>
                      <p className="text-xs text-[var(--muted-foreground)] font-medium">
                        {app.organization || 'Independent'} • {app.email}
                      </p>
                    </div>

                    {app.creator_application_status === 'rejected' && app.creator_application_rejection_reason && (
                      <div className="mt-4 p-3 bg-[var(--accent-danger)]/5 rounded-lg border border-[var(--accent-danger)]/10 text-xs text-[var(--accent-danger)]/80 font-medium">
                        Reason: {app.creator_application_rejection_reason}
                      </div>
                    )}
                  </CardHeader>
                  
                  <CardContent className="p-5 pt-0 mt-auto">
                    {app.creator_application_status === 'pending' ? (
                      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-[var(--border)]">
                        <Button
                          onClick={() => handleApprove(app.id)}
                          className="h-9 rounded-lg font-bold text-[10px] uppercase tracking-widest bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-[var(--primary-foreground)] shadow-[0_0_15px_rgba(216,154,0,0.2)]"
                        >
                          Approve
                        </Button>
                        <Button 
                          onClick={() => setRejectId(app.id)}
                          variant="outline" 
                          className="h-9 rounded-lg font-bold text-[10px] uppercase tracking-widest border-[var(--border)] bg-[var(--background)] hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20"
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 pt-4 border-t border-[var(--border)]">
                        <Button 
                          variant="outline" 
                          className="h-9 w-full rounded-lg font-bold text-[10px] uppercase tracking-widest border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)]"
                        >
                          <Eye className="mr-2 size-3.5" />
                          View Details
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      {/* Rejection Modal */}
      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent className="sm:max-w-[425px] bg-[var(--card)] border-[var(--border)] text-[var(--foreground)]">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription className="text-[var(--muted-foreground)]">
              Provide a clear reason for rejecting this election creator application. This will be visible to the user.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Incomplete organization details..."
              className="min-h-[100px] rounded-xl border-[var(--border)] bg-[var(--background)] text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)} className="rounded-xl font-bold">
              Cancel
            </Button>
            <Button onClick={handleRejectSubmit} className="rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 border-0">
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
