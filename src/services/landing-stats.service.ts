import { supabase } from '@/lib/supabase/client'
import { electionsService } from '@/services/elections.service'
import { votesService, type ResultRow } from '@/services/votes.service'
import type { Database } from '@/types/database'

export type PublicElection = Database['public']['Tables']['elections']['Row']

export async function fetchPublicElections(): Promise<PublicElection[]> {
  return electionsService.listPublic()
}

/** Per-election total ballot rows (one row per poll choice on multi-poll ballots). */
export async function fetchLandingVoteTotals(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_landing_vote_totals')
  if (error) {
    console.warn('get_landing_vote_totals:', error.message)
    return {}
  }
  const map: Record<string, number> = {}
  for (const row of data ?? []) {
    const r = row as { election_id: string; vote_count: number | string }
    map[r.election_id] = Number(r.vote_count)
  }
  return map
}

export async function fetchResultsPreview(electionId: string): Promise<ResultRow[]> {
  return votesService.getResults(electionId)
}

export async function fetchTotalUsersCount(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
  if (error) {
    console.warn('fetchTotalUsersCount:', error.message)
    return 0
  }
  return count ?? 0
}
