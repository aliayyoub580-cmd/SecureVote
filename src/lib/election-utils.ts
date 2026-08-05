import type { ElectionStatus } from '@/types/database'

export type DisplayPhase = ElectionStatus | 'scheduled' | 'voting' | 'ended'

type ElectionLike = {
  status: ElectionStatus
  starts_at: string
  ends_at: string
  registration_opens_at?: string | null
  registration_closes_at?: string | null
}

export function isRegistrationOpen(e: ElectionLike, now = new Date()): boolean {
  if (e.status !== 'approved' && e.status !== 'active') return false
  
  const t = now.getTime()
  const end = new Date(e.ends_at).getTime()
  if (t > end) return false

  if (e.registration_closes_at) {
    if (t > new Date(e.registration_closes_at).getTime()) return false
  }
  
  if (e.registration_opens_at) {
    if (t < new Date(e.registration_opens_at).getTime()) return false
  }

  return true
}

export function isRegistrationUpcoming(e: ElectionLike, now = new Date()): boolean {
  if (e.status !== 'approved' && e.status !== 'active') return false
  const t = now.getTime()
  
  if (e.registration_opens_at) {
    return t < new Date(e.registration_opens_at).getTime()
  }
  return false
}

export function getDisplayPhase(e: ElectionLike, now = new Date()): DisplayPhase {
  const t = now.getTime()
  const start = new Date(e.starts_at).getTime()
  const end = new Date(e.ends_at).getTime()

  if (e.status === 'draft' || e.status === 'pending_approval' || e.status === 'rejected') {
    return e.status
  }

  if (e.status === 'closed') return 'closed'

  if (e.status === 'approved' || e.status === 'active') {
    if (t < start) return 'scheduled'
    if (t >= start && t < end) return 'voting'
    return 'ended'
  }

  return e.status
}

export function maskVotingCode(code: string | null | undefined): string {
  if (!code) return '••••••••'
  const clean = code.trim()
  if (clean.length < 8) return '••••••••'
  return `${clean.slice(0, 2)}••••••${clean.slice(-4)}`
}

export function phaseLabel(phase: DisplayPhase): string {
  const map: Record<DisplayPhase, string> = {
    draft: 'Draft',
    pending_approval: 'Pending review',
    approved: 'Approved',
    rejected: 'Rejected',
    active: 'Active',
    closed: 'Closed',
    scheduled: 'Scheduled',
    voting: 'Live voting',
    ended: 'Ended',
  }
  return map[phase]
}
