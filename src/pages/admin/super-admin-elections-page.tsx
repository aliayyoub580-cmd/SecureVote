import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { 
  Search, 
  Filter, 
  MoreHorizontal,
  Calendar,
  Users,
  Vote,
  AlertCircle,
  Settings,
  Trash2,
  PauseCircle,
  CheckCircle,
  PlayCircle
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { electionsService } from '@/services/elections.service'
import type { Database as DB } from '@/types/database'
import { format } from 'date-fns'
import { ROUTES } from '@/constants/routes'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/lib/toast'

type Election = DB['public']['Tables']['elections']['Row']

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

type TabType = 'all' | 'active' | 'upcoming' | 'registration_open' | 'completed'

export function SuperAdminElectionsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Election[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabType>('all')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const data = await electionsService.listAllAdmin()
      setRows(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleApprove = async (id: string) => {
    if (!profile) return
    try {
      await electionsService.approve(id, profile.id)
      toast.success('Election approved successfully')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve election')
    }
  }

  const handleToggleSuspend = async (id: string, currentlySuspended: boolean) => {
    try {
      await electionsService.setSuspended(id, !currentlySuspended)
      toast.success(currentlySuspended ? 'Election resumed successfully' : 'Election suspended successfully')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update suspension status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this election? This cannot be undone.')) return
    try {
      await electionsService.deleteElection(id)
      toast.success('Election deleted successfully')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete election')
    }
  }

  const filtered = useMemo(() => {
    const now = new Date()
    return rows.filter(e => {
      const matchesSearch = 
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (e.organization || '').toLowerCase().includes(search.toLowerCase())
      
      let matchesTab = true
      const start = new Date(e.starts_at)
      const end = new Date(e.ends_at)
      
      if (tab === 'active') {
        matchesTab = e.status === 'active' && start <= now && end >= now
      } else if (tab === 'upcoming') {
        matchesTab = start > now && e.status !== 'closed'
      } else if (tab === 'completed') {
        matchesTab = e.status === 'closed' || end < now
      } else if (tab === 'registration_open') {
        // Simplified registration open check
        matchesTab = e.status !== 'closed' && end >= now
      }

      return matchesSearch && matchesTab
    })
  }, [rows, search, tab])

  return (
    <motion.div 
      className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">Elections Registry</h1>
          <p className="text-[var(--muted-foreground)] font-medium">
            Monitor and manage all election campaigns across the platform.
          </p>
        </div>
      </motion.div>

      {/* Filters and Tabs */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar pb-2 sm:pb-0">
          {(['all', 'active', 'upcoming', 'registration_open', 'completed'] as TabType[]).map((t) => (
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
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search elections..." 
            className="h-10 pl-9 rounded-xl border-[var(--border)] bg-[var(--card)] text-sm"
          />
        </div>
      </motion.div>

      {/* Grid of Elections */}
      <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="h-[240px] bg-[var(--card)] animate-pulse border-none rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[var(--muted-foreground)] font-medium bg-[var(--card)] rounded-2xl border border-[var(--border)]">
            No elections found matching the criteria.
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(e => (
              <motion.div 
                key={e.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="saas-card bg-[var(--card)] border-[var(--border)] h-full flex flex-col group hover:-translate-y-1 transition-all duration-300">
                  <CardHeader className="p-5 pb-3 flex-1 relative overflow-hidden border-b border-[var(--border)]/50">
                    <div className="flex items-center justify-between mb-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border",
                        e.suspended ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        e.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        e.status === 'closed' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                        e.status === 'pending_approval' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}>
                        {e.suspended ? 'SUSPENDED' : e.status.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground)] font-bold px-2 py-1 bg-[var(--muted)] rounded-md">
                        <Users className="size-3" />
                        {e.registrant_count || 0}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-bold text-[var(--foreground)] tracking-tight truncate">
                        {e.title}
                      </CardTitle>
                      <p className="text-xs text-[var(--muted-foreground)] font-medium">
                        {e.organization || 'Independent'}
                      </p>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-5 flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="space-y-1">
                        <span className="text-[10px] text-[var(--muted-foreground)] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="size-3" /> Registration
                        </span>
                        <p className="text-xs font-bold text-[var(--foreground)]">
                           {e.registration_closes_at ? format(new Date(e.registration_closes_at), 'MMM d, yyyy') : format(new Date(e.starts_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-[var(--muted-foreground)] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Vote className="size-3" /> Voting Ends
                        </span>
                        <p className="text-xs font-bold text-[var(--foreground)]">
                          {format(new Date(e.ends_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-4 border-t border-[var(--border)]">
                      {e.status === 'pending_approval' ? (
                        <Button 
                          onClick={() => handleApprove(e.id)}
                          className="h-8 flex-1 rounded-lg font-bold text-[10px] uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        >
                          <CheckCircle className="mr-2 size-3.5" />
                          Approve Election
                        </Button>
                      ) : (
                        <Button 
                          asChild
                          className="h-8 flex-1 rounded-lg font-bold text-[10px] uppercase tracking-widest bg-[var(--primary)] hover:bg-[var(--primary)] hover:opacity-90 text-white shadow-[0_0_15px_rgba(20,184,166,0.2)]"
                        >
                          <Link to={ROUTES.adminElectionManage(e.id)}>Manage Center</Link>
                        </Button>
                      )}
                      {e.status !== 'pending_approval' && (
                        <Button 
                          onClick={() => handleToggleSuspend(e.id, e.suspended || false)}
                          variant="outline" 
                          size="icon" 
                          className={cn(
                            "h-8 w-8 rounded-lg border-[var(--border)] bg-transparent transition-all",
                            e.suspended 
                              ? "text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500 border-emerald-500/30 bg-emerald-500/5" 
                              : "hover:bg-amber-500/10 hover:text-amber-500"
                          )}
                          title={e.suspended ? "Resume Election" : "Suspend/Pause Election"}
                        >
                          {e.suspended ? <PlayCircle className="size-3.5" /> : <PauseCircle className="size-3.5" />}
                        </Button>
                      )}
                      <Button 
                        onClick={() => handleDelete(e.id)}
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg border-[var(--border)] bg-transparent hover:bg-rose-500/10 hover:text-rose-500"
                        title="Delete Election"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>
    </motion.div>
  )
}

