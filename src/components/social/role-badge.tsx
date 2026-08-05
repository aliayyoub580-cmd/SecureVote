import { Crown, Vote, Pencil } from 'lucide-react'
import type { UserRole } from '@/types/database'

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  super_admin:      { label: 'Admin',   color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',     Icon: Crown },
  election_creator: { label: 'Creator', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', Icon: Pencil },
  voter:            { label: 'Voter',   color: 'bg-[#2EE6B8]/10 text-[#2EE6B8] border-[#2EE6B8]/20',  Icon: Vote },
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
