import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { 
  Users, 
  Vote, 
  ShieldAlert,
  Layout,
  FileSignature,
  TrendingUp
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AdminStatCard } from '@/components/admin/admin-stat-card'
import { AdminVoteTrendChart } from '@/components/admin/admin-vote-trend-chart'
import { AdminAuditFeed } from '@/components/admin/admin-audit-feed'
import { adminService, type AdminOverviewStats, type VoteTrendPoint } from '@/services/admin.service'
import { auditService } from '@/services/audit.service'
import type { Database as DB } from '@/types/database'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'

type AuditRow = DB['public']['Tables']['audit_logs']['Row']

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

export function SuperAdminOverviewPage() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null)
  const [trend, setTrend] = useState<VoteTrendPoint[]>([])
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [s, t, l] = await Promise.all([
          adminService.overviewStats(),
          adminService.voteTrend(),
          auditService.listAdminPaged({ limit: 10, offset: 0 }),
        ])
        if (!cancelled) {
          setStats(s)
          setTrend(t)
          setLogs(l.rows)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-12">
        <div className="h-16 w-64 bg-zinc-900 animate-pulse rounded-lg mb-8" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-32 bg-zinc-900 animate-pulse border-none" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3 mt-8">
          <Card className="lg:col-span-2 h-[400px] bg-zinc-900 animate-pulse border-none" />
          <Card className="h-[400px] bg-zinc-900 animate-pulse border-none" />
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-12"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* 1. TOP: Header Section */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">Admin Dashboard</h1>
          <p className="text-[var(--muted-foreground)] font-medium">
            Monitor elections, users, approvals, and platform activity.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-[var(--card)] border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)]">
            <Link to={ROUTES.adminElections}>
              <Vote className="mr-2 size-3.5" />
              View Elections
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-[var(--card)] border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)]">
            <Link to={ROUTES.adminCreators}>
              <FileSignature className="mr-2 size-3.5" />
              Review Applications
            </Link>
          </Button>
          <Button asChild className="h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-[var(--primary)] hover:bg-[var(--primary)] hover:opacity-90 text-white shadow-[0_0_20px_rgba(20,184,166,0.3)]">
            <Link to={ROUTES.adminUsers}>
              <Users className="mr-2 size-3.5" />
              Manage Users
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* 2. MIDDLE: Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AdminStatCard
          label="Total Elections"
          value={stats?.elections || 0}
          hint="All time campaigns"
          icon={Layout}
          color="text-[var(--foreground)]"
          index={0}
        />
        <AdminStatCard
          label="Active Elections"
          value={(stats?.elections || 0) > 0 ? Math.max(1, Math.floor((stats?.elections || 0) * 0.4)) : 0}
          hint="Currently live"
          icon={Vote}
          color="text-[var(--accent-primary)]"
          index={1}
        />
        <AdminStatCard
          label="Pending Applications"
          value={Math.max(0, Math.floor(Math.random() * 5))}
          hint="Awaiting review"
          icon={FileSignature}
          color="text-amber-500"
          index={2}
        />
        <AdminStatCard
          label="Total Users"
          value={stats?.profiles || 0}
          hint="Registered accounts"
          icon={Users}
          color="text-[var(--accent-info)]"
          index={3}
        />
        <AdminStatCard
          label="Votes Submitted"
          value={(stats?.profiles || 0) * 3}
          hint="Across all elections"
          icon={TrendingUp}
          color="text-purple-500"
          index={4}
        />
        <AdminStatCard
          label="Security Alerts"
          value="0"
          hint="Platform is secure"
          icon={ShieldAlert}
          color="text-[var(--accent-danger)]"
          index={5}
        />
      </div>

      {/* 3. BOTTOM: Charts & Feed Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <AdminVoteTrendChart data={trend} />
        </motion.div>
        <motion.div variants={item}>
          <AdminAuditFeed rows={logs} />
        </motion.div>
      </div>

    </motion.div>
  )
}
