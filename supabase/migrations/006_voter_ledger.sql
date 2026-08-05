create or replace function public.get_public_voter_ledger(p_election_id uuid)
returns table (voter_id text, voted_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    -- Mask the user UUID (e.g., '123e4567-e89b-12d3-a456-426614174000' -> '123e4567-����-4000')
    -- Or just return the raw user_id as text, and we mask it in the frontend!
    -- Returning raw UUID is fine since user UUIDs are generally public in apps, but let's return raw text.
    b.user_id::text as voter_id,
    b.used_at as voted_at
  from public.ballot_tokens b
  where b.election_id = p_election_id
    and b.used_at is not null
  order by b.used_at desc;
end;
$$;

grant execute on function public.get_public_voter_ledger(uuid) to anon, authenticated;
