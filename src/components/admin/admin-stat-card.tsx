import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AdminStatCardProps {
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  color?: string
  index: number
}

export function AdminStatCard({ label, value, hint, icon: Icon, color = 'text-[var(--primary)]', index }: AdminStatCardProps) {
  // Infer background and border classes from the text color for a unified look
  const bgClass = color.includes('primary') ? 'bg-[var(--primary)]/10 border-[var(--primary)]/20' : 
                  color.includes('emerald') ? 'bg-emerald-500/10 border-emerald-500/20' :
                  color.includes('amber') ? 'bg-amber-500/10 border-amber-500/20' :
                  color.includes('blue') ? 'bg-blue-500/10 border-blue-500/20' :
                  color.includes('purple') ? 'bg-purple-500/10 border-purple-500/20' :
                  color.includes('rose') ? 'bg-rose-500/10 border-rose-500/20' :
                  'bg-[var(--muted)] border-[var(--border)]'

  return (
    <Card className="saas-card bg-[var(--card)] border-[var(--border)] overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center justify-between">
          <div className={cn('size-12 rounded-xl flex items-center justify-center border shrink-0', bgClass)}>
            <Icon className={cn('size-5', color)} />
          </div>
          {index === 2 && value > 0 && (
            <div className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-500 uppercase tracking-widest">
              Action Needed
            </div>
          )}
          {index === 5 && value > 0 && (
            <div className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[9px] font-black text-rose-500 uppercase tracking-widest">
              Alerts Active
            </div>
          )}
        </div>

        <div>
          <h3 className="text-3xl font-black tracking-tight text-[var(--foreground)]">{value}</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)] mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
