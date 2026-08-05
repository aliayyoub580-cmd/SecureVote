import { supabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/types/database'
import { notificationsService } from '@/services/notifications.service'

export type AdminOverviewStats = {
  profiles: number
  elections: number
  elections_active: number
  approvals_pending: number
  votes_total: number
  creators_pending: number
  ballots_issued: number
}

export type VoteTrendPoint = { day: string; votes: number }

function parseOverview(raw: Json): AdminOverviewStats {
  const o = raw as Record<string, number>
  return {
    profiles: o.profiles ?? 0,
    elections: o.elections ?? 0,
    elections_active: o.elections_active ?? 0,
    approvals_pending: o.approvals_pending ?? 0,
    votes_total: o.votes_total ?? 0,
    creators_pending: o.creators_pending ?? 0,
    ballots_issued: o.ballots_issued ?? 0,
  }
}

export type CreatorProfile = Database['public']['Tables']['profiles']['Row']

export const adminService = {
  async overviewStats(): Promise<AdminOverviewStats> {
    const { data, error } = await supabase.rpc('admin_overview_stats')
    if (error) throw error
    return parseOverview(data as Json)
  },

  async voteTrend(): Promise<VoteTrendPoint[]> {
    const { data, error } = await supabase.rpc('admin_vote_trend')
    if (error) throw error
    const arr = (data ?? []) as { day: string; votes: number }[]
    return Array.isArray(arr) ? arr : []
  },

  async listCreators(): Promise<CreatorProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['election_creator', 'super_admin'])
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async listCreatorApplications(): Promise<CreatorProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('creator_application_status', 'none')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async approveCreator(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        creator_application_status: 'approved',
        role: 'election_creator'
      })
      .eq('id', userId)
    if (error) throw error
    await notificationsService.notifyCreatorApplicationApproved(userId, '/elections/creator')
  },

  async rejectCreator(userId: string, reason: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        creator_application_status: 'rejected',
        creator_application_rejection_reason: reason
      })
      .eq('id', userId)
    if (error) throw error
    await notificationsService.notifyCreatorApplicationRejected(userId, '/settings')
  },

  async notifyUser(userId: string, title: string, body: string, linkPath?: string | null) {
    const { error } = await supabase.rpc('admin_notify_user', {
      p_user_id: userId,
      p_title: title,
      p_body: body,
      p_link_path: linkPath ?? null,
    })
    if (error) throw error
  },

  async resetBallotLock(electionId: string, userId: string) {
    const { data, error } = await supabase.rpc('admin_reset_ballot_lock', {
      p_election_id: electionId,
      p_user_id: userId,
    })
    if (error) throw error
    return data
  },
}
