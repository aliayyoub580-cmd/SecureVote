-- Safe voting ledger function for public audits and PDF reports.
-- Retrieves the verified link between a voter's public sequence ID and their chosen candidates without exposing raw user credentials.
create or replace function public.get_election_vote_ledger(p_election_id uuid)
returns table (
  voter_code text,
  candidate_name text,
  poll_title text,
  voted_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select 
    coalesce(vp.public_id, 'POLL-UNKNOWN') as voter_code,
    c.name as candidate_name,
    p.title as poll_title,
    v.cast_at as voted_at
  from public.votes v
  left join public.voter_public_ids vp on vp.ballot_token_id = v.ballot_token_id
  join public.election_candidates c on c.id = v.candidate_id
  join public.election_polls p on p.id = v.poll_id
  where v.election_id = p_election_id
  order by v.cast_at desc;
end;
$$;

grant execute on function public.get_election_vote_ledger(uuid) to anon, authenticated;
