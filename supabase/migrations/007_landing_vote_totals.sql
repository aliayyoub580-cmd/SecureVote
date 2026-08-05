-- Aggregate vote counts per election for public marketing / landing (no row-level vote exposure).

create or replace function public.get_landing_vote_totals()
returns table (election_id uuid, vote_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select v.election_id, count(*)::bigint
  from public.votes v
  inner join public.elections e on e.id = v.election_id
  where coalesce(e.suspended, false) = false
    and e.status in ('approved', 'active', 'closed')
  group by v.election_id;
$$;

revoke all on function public.get_landing_vote_totals() from public;
grant execute on function public.get_landing_vote_totals() to anon, authenticated;
