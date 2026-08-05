import { useEffect, useMemo, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { 
  Search, 
  Users, 
  Calendar,
  Clock,
  LayoutGrid,
  AlertCircle,
  Globe
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { electionsService } from '@/services/elections.service'
import { isRegistrationOpen, isRegistrationUpcoming, getDisplayPhase } from '@/lib/election-utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { Database } from '@/types/database'
import { useAuth } from '@/contexts/auth-context'

type Election = Database['public']['Tables']['elections']['Row']

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 100 } }
}

export function ElectionsDiscoverPage() {
  const [loading, setLoading] = useState(true)
  const [elections, setElections] = useState<Election[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const data = await electionsService.listPublic()
        setElections(data)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'title'>('recent')
  const [filterPhase, setFilterPhase] = useState<'all' | 'live' | 'registration_open' | 'upcoming' | 'completed'>('all')

  const filtered = useMemo(() => {
    let list = [...elections]

    // 1. Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => 
        (e.title || '').toLowerCase().includes(q) ||
        (e.organization || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
      )
    }

    // 2. Phase filter
    if (filterPhase !== 'all') {
      const now = new Date()
      list = list.filter(e => {
        const displayPhase = getDisplayPhase(e, now)

        if (filterPhase === 'live') {
          return displayPhase === 'voting'
        }
        if (filterPhase === 'registration_open') {
          return isRegistrationOpen(e, now) || isRegistrationUpcoming(e, now)
        }
        if (filterPhase === 'upcoming') {
          return displayPhase === 'scheduled'
        }
        if (filterPhase === 'completed') {
          return displayPhase === 'ended' || e.status === 'closed'
        }
        return true
      })
    }

    // 3. Sorting
    list.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'popular') {
        return (b.registrant_count || 0) - (a.registrant_count || 0)
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '')
      }
      return 0
    })

    return list
  }, [elections, search, sortBy, filterPhase])

  const getStatusBadge = (e: Election) => {
    const now = new Date()
    const start = new Date(e.starts_at)
    const end = new Date(e.ends_at)

    if (e.status === 'closed' || end < now) return <span className="badge-neutral">Completed</span>
    if (e.status === 'active' && start <= now && end >= now) return <span className="badge-success">Voting Live</span>
    if (isRegistrationOpen(e)) return <span className="badge-warning">Registration Open</span>
    if (isRegistrationUpcoming(e)) return <span className="badge-neutral">Registration Upcoming</span>
    return <span className="badge-error">Registration Closed</span>
  }

  return (
    <motion.div className="px-4 py-6 sm:px-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6" variants={container} initial="hidden" animate="show">
      
      {/* Header Area */}
      <motion.div variants={item} className="space-y-4">
        <div className="space-y-1">
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[var(--foreground)]">Browse Elections</h1>
           <p className="text-sm sm:text-base text-[var(--muted-foreground)] font-medium">Discover and participate in active elections.</p>
        </div>
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)] group-focus-within:text-[var(--primary)] transition-colors" />
          <Input 
            placeholder="Search elections or organizations..." 
            className="h-11 w-full rounded-xl bg-[var(--card)] border border-[var(--border)] pl-9 pr-4 text-sm font-medium focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]/50 transition-all placeholder:text-[var(--muted-foreground)] text-[var(--foreground)]"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </motion.div>

      {/* Filters and Sorting Controls */}
      <motion.div variants={item} className="bg-[var(--card)] border border-[var(--border)] p-3 sm:p-4 rounded-2xl space-y-3">
        {/* Phase Filter Pills — scrolls horizontally on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {[
            { value: 'all', label: 'All' },
            { value: 'live', label: 'Voting Live' },
            { value: 'registration_open', label: 'Registration Open' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterPhase(tab.value as any)}
              className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                filterPhase === tab.value
                  ? "bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)] shadow-sm"
                  : "bg-transparent border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort Row */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-[10px] font-black text-[var(--muted-foreground)] uppercase tracking-widest">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-8 px-2 sm:px-3 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 cursor-pointer"
          >
            <option value="recent" className="bg-[var(--card)] text-[var(--foreground)]">Recent</option>
            <option value="popular" className="bg-[var(--card)] text-[var(--foreground)]">Most Registered</option>
            <option value="title" className="bg-[var(--card)] text-[var(--foreground)]">A–Z</option>
          </select>
        </div>
      </motion.div>

      {/* Grid: Clean Cards */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[340px] rounded-2xl bg-[var(--muted)]" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center flex flex-col items-center">
             <AlertCircle className="size-10 text-[var(--muted-foreground)] mb-4 animate-bounce" />
             <p className="text-[var(--foreground)] font-medium text-lg">No elections found</p>
             <p className="text-sm text-[var(--muted-foreground)] mt-1">Try adjusting your search criteria</p>
          </div>
        ) : (
          filtered.map((e) => (
            <motion.div key={e.id} variants={item} whileHover={{ y: -4 }}>
              <Card className="saas-card p-6 flex flex-col h-[340px] gap-6 group relative overflow-hidden">
                {/* Background Globe Icon */}
                <Globe className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-48 text-[var(--foreground)] opacity-[0.03] transition-all duration-500 group-hover:text-[var(--primary)] group-hover:opacity-10 group-hover:scale-105 pointer-events-none" strokeWidth={1} />
                
                {/* Status Badge */}
                <div className="flex items-start justify-between">
                  {getStatusBadge(e)}
                  <div className="flex items-center gap-1.5 text-[var(--muted-foreground)] text-xs font-medium bg-[var(--muted)] px-2 py-1 rounded-md border border-[var(--border)]">
                    <Users className="size-3" />
                    {e.registrant_count || 0}
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-2 flex-1 min-h-0 relative z-10">
                  <h2 className="text-xl font-semibold text-[var(--foreground)] leading-tight truncate transition-colors duration-300 group-hover:text-[var(--primary)]">
                    {e.title}
                  </h2>
                  <p className="text-sm font-medium text-[var(--muted-foreground)] truncate">
                    {e.organization || 'Independent'}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)] line-clamp-2 mt-3 leading-relaxed">
                    {e.description || 'No description provided.'}
                  </p>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)] relative z-10">
                  <div className="space-y-1">
                     <span className="text-xs text-[var(--muted-foreground)] font-medium flex items-center gap-1.5"><Calendar className="size-3" /> Registration</span>
                     <p className="text-sm font-medium text-[var(--foreground)]">
                       {e.registration_opens_at ? new Date(e.registration_opens_at).toLocaleDateString() : '—'}
                     </p>
                  </div>
                  <div className="space-y-1">
                     <span className="text-xs text-[var(--muted-foreground)] font-medium flex items-center gap-1.5"><Clock className="size-3" /> Voting</span>
                     <p className="text-sm font-medium text-[var(--foreground)]">{new Date(e.starts_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2 relative z-10">
                  <Button variant="outline" className="w-full rounded-xl border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]" asChild>
                    <Link to={ROUTES.electionDetail(e.id)}>Details</Link>
                  </Button>
                  {e.status === 'active' && new Date(e.starts_at) <= new Date() && new Date(e.ends_at) >= new Date() ? (
                    <Button className="btn-primary w-full" asChild>
                      <Link to={ROUTES.electionVote(e.id)}>Vote Now</Link>
                    </Button>
                  ) : (
                    <Button className="btn-primary w-full" asChild>
                      <Link to={ROUTES.electionDetail(e.id)}>Join Election</Link>
                    </Button>
                  )}
                </div>

              </Card>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  )
}
