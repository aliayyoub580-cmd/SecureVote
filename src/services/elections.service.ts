import { supabase } from '@/lib/supabase/client'
import { candidateImageService } from '@/services/candidate-image.service'
import { notificationsService } from '@/services/notifications.service'
import { votesService } from '@/services/votes.service'
import type { Database } from '@/types/database'

type Election = Database['public']['Tables']['elections']['Row']
type ElectionInsert = Database['public']['Tables']['elections']['Insert']
type ElectionUpdate = Database['public']['Tables']['elections']['Update']
type Candidate = Database['public']['Tables']['election_candidates']['Row']
type CandidateInsert = Database['public']['Tables']['election_candidates']['Insert']

export const electionsService = {
  async listCreatedBy(creatorId: string): Promise<Election[]> {
    const { data, error } = await supabase
      .from('elections')
      .select('*')
      .eq('created_by', creatorId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async listPublic(): Promise<Election[]> {
    // TEMPORARY: Extremely permissive query to debug why elections aren't showing for voters
    // This removes all filters to see if RLS is the culprit
    const { data, error } = await supabase
      .from('elections')
      .select('*')
    
    if (error) {
      console.error('DEBUG - listPublic Error:', error)
      throw error
    }
    console.log('DEBUG - listPublic Data:', data)
    return data ?? []
  },

  async listJoinedIds(): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase.from('ballot_tokens').select('election_id').eq('user_id', user.id)
    if (error) throw error
    return data.map(r => r.election_id)
  },

  async listMine(): Promise<Election[]> {
    const { data, error } = await supabase.from('elections').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async duplicateElection(id: string, creatorId: string) {
    const original = await this.getById(id)
    if (!original) throw new Error('Election not found')
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, created_at, updated_at, status, approved_at, approved_by, rejection_reason, registrant_count, waitlist_count, votes_version, ...rest } = original
    
    const { data, error } = await supabase.from('elections').insert({
      ...rest,
      title: `${rest.title} (Copy)`,
      status: 'draft',
      created_by: creatorId,
    }).select('*').single()
    
    if (error) throw error
    return data
  },

  async getCreatorStats(creatorId: string) {
    const { data: elections, error } = await supabase
      .from('elections')
      .select('status, registrant_count')
      .eq('created_by', creatorId)
    
    if (error) throw error
    
    const total = elections.length
    const active = elections.filter(e => e.status === 'active').length
    const totalRegistrants = elections.reduce((sum, e) => sum + (e.registrant_count || 0), 0)
    
    return {
      total,
      active,
      totalRegistrants
    }
  },

  async getById(id: string): Promise<Election | null> {
    const { data, error } = await supabase.from('elections').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },

  async listRegistrants(electionId: string) {
    const { data, error } = await supabase.rpc('list_election_registrants', { p_election_id: electionId })
    if (error) throw error
    return data ?? []
  },

  /** Super Admin: list voters with full profile info (name, email, block status) */
  async adminListVoters(electionId: string): Promise<{
    ballot_token_id: string
    user_id: string
    registered_at: string
    has_voted: boolean
    is_blocked: boolean
    full_name: string | null
    email: string | null
    voter_public_id: string | null
  }[]> {
    const { data, error } = await (supabase as any).rpc('admin_list_election_voters', { p_election_id: electionId })
    if (error) throw error
    return (data as any[]) ?? []
  },

  async adminBlockVoter(electionId: string, ballotTokenId: string) {
    const { error } = await (supabase as any).rpc('admin_block_voter', {
      p_election_id: electionId,
      p_ballot_token_id: ballotTokenId,
    })
    if (error) throw error
  },

  async adminUnblockVoter(electionId: string, ballotTokenId: string) {
    const { error } = await (supabase as any).rpc('admin_unblock_voter', {
      p_election_id: electionId,
      p_ballot_token_id: ballotTokenId,
    })
    if (error) throw error
  },

  async adminRemoveVoter(electionId: string, ballotTokenId: string) {
    const { error } = await (supabase as any).rpc('admin_remove_voter', {
      p_election_id: electionId,
      p_ballot_token_id: ballotTokenId,
    })
    if (error) throw error
  },


  async create(payload: Omit<ElectionInsert, 'created_by'> & { created_by: string }) {
    const { data, error } = await supabase.from('elections').insert(payload).select('*').single()
    if (error) throw error
    return data
  },

  async deleteForCreator(id: string) {
    const { error } = await supabase.from('elections').delete().eq('id', id)
    if (error) throw error
  },

  async creatorStartVotingNow(id: string) {
    const { data: election, error: fetchErr } = await supabase.from('elections').select('*').eq('id', id).single()
    if (fetchErr) throw fetchErr

    const { data, error } = await supabase.rpc('creator_start_voting_now', { p_election_id: id })
    if (error) throw error

    try {
      await notificationsService.notifyElectionStarted(id, election.created_by, `/elections/${id}`)
    } catch (err) {
      console.error('Failed to send start notification:', err)
    }
    return data
  },

  async creatorCloseVotingNow(id: string) {
    const { data: election, error: fetchErr } = await supabase.from('elections').select('*').eq('id', id).single()
    if (fetchErr) throw fetchErr

    const { data, error } = await supabase.rpc('creator_close_voting_now', { p_election_id: id })
    if (error) throw error

    try {
      await notificationsService.notifyElectionCompleted(id, election.created_by, `/elections/${id}/creator-view`)
    } catch (err) {
      console.error('Failed to send end/winner notifications:', err)
    }
    return data
  },

  async update(id: string, patch: ElectionUpdate) {
    const { data, error } = await supabase.from('elections').update(patch).eq('id', id).select('*').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Election not found or you do not have permission to update it.')
    return data
  },

  async submitForApproval(id: string) {
    return this.update(id, { status: 'pending_approval' })
  },

  async approve(id: string, approverId: string) {
    const election = await this.update(id, {
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })

    try {
      await notificationsService.notifyElectionPublished(election.created_by, `/elections/${id}/creator-view`)
    } catch (err) {
      console.error('Failed to send published notification:', err)
    }
    return election
  },

  async reject(id: string, approverId: string, reason: string) {
    return this.update(id, {
      status: 'rejected',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
  },

  async listPendingApproval(): Promise<Election[]> {
    const { data, error } = await supabase
      .from('elections')
      .select('*')
      .eq('status', 'pending_approval')
      .eq('suspended', false)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  /** Super Admin: every election row visible under RLS */
  async listAllAdmin(): Promise<Election[]> {
    const { data, error } = await supabase.from('elections').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async setSuspended(id: string, suspended: boolean) {
    return this.update(id, { suspended })
  },

  async deleteElection(id: string) {
    const { error } = await supabase.from('elections').delete().eq('id', id)
    if (error) throw error
  },

  async listCandidates(electionId: string): Promise<Candidate[]> {
    const { data, error } = await supabase
      .from('election_candidates')
      .select('*')
      .eq('election_id', electionId)
      .order('poll_id', { ascending: true })
      .order('display_order', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async getCandidate(electionId: string, candidateId: string): Promise<Candidate | null> {
    const { data, error } = await supabase
      .from('election_candidates')
      .select('*')
      .eq('election_id', electionId)
      .eq('id', candidateId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async upsertCandidates(electionId: string, rows: Omit<CandidateInsert, 'election_id'>[]) {
    const { error } = await supabase.from('election_candidates').delete().eq('election_id', electionId)
    if (error) throw error
    if (rows.length === 0) return
    const { error: ins } = await supabase
      .from('election_candidates')
      .insert(rows.map((r, i) => ({ ...r, election_id: electionId, display_order: r.display_order ?? i })))
    if (ins) throw ins
  },

  async addCandidate(row: CandidateInsert) {
    const { data, error } = await supabase.from('election_candidates').insert(row).select('*').single()
    if (error) throw error
    return data
  },

  async updateCandidate(id: string, patch: Database['public']['Tables']['election_candidates']['Update']) {
    const { data, error } = await supabase.from('election_candidates').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    return data
  },

  async deleteCandidate(id: string) {
    const { error } = await supabase.from('election_candidates').delete().eq('id', id)
    if (error) throw error
  },

  /** Set display_order 0..n-1 for candidates in a poll (same election). */
  async reorderCandidatesInPoll(electionId: string, pollId: string, orderedCandidateIds: string[]) {
    for (let i = 0; i < orderedCandidateIds.length; i++) {
      const cid = orderedCandidateIds[i]
      const { error } = await supabase
        .from('election_candidates')
        .update({ display_order: i })
        .eq('id', cid)
        .eq('election_id', electionId)
        .eq('poll_id', pollId)
      if (error) throw error
    }
  },

  async uploadCandidateImage(file: File, electionId: string, candidateId: string) {
    return candidateImageService.upload(electionId, candidateId, file)
  },
}
