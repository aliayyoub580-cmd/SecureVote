import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  ArrowRight,
  ClipboardCheck,
  AlertCircle,
  Activity,
  History
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { DataTable, type Column } from '@/components/tables/data-table'
import { ElectionStatusBadge } from '@/modules/elections/election-status-badge'
import { useAuth } from '@/contexts/auth-context'
import { ROUTES } from '@/constants/routes'
import { adminService } from '@/services/admin.service'
import { auditService } from '@/services/audit.service'
import { electionsService } from '@/services/elections.service'
import type { Database as DB } from '@/types/database'
import { cn } from '@/lib/utils'
import { AdminStatCard } from '@/components/admin/admin-stat-card'

type Election = DB['public']['Tables']['elections']['Row']

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } }
}

export function ApprovalsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Election[]>([])
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const data = await electionsService.listPendingApproval()
    setRows(data)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        await load()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const approve = async (eid: string) => {
    if (!profile?.id) return
    const row = rows.find((r) => r.id === eid)
    try {
      await electionsService.approve(eid, profile.id)
      await auditService.log('election.approved', 'election', eid, {})
      if (row) {
        await adminService.notifyUser(
          row.created_by,
          `Election approved: ${row.title}`,
          'Your election passed review and is now approved for scheduling and voter access.',
          ROUTES.electionCreatorView(eid),
        )
      }
      toast.success('Election approved successfully')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed')
    }
  }

  const reject = async () => {
    if (!rejectId || !profile?.id || reason.trim().length < 4) {
      toast.error('Please enter a valid reason for rejection.')
      return
    }
    const row = rows.find((r) => r.id === rejectId)
    try {
      await electionsService.reject(rejectId, profile.id, reason.trim())
      await auditService.log('election.rejected', 'election', rejectId, { reason })
      if (row) {
        await adminService.notifyUser(
          row.created_by,
          `Election rejected: ${row.title}`,
          `Reason: ${reason.trim()}\n\nPlease update your election details and resubmit for approval.`,
          ROUTES.electionEdit(rejectId),
        )
      }
      toast.success('Election rejected successfully')
      setRejectId(null)
      setReason('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  const cols: Column<Election>[] = [
    {
      id: 'title',
      header: 'Election Title',
      cell: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-foreground truncate max-w-[250px]">{r.title}</span>
          <div className="flex items-center gap-1.5">
             <Zap className="size-3 text-primary/50" />
             <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{r.organization || 'Independent'}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'window',
      header: 'Scheduled Period',
      cell: (r) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
             <Clock className="size-3 text-muted-foreground" />
             {format(new Date(r.starts_at), 'MMM d, HH:mm')}
          </div>
          <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest ml-4.5">Ends {format(new Date(r.ends_at), 'MMM d')}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge className="bg-blue-500/10 text-blue-500 border-none text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg">
          Pending Review
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      className: 'text-right',
      cell: (r) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            className="h-9 px-4 rounded-xl bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/10"
            onClick={() => void approve(r.id)}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-4 rounded-xl border-border bg-card/50 hover:bg-rose-500/10 hover:text-rose-500 text-[9px] font-black uppercase tracking-widest transition-all"
            onClick={() => setRejectId(r.id)}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="dashboard-container space-y-8 py-10">
        <div className="h-32 w-full animate-pulse rounded-3xl bg-muted/50" />
        <div className="h-[500px] w-full animate-pulse rounded-3xl bg-muted/50" />
      </div>
    )
  }

  return (
    <motion.div
      className="dashboard-container relative noise-bg"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Background Glows */}
      <div className="fixed top-40 right-0 -mr-48 size-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* 1. TOP: Header Section */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border relative z-10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.2em] mb-1">
             <ShieldCheck className="size-3.5" />
             <span>Moderation Terminal</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Election <span className="text-primary/80">Approvals</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl font-medium leading-relaxed">
            Review and authorize electoral campaigns submitted by organizers. Ensure compliance with platform guidelines.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 font-bold border-border bg-card/50 hover:bg-muted transition-all">
            <History className="mr-2 size-4 text-muted-foreground" />
            Audit History
          </Button>
        </div>
      </motion.div>

      {/* 2. MIDDLE: Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 relative z-10">
        <AdminStatCard
          label="Pending Review"
          value={rows.length}
          hint="Awaiting action"
          icon={Layers}
          color="text-blue-500"
          index={0}
        />
        <AdminStatCard
          label="Reviewed Today"
          value={12}
          hint="Completed checks"
          icon={ClipboardCheck}
          color="text-emerald-500"
          index={1}
        />
        <AdminStatCard
          label="Rejection Rate"
          value="4.2%"
          hint="Compliance score"
          icon={ShieldAlert}
          color="text-rose-500"
          index={2}
        />
        <AdminStatCard
          label="Verification Speed"
          value="1.4h"
          hint="Avg. response time"
          icon={Activity}
          color="text-primary"
          index={3}
        />
      </div>

      {/* 3. BOTTOM: Table & Reject Panel */}
      <div className="grid lg:grid-cols-12 gap-8 relative z-10">
        <motion.div variants={item} className={cn('space-y-6 transition-all duration-500', rejectId ? 'lg:col-span-8' : 'lg:col-span-12')}>
          <DataTable 
            columns={cols} 
            data={rows} 
            getRowId={(r) => r.id} 
            empty="No elections currently awaiting verification." 
          />
        </motion.div>

        <AnimatePresence>
          {rejectId && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="lg:col-span-4"
            >
              <Card className="premium-card border-rose-500/20 bg-rose-500/[0.02] shadow-2xl sticky top-24 overflow-hidden">
                <div className="p-6 border-b border-rose-500/10">
                  <div className="flex items-center gap-3 text-rose-500 mb-1">
                    <AlertCircle className="size-5" />
                    <h3 className="text-sm font-black uppercase tracking-tight">Reject Application</h3>
                  </div>
                  <p className="text-rose-500/60 text-xs font-medium">Please provide a clear reason for the rejection.</p>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="reason" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rejection Justification</Label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Incomplete information, violation of platform terms..."
                      className="w-full min-h-[160px] rounded-2xl bg-muted/40 border border-border p-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-rose-500/30 transition-all resize-none font-medium leading-relaxed"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button 
                      variant="destructive" 
                      className="h-11 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/20 group" 
                      onClick={() => void reject()}
                    >
                      Confirm Rejection
                      <ArrowRight className="size-3.5 ml-2 transition-transform group-hover:translate-x-1" />
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-11 rounded-xl border-border bg-card/50 text-[10px] font-black uppercase tracking-widest" 
                      onClick={() => setRejectId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Glow */}
      <div className="fixed bottom-0 right-0 -mb-48 -mr-48 size-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
    </motion.div>
  )
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-transparent",
      className
    )}>
      {children}
    </span>
  )
}
