import type { PostgrestError } from '@supabase/supabase-js'

function pickMessage(err: PostgrestError | Error): string {
  if ('message' in err && typeof err.message === 'string') return err.message
  return String(err)
}

/** Map Postgres exceptions from `submit_ballot` / `cast_vote` to user-facing copy. */
export function mapSubmitBallotError(err: PostgrestError | Error): string {
  const raw = pickMessage(err).toLowerCase()
  const d = 'details' in err && typeof err.details === 'string' ? err.details.toLowerCase() : ''

  const hay = `${raw} ${d}`

  if (hay.includes('invalid_or_used_ballot')) {
    return 'That ballot token is invalid or has already been used. Each voter may submit only once.'
  }
  if (hay.includes('not_authenticated')) return 'You must be signed in to vote.'
  if (hay.includes('election_not_found')) return 'This election could not be found.'
  if (hay.includes('election_suspended')) return 'Voting is paused for this election.'
  if (hay.includes('voting_not_in_window')) return 'Voting is not open at this time.'
  if (hay.includes('election_not_active')) return 'This election is not accepting votes right now.'
  if (hay.includes('invalid_selections') || hay.includes('selection_count_mismatch')) {
    return 'Please choose exactly one option in every section of the ballot.'
  }
  if (hay.includes('selection_polls_not_unique')) return 'Each ballot section must be chosen only once.'
  if (hay.includes('invalid_poll') || hay.includes('invalid_candidate')) {
    return 'One or more choices are not valid for this election. Refresh the page and try again.'
  }

  return pickMessage(err)
}
