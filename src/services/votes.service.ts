import type { Json } from '@/types/database'
import { supabase } from '@/lib/supabase/client'
import { mapSubmitBallotError } from '@/lib/vote-submit-errors'
import { auditService } from '@/services/audit.service'
import { voterRegistrationService, type VoterRegisterResult } from '@/services/voter-registration.service'
import { notificationsService } from '@/services/notifications.service'

export type ResultRow = {
  candidate_id: string
  name: string
  votes: number
  poll_id?: string
  poll_title?: string
}

export type ElectionLiveStats = {
  votes_cast: number
  registered: number
  ballots_completed: number
}

export const votesService = {
  /** @param acceptedTerms Must be true — enforced by RPC. */
  async register(electionId: string, acceptedTerms: boolean): Promise<VoterRegisterResult> {
    return voterRegistrationService.registerForElection(electionId, acceptedTerms)
  },

  async cast(electionId: string, candidateId: string, secretToken: string) {
    const { data, error } = await supabase.rpc('cast_vote', {
      p_election_id: electionId,
      p_candidate_id: candidateId,
      p_secret_token: secretToken,
    })
    if (error) throw error
    return data
  },

  async submitBallot(
    electionId: string,
    secretToken: string,
    selections: { poll_id: string; candidate_id: string; comment?: string }[],
  ) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.rpc('submit_ballot', {
      p_election_id: electionId,
      p_secret_token: secretToken,
      p_selections: selections as unknown as Json,
    })
    if (error) {
      void auditService.log(
        'vote.submit_failed',
        'election',
        electionId,
        { message: error.message, code: error.code },
        { enrichClient: true },
      )
      throw new Error(mapSubmitBallotError(error))
    }
    
    if (user) {
      try {
         await notificationsService.notifyVoteSubmitted(user.id, `/elections/${electionId}`)
      } catch (err) {
         console.error('Failed to send vote notification:', err)
      }
    }
    
    return data
  },

  async getLiveStats(electionId: string): Promise<ElectionLiveStats> {
    const { data, error } = await supabase.rpc('get_election_live_stats', { p_election_id: electionId })
    if (error) throw error
    const row = (data ?? {}) as Record<string, unknown>
    return {
      votes_cast: Number(row.votes_cast ?? 0),
      registered: Number(row.registered ?? 0),
      ballots_completed: Number(row.ballots_completed ?? 0),
    }
  },

  /** Best-effort: closes elections whose window has ended (requires migration RPC). */
  async tryAutocloseExpiredElections(): Promise<void> {
    const { error } = await supabase.rpc('autoclose_expired_elections')
    if (error) {
      console.warn('[votesService] autoclose_expired_elections:', error.message)
    }
  },

  async getResults(electionId: string): Promise<ResultRow[]> {
    const { data, error } = await supabase.rpc('get_election_results', { p_election_id: electionId })
    if (error) throw error
    if (data == null) return []
    let parsed: unknown = data
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data)
      } catch {
        return []
      }
    }
    if (!Array.isArray(parsed)) return []
    return parsed.map((row) => {
      const r = row as Record<string, unknown>
      return {
        candidate_id: String(r.candidate_id ?? ''),
        name: String(r.name ?? ''),
        votes: Number(r.votes ?? 0),
        poll_id: r.poll_id != null ? String(r.poll_id) : undefined,
        poll_title: r.poll_title != null ? String(r.poll_title) : undefined,
      }
    })
  },

  async hasBallot(electionId: string, userId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('ballot_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('election_id', electionId)
      .eq('user_id', userId)
    if (error) throw error
    return (count ?? 0) > 0
  },

  async ballotUsed(electionId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('ballot_tokens')
      .select('used_at')
      .eq('election_id', electionId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return Boolean(data?.used_at)
  },

  async listRegistrants(electionId: string) {
    const { data, error } = await supabase.rpc('list_election_registrants', { p_election_id: electionId })
    if (error) throw error
    return data ?? []
  },

  async getVoteLedger(electionId: string): Promise<{ voter_code: string; candidate_name: string; poll_title: string; voted_at: string; comment?: string | null }[]> {
    const { data, error } = await supabase.rpc('get_election_vote_ledger', { p_election_id: electionId })
    if (error) throw error
    return (data ?? []) as any
  },

  async verifyVoterCodeForAudit(electionId: string, code: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('verify_voter_code_for_audit', {
      p_election_id: electionId,
      p_code: code,
    })
    if (error) throw error
    return Boolean(data)
  },
}
