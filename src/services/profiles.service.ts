import { supabase } from '@/lib/supabase/client'
import type { Database, UserRole } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

export const profilesService = {
  async listSuperAdmins(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'super_admin')
    if (error) throw error
    return data ?? []
  },

  async listAll(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async listPendingCreatorApplications(): Promise<Profile[]> {
    return this.listCreatorApplications('pending')
  },

  async listCreatorApplications(status: 'pending' | 'approved' | 'rejected'): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('creator_application_status', status)
      .order('created_at', { ascending: status === 'pending' })
    if (error) throw error
    return data ?? []
  },

  async updateRole(userId: string, role: UserRole) {
    const patch: Database['public']['Tables']['profiles']['Update'] = { role }
    if (role === 'election_creator') {
      patch.creator_application_status = 'approved'
    } else if (role === 'voter') {
      patch.creator_application_status = 'none'
    } else if (role === 'super_admin') {
      patch.creator_application_status = 'none'
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) throw error
  },

  async approveCreatorApplication(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'election_creator',
        creator_application_status: 'approved',
        creator_application_rejection_reason: null,
      })
      .eq('id', userId)
      .eq('creator_application_status', 'pending')
    if (error) throw error
  },

  async rejectCreatorApplication(userId: string, reason: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'voter',
        creator_application_status: 'rejected',
        creator_application_rejection_reason: reason,
      })
      .eq('id', userId)
      .eq('creator_application_status', 'pending')
    if (error) throw error
  },

  async updateSelf(updates: {
    full_name?: string | null
    phone?: string | null
    organization?: string | null
  }) {
    const uid = (await supabase.auth.getUser()).data.user?.id
    if (!uid) throw new Error('Not signed in')
    const { error } = await supabase.from('profiles').update(updates).eq('id', uid)
    if (error) throw error
  },

  async applyForCreator() {
    const uid = (await supabase.auth.getUser()).data.user?.id
    if (!uid) throw new Error('Not signed in')
    const { error } = await supabase.from('profiles').update({
      creator_application_status: 'pending'
    }).eq('id', uid)
    if (error) throw error
    
    try {
      const { notificationsService } = await import('@/services/notifications.service')
      await notificationsService.notifyAdminCreatorApplied(`/admin/creators`)
    } catch(e) { console.error('Failed to send apply notification:', e) }
  },
}
