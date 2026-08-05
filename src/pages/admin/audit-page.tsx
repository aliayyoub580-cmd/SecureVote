import { format } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Database,
  Clock,
  ShieldAlert,
  Lock,
  Inbox,
  Terminal,
  LayoutGrid,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DataTable, type Column } from '@/components/tables/data-table'
import { useAdminAuditRealtime } from '@/hooks/use-admin-audit-realtime'
import { downloadAuditCsv } from '@/lib/audit-export'
import { auditService } from '@/services/audit.service'
import type { Database as DB } from '@/types/database'
import { cn } from '@/lib/utils'

type Row = DB['public']['Tables']['audit_logs']['Row']

const TABS = [
  { id: 'all', label: 'All Activity', icon: LayoutGrid },
  { id: 'audit', label: 'Audit Logs', icon: Database },
  { id: 'logins', label: 'Login Activity', icon: Lock },
  { id: 'security', label: 'Security Alerts', icon: ShieldAlert },
] as const

const PAGE_SIZES = [25, 50, 100] as const

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

export function AuditPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'all'
  
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [pageSize] = useState<(typeof PAGE_SIZES)[number]>(50)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 320)
    return () => window.clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const tabConfig = TABS.find(t => t.id === activeTab)
      const { rows: data, total: t } = await auditService.listAdminPaged({
        limit: pageSize,
        offset: page * pageSize,
        category: (tabConfig as any)?.category || null,
        search: debouncedSearch || null,
      })
      setRows(data)
      setTotal(t)
    } catch (e) {
      console.error(e)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, activeTab, debouncedSearch])

  useEffect(() => {
    void load()
  }, [load])

  useAdminAuditRealtime(true, () => {
    void load()
  })

  const setTab = (id: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (id === 'all') next.delete('tab')
      else next.set('tab', id)
      return next
    })
    setPage(0)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const cols: Column<Row>[] = useMemo(
    () => [
      {
        id: 'when',
        header: 'Timestamp',
        cell: (r) => (
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
            <Clock className="size-3.5 text-[var(--muted-foreground)]" />
            <span>{format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss')}</span>
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        cell: (r) => (
          <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--muted)] text-[var(--foreground)]">
            {r.category ?? 'general'}
          </span>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        cell: (r) => <span className="text-xs font-bold text-[var(--foreground)]">{r.action}</span>,
      },
      {
        id: 'user',
        header: 'Actor',
        cell: (r) =>
          r.actor_id ? <code className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">{r.actor_id.slice(0, 8)}</code> : <span className="text-xs text-[var(--muted-foreground)]">—</span>,
      },
      {
        id: 'origin',
        header: 'Source IP',
        cell: (r) => (
          <span className="text-[10px] font-semibold text-[var(--muted-foreground)]">
            {r.ip_address || 'Internal'}
          </span>
        ),
      },
      {
        id: 'meta',
        header: 'Metadata',
        cell: (r) => (
          <div className="max-w-[200px] truncate text-[10px] font-mono text-[var(--muted-foreground)]">
            {JSON.stringify(r.metadata)}
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <motion.div 
      className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[var(--border)]">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">Activity & Security</h1>
          <p className="text-[var(--muted-foreground)] font-medium">
            Monitor real-time system logs, admin actions, and security alerts.
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-10 rounded-xl border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-sm font-bold transition-all gap-2"
            disabled={rows.length === 0}
            onClick={() => downloadAuditCsv(rows, `audit-report-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`)}
          >
            <Download className="size-4" />
            Export Logs
          </Button>
        </div>
      </motion.div>

      {/* Filters and Search Bar */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar pb-2 sm:pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2",
                activeTab === tab.id 
                  ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20" 
                  : "bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..." 
            className="h-10 pl-9 rounded-xl border-[var(--border)] bg-[var(--card)] text-sm"
          />
        </div>
      </motion.div>

      {/* Data Table */}
      <motion.div variants={item}>
        <Card className="saas-card bg-[var(--card)] border-[var(--border)] overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-4 p-8">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-14 bg-[var(--muted)] animate-pulse rounded-xl" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-24 text-center">
                <Terminal className="size-12 text-[var(--muted-foreground)] mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-[var(--foreground)] tracking-tight">No Logs Found</h3>
                <p className="text-[var(--muted-foreground)] font-medium mt-1">Adjust your filters or search parameters.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                <DataTable columns={cols} data={rows} getRowId={(r) => r.id} className="border-0" />
                
                <div className="p-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--card)]">
                  <div className="flex items-center gap-4">
                    <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Page <span className="text-[var(--foreground)]">{page + 1}</span> of <span className="text-[var(--foreground)]">{totalPages}</span>
                    </p>
                    <div className="h-4 w-px bg-[var(--border)]" />
                    <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Total <span className="text-[var(--foreground)]">{total}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-9 px-4 rounded-lg border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-xs font-bold gap-2 transition-all"
                      disabled={page <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="size-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 px-4 rounded-lg border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-xs font-bold gap-2 transition-all"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
