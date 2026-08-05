import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Settings, 
  Users, 
  CheckCircle2, 
  Zap, 
  Layers, 
  Edit, 
  Eye, 
  TrendingUp, 
  Inbox,
  Globe
} from 'lucide-react'
import { toast } from '@/lib/toast'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ElectionStatusBadge } from '@/modules/elections/election-status-badge'
import { ROUTES } from '@/constants/routes'
import { electionsService } from '@/services/elections.service'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Election = Database['public']['Tables']['elections']['Row']

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
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
}

export function ElectionsManagePage() {
  const { profile } = useAuth()
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'drafts' | 'active' | 'registration_open' | 'completed'>('all')

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await electionsService.listCreatedBy(profile.id)
        if (!cancelled) setElections(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [profile?.id])

  const handlePublish = async (id: string) => {
    try {
      await electionsService.update(id, { status: 'approved', approved_at: new Date().toISOString() })
      toast.success('Election published! It is now visible to all voters.')
      setElections(prev => prev.map(item => item.id === id ? { ...item, status: 'approved' } : item))
    } catch {
      toast.error('Failed to publish election.')
    }
  }

  const filtered = useMemo(() => {
    return elections.filter(e => {
      const matchesSearch = (e.title || '').toLowerCase().includes(search.toLowerCase()) || 
        (e.organization || '').toLowerCase().includes(search.toLowerCase())
      
      if (!matchesSearch) return false

      const now = new Date()
      const start = new Date(e.starts_at)
      const end = new Date(e.ends_at)
      const regStart = e.registration_opens_at ? new Date(e.registration_opens_at) : null
      const regEnd = e.registration_closes_at ? new Date(e.registration_closes_at) : null

      switch (filterTab) {
        case 'drafts':
          return e.status === 'draft' || e.status === 'pending_approval'
        case 'active':
          return e.status === 'active' && start <= now && end >= now
        case 'registration_open':
          return (e.status === 'active' || e.status === 'approved') && 
                 (!regStart || regStart <= now) && 
                 (!regEnd || regEnd >= now) &&
                 start > now
        case 'completed':
          return e.status === 'closed' || end < now
        case 'all':
        default:
          return true
      }
    })
  }, [elections, search, filterTab])

  if (loading) {
    return (
      <div className="page-container space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 border-b border-[var(--border)] pb-12">
           <Skeleton className="h-16 w-96 rounded-2xl" />
           <Skeleton className="h-14 w-64 rounded-2xl" />
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-80 rounded-[2.5rem]" />
          ))}
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
            <span>Campaign Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-[var(--foreground)]">
            Elections
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm sm:text-base max-w-2xl font-medium">
            Manage your electoral campaigns, monitor turnouts, and update registries.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full relative z-10">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)] group-focus-within:text-[var(--primary)] transition-colors" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search elections..." 
              className="h-11 pl-11 pr-4 rounded-xl border-[var(--border)] bg-[var(--card)] focus:ring-[var(--primary)]/20 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          <Button asChild className="btn-primary h-11 px-5 rounded-xl text-xs font-bold uppercase tracking-widest shrink-0 gap-2">
            <Link to={ROUTES.electionNew}>
              <Plus className="size-4" strokeWidth={2.5} />
              Create Election
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Filter Tabs — scrolls horizontally on mobile */}
      <motion.div variants={item} className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 relative z-10 -mx-1 px-1">
        {[
          { id: 'all', label: 'All Elections' },
          { id: 'drafts', label: 'Drafts & Pending' },
          { id: 'active', label: 'Active Voting' },
          { id: 'registration_open', label: 'Registration Open' },
          { id: 'completed', label: 'Completed' }
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={filterTab === tab.id ? 'default' : 'outline'}
            onClick={() => setFilterTab(tab.id as any)}
            className={cn(
              "rounded-xl h-9 px-4 text-[10px] font-black uppercase tracking-widest transition-all shrink-0 whitespace-nowrap",
              filterTab === tab.id 
                ? "bg-[var(--primary)] text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] border-[var(--primary)] hover:bg-[var(--primary)]" 
                : "bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
            )}
          >
            {tab.label}
          </Button>
        ))}
      </motion.div>

      {/* 2. MIDDLE: Manage Grid */}
      <div className="grid gap-8 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div 
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-40 text-center"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="size-24 rounded-full bg-[var(--muted)] flex items-center justify-center border border-[var(--border)] backdrop-blur-xl">
                  <Inbox className="size-12 text-[var(--muted-foreground)]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-[var(--foreground)] tracking-tight">No Campaigns Found</h3>
                  <p className="text-[var(--muted-foreground)] font-medium">You haven't created any elections yet. Start by creating your first campaign.</p>
                </div>
                <Button asChild variant="outline" className="h-12 px-8 rounded-xl border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[10px] font-black uppercase tracking-widest mt-4 text-[var(--foreground)]">
                  <Link to={ROUTES.electionsManage}>Back to Manage</Link>
                </Button>
              </div>
            </motion.div>
          ) : (
            filtered.map((e) => (
              <motion.div 
                key={e.id} 
                layout 
                variants={item}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="saas-card flex flex-col h-full bg-[var(--card)] border-[var(--border)] group hover:-translate-y-1 transition-all duration-300">
                  <CardHeader className="p-6 pb-4 relative overflow-hidden flex-1">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <ElectionStatusBadge election={e} />
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--muted)] text-[10px] font-bold text-[var(--muted-foreground)] tabular-nums tracking-widest uppercase">
                        <Users className="size-3" />
                        {e.registrant_count || 0} Registered
                      </div>
                    </div>
                    
                    <div className="space-y-2 relative z-10">
                      <CardTitle className="text-xl font-bold text-[var(--foreground)] tracking-tight group-hover:text-[var(--primary)] transition-colors line-clamp-1 leading-tight">
                        {e.title}
                      </CardTitle>
                      <p className="text-xs font-medium text-[var(--muted-foreground)]">
                        {e.organization || 'Independent Campaign'}
                      </p>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6 pt-0 mt-auto">
                    <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-2">
                      {['draft', 'pending_approval'].includes(e.status) && (
                        <Button
                          type="button"
                          onClick={() => handlePublish(e.id)}
                          className="btn-primary w-full h-9 rounded-md text-[10px] font-bold uppercase tracking-widest gap-1.5"
                        >
                          <Globe className="size-3.5" />
                          Publish to Public Panel
                        </Button>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        {/* VIEW — always creator view */}
                        <Button asChild variant="outline" className="h-9 rounded-md border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)]">
                          <Link to={ROUTES.electionCreatorView(e.id)} className="flex items-center justify-center gap-1.5">
                            <Eye className="size-3.5" />
                            View
                          </Link>
                        </Button>

                        {/* EDIT */}
                        {['draft', 'pending_approval', 'rejected'].includes(e.status) ? (
                          <Button asChild variant="outline" className="h-9 rounded-md border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)]">
                            <Link to={ROUTES.electionWizard(e.id)} className="flex items-center justify-center gap-1.5">
                              <Edit className="size-3.5" />
                              Edit
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild variant="outline" className="h-9 rounded-md border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)] opacity-50">
                            <Link to={ROUTES.electionEdit(e.id)} className="flex items-center justify-center gap-1.5">
                              <Edit className="size-3.5" />
                              Edit
                            </Link>
                          </Button>
                        )}

                        {/* MANAGE */}
                        <Button asChild variant="outline" className="h-9 rounded-md border-[var(--border)] bg-[var(--background)] hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:text-white text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)] transition-colors">
                          <Link to={ROUTES.electionEdit(e.id)} className="flex items-center justify-center gap-1.5">
                            <Settings className="size-3.5" />
                            Manage
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
