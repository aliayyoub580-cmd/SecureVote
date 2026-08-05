import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Poll = Database['public']['Tables']['election_polls']['Row']
type PollInsert = Database['public']['Tables']['election_polls']['Insert']
type PollUpdate = Database['public']['Tables']['election_polls']['Update']

export const pollsService = {
  async list(electionId: string): Promise<Poll[]> {
    const { data, error } = await supabase
      .from('election_polls')
      .select('*')
      .eq('election_id', electionId)
      .order('display_order', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async create(row: PollInsert) {
    const { data, error } = await supabase.from('election_polls').insert(row).select('*').single()
    if (error) throw error
    return data
  },

  async update(id: string, patch: PollUpdate) {
    const { data, error } = await supabase.from('election_polls').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    return data
  },

  async delete(id: string) {
    const { error } = await supabase.from('election_polls').delete().eq('id', id)
    if (error) throw error
  },
}
