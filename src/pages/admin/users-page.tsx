import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { 
  Users as UsersIcon, 
  Mail, 
  Building, 
  Ban, 
  UserCheck, 
  Search,
  LayoutGrid,
  ShieldAlert as AdminIcon,
  Zap as CreatorIcon,
  User as VoterIcon,
  Slash as BlockedIcon,
  Calendar,
  MoreHorizontal
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/tables/data-table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROLE_LABELS, ROLE_ORDER } from '@/constants/roles'
import { auditService } from '@/services/audit.service'
import { profilesService } from '@/services/profiles.service'
import type { Database as DB } from '@/types/database'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

type Profile = DB['public']['Tables']['profiles']['Row'] & { is_blocked?: boolean }

const TABS = [
  { id: 'all', label: 'All Users', icon: LayoutGrid },
  { id: 'super_admin', label: 'Admins', icon: AdminIcon },
  { id: 'election_creator', label: 'Election Creators', icon: CreatorIcon },
  { id: 'voter', label: 'Voters', icon: VoterIcon },
  { id: 'blocked', label: 'Blocked Users', icon: BlockedIcon },
] as const

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

export function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'all'
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const all = await profilesService.listAll()
      setRows(all)
    } catch (e) {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = [...rows]
    
    // Tab Filter
    if (activeTab === 'blocked') {
      list = list.filter(r => r.is_blocked)
    } else if (activeTab !== 'all') {
      list = list.filter(r => r.role === activeTab)
    }

    // Search Filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => 
        (r.full_name || '').toLowerCase().includes(q) || 
        (r.email || '').toLowerCase().includes(q) ||
        (r.organization || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [rows, activeTab, search])

  const setTab = (id: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (id === 'all') next.delete('tab')
      else next.set('tab', id)
      return next
    })
  }

  const changeRole = async (userId: string, role: Profile['role']) => {
    try {
      await profilesService.updateRole(userId, role)
      await auditService.log('profile.role_changed', 'profile', userId, { role })
      toast.success('User role updated.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const toggleBlock = async (p: Profile) => {
    const next = !p.is_blocked
    try {
      toast.success(next ? 'User blocked' : 'User unblocked')
      setRows(prev => prev.map(r => r.id === p.id ? { ...r, is_blocked: next } : r))
      await auditService.log(next ? 'admin.user_blocked' : 'admin.user_unblocked', 'profile', p.id, {})
    } catch (e) {
      toast.error('Action failed')
    }
  }

  const cols: Column<Profile>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-[var(--foreground)] truncate max-w-[200px]">{r.full_name || 'Unnamed User'}</span>
          <span className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-widest">{r.id.slice(0, 8)}</span>
        </div>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      cell: (r) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Mail className="size-3.5 text-[var(--muted-foreground)]" />
            <span className="text-xs font-medium text-[var(--foreground)]">{r.email || '—'}</span>
          </div>
          {r.organization && (
            <div className="flex items-center gap-2">
              <Building className="size-3.5 text-[var(--muted-foreground)]" />
              <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">{r.organization}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'joined',
      header: 'Joined Date',
      cell: (r) => (
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
           <Calendar className="size-3.5 text-[var(--muted-foreground)]" />
           {format(new Date(r.created_at), 'MMM d, yyyy')}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <span className={cn(
          "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border",
          r.is_blocked ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        )}>
          {r.is_blocked ? 'Blocked' : 'Active'}
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (r) => (
        <Select value={r.role} onValueChange={(v) => void changeRole(r.id, v as Profile['role'])}>
          <SelectTrigger className="h-9 rounded-lg bg-[var(--card)] border-[var(--border)] text-xs font-bold w-[140px] text-[var(--foreground)] focus:ring-[var(--primary)]/20 transition-all">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]">
            {ROLE_ORDER.map((role) => (
              <SelectItem key={role} value={role} className="rounded-lg font-bold text-[10px] uppercase tracking-widest focus:bg-[var(--muted)] transition-colors">
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'actions',
      header: '',
      className: 'text-right',
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title={r.is_blocked ? "Unblock User" : "Block User"}
            onClick={() => void toggleBlock(r)}
            className={cn(
              "size-9 rounded-lg transition-all border",
              r.is_blocked ? "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-600" : "bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"
            )}
          >
            {r.is_blocked ? <UserCheck className="size-4" /> : <Ban className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-9 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
             <MoreHorizontal className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <motion.div 
      className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">Users</h1>
          <p className="text-[var(--muted-foreground)] font-medium">
            Manage all platform users, roles, and access permissions.
          </p>
        </div>
      </motion.div>

      {/* Filters and Tabs */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar pb-2 sm:pb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2",
                activeTab === t.id 
                  ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" 
                  : "bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..." 
            className="h-10 pl-9 rounded-xl border-[var(--border)] bg-[var(--card)] text-sm"
          />
        </div>
      </motion.div>

      {/* Grid of Users / Table */}
      <motion.div variants={item}>
        <Card className="saas-card bg-[var(--card)] border-[var(--border)] overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-4 p-8">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-14 bg-zinc-900/50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-24 text-center">
                <UsersIcon className="size-12 text-[var(--muted-foreground)] mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-[var(--foreground)] tracking-tight">No Users Found</h3>
                <p className="text-[var(--muted-foreground)] font-medium mt-1">Try adjusting your filters or search query.</p>
              </div>
            ) : (
              <DataTable columns={cols} data={filtered} getRowId={(r) => r.id} className="border-0" />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
