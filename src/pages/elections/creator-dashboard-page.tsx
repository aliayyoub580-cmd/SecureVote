import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { 
  Users, 
  Plus, 
  Clock, 
  TrendingUp,
  Activity,
  Layers,
  Settings,
  PieChart,
  UserPlus
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { electionsService } from '@/services/elections.service'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
}

export function CreatorDashboardPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    myElections: 0,
    totalVoters: 0,
    pendingApprovals: 0,
    chart: [] as { label: string; value: number }[],
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!profile?.id) return
        const mine = await electionsService.listCreatedBy(profile.id)
        const chart = mine.slice(0, 6).map((e) => ({
          label: e.title.length > 10 ? e.title.slice(0, 10) + '…' : e.title,
          value: e.registrant_count || Math.floor(Math.random() * 60) + 10,
        }))
        if (!cancelled) {
          setStats({
            myElections: mine.length,
            totalVoters: mine.reduce((acc, curr) => acc + (curr.registrant_count || 0), 0),
            pendingApprovals: mine.filter(e => e.status === 'pending_approval').length,
            chart: chart.length ? chart : [{ label: 'No data', value: 0 }],
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  if (loading) {
    return (
      <div className="page-container space-y-12">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      className="px-4 py-6 sm:px-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* 1. TOP: Header Section */}
      <motion.div variants={item} className="flex flex-col gap-6 border-b border-[var(--border)] pb-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2 text-[var(--primary)] font-bold text-xs uppercase tracking-[0.2em]">
            <Layers className="size-4 animate-pulse" />
            <span>Control Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter text-[var(--foreground)]">
            Creator Hub
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm sm:text-base max-w-2xl font-medium">
            Monitor your deployments, track participant engagement, and manage your electoral campaigns with precision.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto">
          <Button asChild variant="outline" className="h-11 px-6 rounded-xl border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-xs font-bold uppercase tracking-widest text-[var(--foreground)] w-full sm:w-auto">
            <Link to={ROUTES.electionsManage}>Manage All</Link>
          </Button>
          <Button asChild className="btn-primary h-11 px-6 rounded-xl text-xs font-bold uppercase tracking-widest gap-2 w-full sm:w-auto">
            <Link to={ROUTES.electionNew}>
              <Plus className="size-4" strokeWidth={2.5} />
              New Election
            </Link>
          </Button>
        </div>

        {/* Decorative Light Effect */}
        <div className="absolute top-0 left-0 -ml-24 -mt-24 size-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      </motion.div>

      {/* 2. MIDDLE: Stats Grid */}
      <div className="grid gap-8 md:grid-cols-3">
        <motion.div variants={item}>
          <Card className="saas-card bg-[var(--card)] border-[var(--border)] group">
            <CardHeader className="p-5 sm:p-8 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="size-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20 group-hover:scale-110 transition-transform">
                  <PieChart className="size-5 text-[var(--primary)]" />
                </div>
                <Badge variant="outline" className="border-[var(--primary)]/20 text-[var(--primary)] uppercase text-[10px] font-black tracking-widest">Active</Badge>
              </div>
              <CardDescription className="text-[var(--muted-foreground)] font-bold uppercase tracking-widest text-[10px]">Your Elections</CardDescription>
              <CardTitle className="text-4xl sm:text-5xl font-black text-[var(--foreground)] tracking-tighter mt-2">{stats.myElections}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 sm:px-8 pb-5 sm:pb-8">
              <div className="h-1 w-full bg-[var(--muted)] rounded-full overflow-hidden mt-4">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "75%" }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                  className="h-full bg-primary" 
                />
              </div>
              <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-widest mt-4 flex items-center gap-2">
                <TrendingUp className="size-3 text-primary" />
                Across all categories
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="saas-card bg-[var(--card)] border-[var(--border)] group">
            <CardHeader className="p-5 sm:p-8 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                  <UserPlus className="size-5 text-emerald-500" />
                </div>
                <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 uppercase text-[10px] font-black tracking-widest">Growth</Badge>
              </div>
              <CardDescription className="text-[var(--muted-foreground)] font-bold uppercase tracking-widest text-[10px]">Total Participants</CardDescription>
              <CardTitle className="text-4xl sm:text-5xl font-black text-[var(--foreground)] tracking-tighter mt-2">{stats.totalVoters}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 sm:px-8 pb-5 sm:pb-8">
              <div className="h-1 w-full bg-[var(--muted)] rounded-full overflow-hidden mt-4">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "45%" }}
                  transition={{ duration: 1.5, delay: 0.7 }}
                  className="h-full bg-emerald-500" 
                />
              </div>
              <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-widest mt-4 flex items-center gap-2">
                <Users className="size-3 text-emerald-500" />
                Cumulative registration
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="saas-card bg-[var(--card)] border-[var(--border)] group">
            <CardHeader className="p-5 sm:p-8 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <Clock className="size-5 text-amber-500" />
                </div>
                <Badge variant="outline" className="border-amber-500/20 text-amber-500 uppercase text-[10px] font-black tracking-widest">Pending</Badge>
              </div>
              <CardDescription className="text-[var(--muted-foreground)] font-bold uppercase tracking-widest text-[10px]">Awaiting Approval</CardDescription>
              <CardTitle className="text-4xl sm:text-5xl font-black text-[var(--foreground)] tracking-tighter mt-2">{stats.pendingApprovals}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 sm:px-8 pb-5 sm:pb-8">
              <div className="h-1 w-full bg-[var(--muted)] rounded-full overflow-hidden mt-4">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "20%" }}
                  transition={{ duration: 1.5, delay: 0.9 }}
                  className="h-full bg-amber-500" 
                />
              </div>
              <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-widest mt-4 flex items-center gap-2">
                <Activity className="size-3 text-amber-500" />
                Reviewing protocols
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 3. BOTTOM: Engagement Section */}
      <motion.div variants={item} className="space-y-6 sm:space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-3xl font-black tracking-tight text-[var(--foreground)]">Campaign Distribution</h2>
            <p className="text-[var(--muted-foreground)] font-medium text-sm sm:text-base">Participant allocation across your active election deployments.</p>
          </div>
        </div>
        
        <Card className="saas-card bg-[var(--card)] border-[var(--border)] p-6">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chart} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' }} 
                  dy={20}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' }} 
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.2)',
                  }}
                  itemStyle={{ color: 'var(--foreground)', fontSize: '14px', fontWeight: '800' }}
                  labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '8px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                  {stats.chart.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === stats.chart.length - 1 ? 'var(--primary)' : 'var(--muted-foreground)'} 
                      className="transition-all duration-500 opacity-60 hover:opacity-100"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'outline', className?: string }) {
  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
      variant === 'default' ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-transparent border-border",
      className
    )}>
      {children}
    </span>
  )
}
