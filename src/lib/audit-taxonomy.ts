/** Maps action strings to dashboard filter categories (stored on audit_logs.category). */
export function inferAuditCategory(action: string): string {
  const a = action.toLowerCase()
  if (a.startsWith('auth.')) return 'auth'
  if (a.startsWith('vote.')) return 'vote'
  if (a.startsWith('voter.')) return 'voter'
  if (a.startsWith('admin.')) return 'admin'
  if (a.startsWith('profile.')) return 'admin'
  if (a.startsWith('creator_application.')) return 'admin'
  if (a.startsWith('election.')) return 'election'
  return 'general'
}

export const AUDIT_CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'auth', label: 'Authentication' },
  { value: 'election', label: 'Elections' },
  { value: 'voter', label: 'Voter & registration' },
  { value: 'vote', label: 'Voting' },
  { value: 'admin', label: 'Admin & policy' },
  { value: 'general', label: 'General' },
] as const

export const AUDIT_ACTION_PREFIX_OPTIONS = [
  { value: '', label: 'Any action' },
  { value: 'auth.', label: 'auth.*' },
  { value: 'election.', label: 'election.*' },
  { value: 'voter.', label: 'voter.*' },
  { value: 'vote.', label: 'vote.*' },
  { value: 'admin.', label: 'admin.*' },
  { value: 'profile.', label: 'profile.*' },
  { value: 'creator_application.', label: 'creator_application.*' },
] as const
