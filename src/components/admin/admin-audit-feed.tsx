import { format } from 'date-fns'
import { History, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'
import { ROUTES } from '@/constants/routes'

type AuditRow = Database['public']['Tables']['audit_logs']['Row']

export function AdminAuditFeed({ rows }: { rows: AuditRow[] }) {
  return (
    <Card className="saas-card bg-[var(--card)] border-[var(--border)] h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[var(--border)]">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <History className="size-4 text-[var(--primary)]" />
            Recent Activity
          </CardTitle>
          <p className="text-[10px] text-[var(--muted-foreground)] font-black uppercase tracking-widest mt-1">Real-time audit trail</p>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar min-h-[300px]">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center opacity-50 h-full">
            <History className="size-8 mb-2 text-[var(--muted-foreground)]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">No recent logs</p>
          </div>
        ) : (
          rows.map((log, i) => (
            <div key={log.id} className="flex gap-3 relative group">
              {i !== rows.length - 1 && (
                <div className="absolute left-[13px] top-7 bottom-[-16px] w-px bg-[var(--border)] group-hover:bg-[var(--primary)]/30 transition-colors" />
              )}
              
              <div className="size-7 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0 border border-[var(--border)] group-hover:border-[var(--primary)]/30 group-hover:bg-[var(--primary)]/5 transition-colors">
                <ShieldCheck className="size-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors" />
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--foreground)] truncate capitalize">{log.action.replace(/\./g, ' ')}</span>
                  <span className="text-[9px] text-[var(--muted-foreground)] font-medium tabular-nums whitespace-nowrap">
                    {format(new Date(log.created_at), 'MMM d, HH:mm')}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--muted-foreground)] leading-relaxed font-medium line-clamp-2">
                  {log.actor_id ? `Actor: ${log.actor_id.slice(0, 8)}` : 'System Process'} 
                  <span className="opacity-50 mx-1">•</span> 
                  Category: <span className="capitalize">{log.category || 'general'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <CardFooter className="p-4 border-t border-[var(--border)]">
        <Button asChild variant="ghost" className="w-full h-8 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]">
          <Link to={ROUTES.adminAudit}>View Full Audit Log</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
