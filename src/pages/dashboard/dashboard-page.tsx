import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { 
  ArrowRight,
  Vote,
  ShieldCheck,
  History,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { ROUTES } from '@/constants/routes'
import { electionsService } from '@/services/elections.service'
import type { Database } from '@/types/database'
import { Skeleton } from '@/components/ui/skeleton'

type Election = Database['public']['Tables']['elections']['Row']

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 100 } }
}

export function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  
  const [activeElections, setActiveElections] = useState<Election[]>([])
  const [upcomingElections, setUpcomingElections] = useState<Election[]>([])
  const [joinedCount, setJoinedCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [all, joinedIds] = await Promise.all([
          electionsService.listPublic(),
          electionsService.listJoinedIds()
        ])
        
        const now = new Date()
        const active = all.filter(e => e.status === 'active' && new Date(e.starts_at) <= now && new Date(e.ends_at) >= now)
        const upcoming = all.filter(e => e.status === 'approved' && new Date(e.starts_at) > now)
        const completed = all.filter(e => e.status === 'closed' || new Date(e.ends_at) < now)

        setActiveElections(active.slice(0, 3))
        setUpcomingElections(upcoming.slice(0, 3))
        setJoinedCount(joinedIds.length)
        setCompletedCount(completed.length)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (profile?.role === 'super_admin') {
    return <Navigate to={ROUTES.admin} replace />
  }
  if (profile?.role === 'election_creator') {
    return <Navigate to={ROUTES.creatorDashboard} replace />
  }

  // VOTER DASHBOARD
  return (
    <motion.div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-12" variants={container} initial="hidden" animate="show">
      
      {/* 1. Header & Stats */}
      <div className="space-y-6">
        <h1 className="page-title">Dashboard</h1>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div variants={item}>
            <Card className="saas-card p-6">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-[var(--accent-info)]/10 flex items-center justify-center text-[var(--accent-info)]">
                   <Vote className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">Joined Elections</p>
                  <h3 className="text-2xl font-semibold text-[var(--foreground)]">{joinedCount}</h3>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="saas-card p-6">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                   <Activity className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">Active Elections</p>
                  <h3 className="text-2xl font-semibold text-[var(--foreground)]">{activeElections.length}</h3>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="saas-card p-6">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                   <Calendar className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">Upcoming</p>
                  <h3 className="text-2xl font-semibold text-[var(--foreground)]">{upcomingElections.length}</h3>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="saas-card p-6">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)]">
                   <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">Completed</p>
                  <h3 className="text-2xl font-semibold text-[var(--foreground)]">{completedCount}</h3>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* 2. Active Elections Section */}
      <motion.div variants={item} className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="section-title">Active Elections</h2>
           <Button variant="link" className="text-[var(--accent-info)] hover:text-[var(--accent-info)]/80 px-0" asChild>
             <Link to={ROUTES.elections}>View All <ArrowRight className="ml-2 size-4" /></Link>
           </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[280px] rounded-2xl bg-zinc-900" />
            ))
          ) : activeElections.length === 0 ? (
            <Card className="col-span-full saas-card p-12 flex flex-col items-center justify-center text-center">
               <AlertCircle className="size-8 text-[var(--muted-foreground)] mb-4" />
               <p className="text-[var(--muted-foreground)] font-medium">No active elections at the moment.</p>
            </Card>
          ) : (
            activeElections.map((e) => (
              <motion.div key={e.id} whileHover={{ y: -4 }}>
                <Card className="saas-card p-6 flex flex-col h-full gap-6">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="badge-success">Voting Live</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-[var(--foreground)] leading-tight mb-1 truncate">{e.title}</h3>
                      <p className="text-sm text-[var(--muted-foreground)] truncate">{e.organization || 'Independent'}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <Clock className="size-4" />
                      <span>Ends {new Date(e.ends_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/[0.04] grid grid-cols-2 gap-3">
                    <Button className="btn-secondary w-full" asChild>
                      <Link to={ROUTES.electionDetail(e.id)}>Details</Link>
                    </Button>
                    <Button className="btn-primary w-full" asChild>
                      <Link to={ROUTES.electionVote(e.id)}>Vote Now</Link>
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

    </motion.div>
  )
}

import { Activity } from 'lucide-react'
