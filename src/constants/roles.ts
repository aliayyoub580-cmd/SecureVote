import type { UserRole } from '@/types/database'

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  election_creator: 'Election Creator',
  voter: 'Voter',
}

export const ROLE_ORDER: UserRole[] = ['super_admin', 'election_creator', 'voter']
