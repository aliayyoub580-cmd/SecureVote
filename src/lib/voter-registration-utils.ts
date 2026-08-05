import type { ElectionStatus } from '@/types/database'

type ElectionLike = {
  status: ElectionStatus
  suspended: boolean | null
  starts_at: string
  ends_at: string
  registration_opens_at: string | null
  registration_closes_at: string | null
  max_voters: number | null
}

export function getRegistrationWindowBounds(election: ElectionLike) {
  const startMs = new Date(election.starts_at).getTime()
  const opens = election.registration_opens_at
    ? new Date(election.registration_opens_at)
    : new Date(startMs - 30 * 24 * 60 * 60 * 1000)
  const closes = election.registration_closes_at ? new Date(election.registration_closes_at) : new Date(election.ends_at)
  return { opens, closes }
}

export function isRegistrationWindowOpen(election: ElectionLike, now = new Date()) {
  const { opens, closes } = getRegistrationWindowBounds(election)
  const t = now.getTime()
  return t >= opens.getTime() && t <= closes.getTime()
}

export function isRegistrationCapReached(election: ElectionLike, registrantCount: number) {
  if (election.max_voters == null) return false
  return registrantCount >= election.max_voters
}

export type RegistrationEligibility =
  | { ok: true }
  | { ok: false; code: string; message: string }

/** Client-side checks mirroring RPC (UX hints; server remains source of truth). */
export function evaluateRegistrationEligibility(
  election: ElectionLike,
  opts: {
    hasBallot: boolean
    waitlistPosition: number | null
    phaseEndedOrClosed: boolean
  },
): RegistrationEligibility {
  if (opts.hasBallot) {
    return { ok: false, code: 'already_registered', message: 'You already hold a ballot token for this election.' }
  }
  if (opts.waitlistPosition != null) {
    return { ok: false, code: 'already_on_waitlist', message: 'You are already on the waitlist.' }
  }
  if (election.suspended) {
    return { ok: false, code: 'election_suspended', message: 'This election is suspended.' }
  }
  if (election.status !== 'approved' && election.status !== 'active') {
    return { ok: false, code: 'election_not_open', message: 'Registration is not open for this election status.' }
  }
  if (opts.phaseEndedOrClosed) {
    return { ok: false, code: 'phase', message: 'The voting period has ended or this election is closed.' }
  }
  if (!isRegistrationWindowOpen(election)) {
    return { ok: false, code: 'registration_window_closed', message: 'Registration is outside the allowed window.' }
  }
  return { ok: true }
}

export function mapRegistrationRpcError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('terms_not_accepted')) return 'You must accept the terms to register.'
  if (m.includes('not_authenticated')) return 'Sign in to register.'
  if (m.includes('election_not_found')) return 'Election not found.'
  if (m.includes('election_suspended')) return 'This election is suspended.'
  if (m.includes('election_not_open_for_registration')) return 'Registration is not open yet.'
  if (m.includes('registration_window_closed')) return 'Registration is closed for this election.'
  if (m.includes('already_registered')) return 'You are already registered with a ballot.'
  if (m.includes('already_on_waitlist')) return 'You are already on the waitlist.'
  return message || 'Registration could not be completed.'
}
