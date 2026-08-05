import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Row = Database['public']['Tables']['notifications']['Row']

export const notificationsService = {
  async createNotification(userId: string, title: string, body: string, linkPath?: string) {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      body,
      type: 'info',
      link_path: linkPath
    })
    if (error) throw error
  },

  async notifyAdmins(title: string, body: string, linkPath?: string) {
    const { error } = await supabase.rpc('notify_role', {
      p_role: 'super_admin',
      p_title: title,
      p_body: body,
      p_link_path: linkPath || null
    })
    if (error) throw error
  },

  async notifyAllVoters(title: string, body: string, linkPath?: string) {
    const { error } = await supabase.rpc('notify_role', {
      p_role: 'voter',
      p_title: title,
      p_body: body,
      p_link_path: linkPath || null
    })
    if (error) throw error
  },

  // --- SUPER ADMIN NOTIFICATIONS ---
  async notifyAdminCreatorApplied(linkPath?: string) {
    await this.notifyAdmins('New Election Creator Application Received', 'A new user has applied to become an election creator.', linkPath)
  },
  
  async notifyAdminSuspiciousLogin(linkPath?: string) {
    await this.notifyAdmins('Suspicious Login Activity Detected', 'Unusual login behavior has been detected in the system.', linkPath)
  },

  // --- CREATOR & ADMIN SHARED NOTIFICATIONS ---
  async notifyCreatorApplicationApproved(creatorId: string, linkPath?: string) {
    await this.createNotification(creatorId, 'Application Approved', 'Your application to become an election creator has been approved.', linkPath)
    await this.notifyAdmins('Creator Application Approved', 'An election creator application was approved.', linkPath)
  },

  async notifyCreatorApplicationRejected(creatorId: string, linkPath?: string) {
    await this.createNotification(creatorId, 'Application Rejected', 'Your application to become an election creator has been rejected.', linkPath)
    await this.notifyAdmins('Creator Application Rejected', 'An election creator application was rejected.', linkPath)
  },

  async notifyElectionPublished(creatorId: string, linkPath?: string) {
    await this.createNotification(creatorId, 'Election Published Successfully', 'Your election has been approved and published successfully.', linkPath)
  },

  async notifyRegistrationClosed(creatorId: string, linkPath?: string) {
    await this.createNotification(creatorId, 'Registration Closed', 'Registration for your election is now closed.', linkPath)
  },

  async notifyMaxVotersReached(creatorId: string, linkPath?: string) {
    await this.createNotification(creatorId, 'Maximum Voter Limit Reached', 'Your election has reached the maximum number of registered voters.', linkPath)
  },

  async notifyElectionStarted(electionId: string, creatorId: string, linkPath?: string) {
    await this.notifyAdmins('Election Started', 'An election has officially started.', linkPath)
    await this.createNotification(creatorId, 'Election Started', 'Your election has officially started.', linkPath)
    await this.notifyAllVoters('Voting Is Now Open', 'An election is now open for voting.', linkPath)
  },

  async notifyElectionCompleted(electionId: string, creatorId: string, linkPath?: string) {
    await this.notifyAdmins('Election Completed', 'An election has officially completed.', linkPath)
    await this.createNotification(creatorId, 'Election Completed', 'Your election has officially completed.', linkPath)
    await this.createNotification(creatorId, 'Results Available', 'The results for your completed election are now available.', linkPath)
    await this.notifyAllVoters('Election Results Published', 'The results for an election have been published.', linkPath)
  },

  // --- VOTER NOTIFICATIONS ---
  async notifyVoterRegistered(voterId: string, linkPath?: string) {
    await this.createNotification(voterId, 'Registration Successful', 'You have successfully registered for the election.', linkPath)
  },

  async notifyVotingCodeAssigned(voterId: string, linkPath?: string) {
    await this.createNotification(voterId, 'Voting Code Assigned', 'Your secure voting code has been assigned.', linkPath)
  },

  async notifyVoteSubmitted(voterId: string, linkPath?: string) {
    await this.createNotification(voterId, 'Vote Submitted Successfully', 'Your vote has been submitted successfully.', linkPath)
  },

  async listUnread(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async listRecent(userId: string, limit = 30): Promise<Row[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async markRead(id: string) {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },

  async markAllRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
    if (error) throw error
  },

  async deleteAll(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    if (error) throw error
  },

  subscribe(userId: string, onInsert: (row: Row) => void) {
    const channelId = `notifications:${userId}:${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => onInsert(payload.new as Row),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
