import { Crown, Vote, Pencil } from 'lucide-react'
import type { UserRole } from '@/types/database'

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  super_admin:      { label: 'Admin',   color: 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)] border-[var(--accent-danger)]/30',     Icon: Crown },
  election_creator: { label: 'Creator', color: 'bg-[var(--accent-info)]/20 text-[var(--accent-info)] border-[var(--accent-info)]/30', Icon: Pencil },
  voter:            { label: 'Voter',   color: 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/20',  Icon: Vote },
}

export function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
      <cfg.Icon className="size-2.5" />
      {cfg.label}
    </span>
  )
}
