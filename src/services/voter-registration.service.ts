import { supabase } from '@/lib/supabase/client'

export type VoterRegisterResult =
  | { status: 'confirmed'; secretToken: string; voterPublicId?: string }
  | { status: 'waitlisted'; queuePosition: number }

export type RegistrationStatus = {
  hasBallot: boolean
  waitlistPosition: number | null
}

export type WaitlistRow = {
  user_id: string
  created_at: string
  queue_position: number
}

function parseRegisterPayload(data: unknown): VoterRegisterResult {
  // Supabase RPC may return an array or a single object depending on the function definition
  const row = (Array.isArray(data) ? data[0] : data ?? {}) as Record<string, unknown>
  
  if (row.status === 'waitlisted') {
    return { status: 'waitlisted', queuePosition: Number(row.queue_position ?? 0) }
  }
  
  const code = row.secret_token != null ? String(row.secret_token) : (row.voting_code != null ? String(row.voting_code) : '')
  // If it's not waitlisted and no code is returned, it's an error
  if (!code && row.status !== 'waitlisted') {
    throw new Error('Registration did not return a voting code')
  }
  
  const voterPublicId = row.voter_public_id != null ? String(row.voter_public_id) : undefined
  return { 
    status: 'confirmed', 
    secretToken: code, 
    voterPublicId: voterPublicId || undefined 
  }
}

import { notificationsService } from '@/services/notifications.service'

export const voterRegistrationService = {
  async registerForElection(electionId: string, acceptTerms: boolean): Promise<VoterRegisterResult> {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.rpc('register_for_election', {
      p_election_id: electionId,
      p_accept_terms: acceptTerms,
    })
    if (error) throw error
    
    const result = parseRegisterPayload(data)
    
    if (result.status === 'confirmed' && user) {
       try {
         await notificationsService.notifyVoterRegistered(user.id, `/elections/${electionId}`)
         if (result.voterPublicId) {
           // Provide receipt path if they want to view their code
           await notificationsService.notifyVotingCodeAssigned(user.id, `/elections/${electionId}`)
         }
         
         const { data: el } = await supabase.from('elections').select('created_by, max_voters, registrant_count').eq('id', electionId).maybeSingle()
         if (el && el.max_voters && el.registrant_count === el.max_voters) {
           await notificationsService.notifyMaxVotersReached(el.created_by, `/elections/${electionId}/creator-view`)
         }
       } catch (err) {
         console.error('Failed to send registration notifications:', err)
       }
    }
    
    return result
  },

  async getStatus(electionId: string): Promise<RegistrationStatus> {
    const { data, error } = await supabase.rpc('get_registration_status_for_user', {
      p_election_id: electionId,
    })
    if (error) throw error
    const row = (data ?? {}) as Record<string, unknown>
    return {
      hasBallot: Boolean(row.has_ballot),
      waitlistPosition: row.waitlist_position == null ? null : Number(row.waitlist_position),
    }
  },

  async listWaitlist(electionId: string): Promise<WaitlistRow[]> {
    const { data, error } = await supabase.rpc('list_election_waitlist', { p_election_id: electionId })
    if (error) throw error
    if (!Array.isArray(data)) return []
    return data.map((r) => {
      const x = r as Record<string, unknown>
      return {
        user_id: String(x.user_id ?? ''),
        created_at: String(x.created_at ?? ''),
        queue_position: Number(x.queue_position ?? 0),
      }
    })
  },

  async fetchRegistrationCounts(electionId: string): Promise<{ registrantCount: number; waitlistCount: number }> {
    const { data, error } = await supabase
      .from('elections')
      .select('registrant_count, waitlist_count')
      .eq('id', electionId)
      .maybeSingle()
    if (error) throw error
    if (!data) return { registrantCount: 0, waitlistCount: 0 }
    return {
      registrantCount: Number((data as { registrant_count?: number }).registrant_count ?? 0),
      waitlistCount: Number((data as { waitlist_count?: number }).waitlist_count ?? 0),
    }
  },
}
