import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Search, 
  Vote, 
  CheckCircle2, 
  History, 
  Calendar,
  Clock,
  AlertCircle,
  Users,
  Filter
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useAuth } from '@/contexts/auth-context'
import { ROUTES } from '@/constants/routes'
import { electionsService } from '@/services/elections.service'
import { votesService } from '@/services/votes.service'
import { isRegistrationOpen, isRegistrationUpcoming } from '@/lib/election-utils'
import type { Database } from '@/types/database'

type Election = Database['public']['Tables']['elections']['Row']

type JoinedElectionInfo = {
  election: Election
  hasVoted: boolean
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 100 } }
}

export function MyVotesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [joinedElections, setJoinedElections] = useState<JoinedElectionInfo[]>([])
  
  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const [allElections, joinedIds] = await Promise.all([
          electionsService.listPublic(),
          electionsService.listJoinedIds()
        ])
        
        if (cancelled) return

        // Filter all elections to only those joined by the user
        const joined = allElections.filter(e => joinedIds.includes(e.id))
        
        // Check vote status for each
        const results = await Promise.all(
          joined.map(async (election) => {
            const hasVoted = await votesService.ballotUsed(election.id, profile.id)
            return { election, hasVoted }
          })
        )

        if (!cancelled) {
          setJoinedElections(results)
        }
      } catch (error) {
        console.error('Error fetching joined elections:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [profile])

  // Computed Stats
  const now = new Date()
  const stats = {
    totalJoined: joinedElections.length,
    activeVotes: joinedElections.filter(j => 
      j.election.status === 'active' && 
      new Date(j.election.starts_at) <= now && 
      new Date(j.election.ends_at) >= now && 
      !j.hasVoted
    ).length,
    completedElections: joinedElections.filter(j => 
      j.election.status === 'closed' || new Date(j.election.ends_at) < now
    ).length,
    votedCount: joinedElections.filter(j => j.hasVoted).length
  }

  const getStatusInfo = (election: Election, hasVoted: boolean) => {
    const start = new Date(election.starts_at)
    const end = new Date(election.ends_at)
    const isCompleted = election.status === 'closed' || end < now
    const isLive = election.status === 'active' && start <= now && end >= now

    if (isCompleted) return { label: 'Completed', type: 'neutral', value: 'Completed' }
    if (hasVoted) return { label: 'Vote Submitted', type: 'success', value: 'Voted' }
    if (isLive) return { label: 'Voting Live', type: 'success', value: 'Voting Live' }
    if (isRegistrationOpen(election)) return { label: 'Registration Open', type: 'warning', value: 'Registration Open' }
    if (isRegistrationUpcoming(election)) return { label: 'Registration Upcoming', type: 'neutral', value: 'Registration Upcoming' }
    
    return { label: 'Registration Closed', type: 'error', value: 'Registration Closed' }
  }

  // Filtering Logic
  const filtered = joinedElections.filter(({ election, hasVoted }) => {
    const matchesSearch = (election.title || '').toLowerCase().includes(search.toLowerCase()) || 
                          (election.organization || '').toLowerCase().includes(search.toLowerCase())
    
    if (!matchesSearch) return false

    if (statusFilter === 'All') return true
    
    const info = getStatusInfo(election, hasVoted)
    if (statusFilter === 'Voted' && hasVoted) return true
    if (statusFilter === 'Not Voted' && !hasVoted && !['Completed', 'Registration Closed'].includes(info.value)) return true
    return info.value === statusFilter
  })

  const renderBadge = (type: string, label: string) => {
    const classes = {
      success: 'badge-success',
      warning: 'badge-warning',
      error: 'badge-error',
      neutral: 'badge-neutral'
    }
    return <span className={classes[type as keyof typeof classes]}>{label}</span>
  }

  const renderActionButton = (election: Election, hasVoted: boolean) => {
    const start = new Date(election.starts_at)
    const end = new Date(election.ends_at)
    const isCompleted = election.status === 'closed' || end < now
    const isLive = election.status === 'active' && start <= now && end >= now

    if (isCompleted) {
      return (
        <Button className="btn-secondary w-full" asChild>
          <Link to={ROUTES.electionResults(election.id)}>View Results</Link>
        </Button>
      )
    }

    if (hasVoted) {
      return (
        <Button className="btn-secondary w-full" variant="outline" asChild>
          <Link to={ROUTES.electionDetail(election.id)}>View Receipt</Link>
        </Button>
      )
    }

    if (isLive) {
      return (
        <Button className="btn-primary w-full" asChild>
          <Link to={ROUTES.electionVote(election.id)}>Vote Now</Link>
        </Button>
      )
    }

    // Pending/Waiting
    return (
      <Button className="btn-secondary w-full opacity-70 cursor-not-allowed" disabled>
        Waiting for Voting
      </Button>
    )
  }

  return (
    <motion.div className="px-4 py-6 sm:px-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8" variants={container} initial="hidden" animate="show">
      
      {/* Top Section */}
      <motion.div variants={item} className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[var(--foreground)]">My Votes</h1>
           <p className="text-sm sm:text-base text-[var(--muted-foreground)]">Track your joined elections, voting activity, and results.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-[300px] group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)] group-focus-within:text-[var(--primary)] transition-colors" />
            <Input 
              placeholder="Search history..." 
              className="h-10 w-full rounded-xl bg-[var(--card)] border border-[var(--border)] pl-9 pr-4 text-sm font-medium focus:ring-[var(--primary)]/20 transition-all placeholder:text-[var(--muted-foreground)]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 w-full sm:w-[180px] bg-[var(--card)] border border-[var(--border)] justify-between text-[var(--foreground)]">
                <span className="flex items-center gap-2"><Filter className="size-4" /> {statusFilter}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[180px] bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                {['All', 'Registration Open', 'Voting Live', 'Completed', 'Voted', 'Not Voted'].map(f => (
                  <DropdownMenuRadioItem key={f} value={f} className="cursor-pointer">{f}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* Stats Cards Section */}
      <motion.div variants={item} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="saas-card p-6 border-blue-500/10 hover:border-blue-500/30">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
               <History className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--muted-foreground)]">Joined Elections</p>
              <h3 className="text-2xl font-semibold text-[var(--foreground)]">{stats.totalJoined}</h3>
            </div>
          </div>
        </Card>
        <Card className="saas-card p-6 border-emerald-500/10 hover:border-emerald-500/30">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
               <Vote className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--muted-foreground)]">Active Votes</p>
              <h3 className="text-2xl font-semibold text-[var(--foreground)]">{stats.activeVotes}</h3>
            </div>
          </div>
        </Card>
        <Card className="saas-card p-6 border-zinc-500/10 hover:border-zinc-500/30">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-lg bg-zinc-500/10 flex items-center justify-center text-zinc-400">
               <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--muted-foreground)]">Completed</p>
              <h3 className="text-2xl font-semibold text-[var(--foreground)]">{stats.completedElections}</h3>
            </div>
          </div>
        </Card>
        <Card className="saas-card p-6 border-amber-500/10 hover:border-amber-500/30">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
               <Clock className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--muted-foreground)]">Pending Votes</p>
              <h3 className="text-2xl font-semibold text-[var(--foreground)]">{stats.totalJoined - stats.votedCount}</h3>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Election History Section */}
      <motion.div variants={item} className="space-y-6">
        <h2 className="section-title">Election History</h2>
        
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[360px] rounded-2xl bg-[var(--card)]" />
             ))}
          </div>
        ) : joinedElections.length === 0 ? (
          <Card className="saas-card p-16 flex flex-col items-center justify-center text-center space-y-6">
             <div className="size-20 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-2">
                <Vote className="size-10" />
             </div>
             <div>
                <h3 className="text-2xl font-semibold text-[var(--foreground)]">You haven't joined any elections yet.</h3>
                <p className="text-[var(--muted-foreground)] mt-2 max-w-md mx-auto">Explore active elections and participate in shaping your community's future.</p>
             </div>
             <Button className="btn-primary mt-4" asChild>
                <Link to={ROUTES.elections}>Browse Elections</Link>
             </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
             <AlertCircle className="size-10 text-[var(--muted-foreground)] mb-4" />
             <p className="text-[var(--foreground)] font-medium text-lg">No elections match your filters.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {filtered.map(({ election, hasVoted }) => {
               const statusInfo = getStatusInfo(election, hasVoted)
               
               return (
                 <motion.div key={election.id} variants={item} whileHover={{ y: -4 }}>
                   <Card className="saas-card p-6 flex flex-col h-full gap-6">
                     {/* Badges */}
                     <div className="flex items-start justify-between">
                       {renderBadge(statusInfo.type, statusInfo.label)}
                       <div className="flex items-center gap-1.5 text-[var(--muted-foreground)] text-xs font-medium bg-[var(--muted)] px-2 py-1 rounded-md border border-[var(--border)]">
                         <Users className="size-3" />
                         {election.registrant_count || 0}
                       </div>
                     </div>

                     {/* Content */}
                     <div className="space-y-2 flex-1 min-h-0">
                       <h3 className="text-xl font-semibold text-[var(--foreground)] leading-tight truncate">
                         {election.title}
                       </h3>
                       <p className="text-sm font-medium text-[var(--muted-foreground)] truncate">
                         {election.organization || 'Independent'}
                       </p>
                       <p className="text-sm text-[var(--muted-foreground)] line-clamp-2 mt-3 leading-relaxed">
                         {election.description || 'No description provided.'}
                       </p>
                     </div>

                     {/* Deadlines */}
                     <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
                       <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-semibold flex items-center gap-1">
                            <Calendar className="size-3" /> Registration
                          </span>
                          <p className="text-sm font-medium text-[var(--foreground)]">{new Date(election.starts_at).toLocaleDateString()}</p>
                       </div>
                       <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-semibold flex items-center gap-1">
                            <Clock className="size-3" /> Voting Deadline
                          </span>
                          <p className="text-sm font-medium text-[var(--foreground)]">{new Date(election.ends_at).toLocaleDateString()}</p>
                       </div>
                     </div>

                     {/* Actions */}
                     <div className="pt-2">
                        {renderActionButton(election, hasVoted)}
                     </div>
                   </Card>
                 </motion.div>
               )
             })}
          </div>
        )}
      </motion.div>

    </motion.div>
  )
}
