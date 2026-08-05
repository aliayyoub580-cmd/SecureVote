-- Add voter comments feature to polls

-- 1. Add allow_comments to election_polls
alter table public.election_polls
  add column if not exists allow_comments boolean not null default false;

-- 2. Add comment to votes
alter table public.votes
  add column if not exists comment text;

-- 3. Patch submit_ballot to support comments
create or replace function public.submit_ballot(
  p_election_id uuid,
  p_secret_token text,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text := encode(extensions.digest(trim(p_secret_token)::bytea, 'sha256'), 'hex');
  v_token_id uuid;
  v_election public.elections%rowtype;
  v_now timestamptz := now();
  v_poll_count int;
  v_sel_count int;
  rec jsonb;
  v_poll uuid;
  v_cand uuid;
  v_comment text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_selections is null or jsonb_typeof(p_selections) <> 'array' or jsonb_array_length(p_selections) = 0 then
    raise exception 'invalid_selections';
  end if;

  select * into v_election from public.elections where id = p_election_id;
  if not found then
    raise exception 'election_not_found';
  end if;

  if coalesce(v_election.suspended, false) then
    raise exception 'election_suspended';
  end if;

  if v_now < v_election.starts_at or v_now >= v_election.ends_at then
    raise exception 'voting_not_in_window';
  end if;

  if public.effective_election_status(v_election) <> 'active' then
    raise exception 'election_not_active';
  end if;

  select count(*)::int into v_poll_count from public.election_polls p where p.election_id = p_election_id;

  select count(*)::int into v_sel_count
  from jsonb_array_elements(p_selections) s;

  if v_sel_count <> v_poll_count then
    raise exception 'selection_count_mismatch';
  end if;

  select count(distinct (s->>'poll_id'))::int into v_sel_count
  from jsonb_array_elements(p_selections) s;

  if v_sel_count <> v_poll_count then
    raise exception 'selection_polls_not_unique';
  end if;

  select b.id into v_token_id
  from public.ballot_tokens b
  where b.election_id = p_election_id
    and b.token_hash = v_hash
    and b.used_at is null
    and coalesce(b.is_blocked, false) = false  -- BLOCKED voters cannot vote
  for update;

  if v_token_id is null then
    -- Check if token exists but is blocked
    if exists (
      select 1 from public.ballot_tokens b
      where b.election_id = p_election_id
        and b.token_hash = v_hash
        and coalesce(b.is_blocked, false) = true
    ) then
      raise exception 'voter_blocked_by_admin';
    end if;
    raise exception 'invalid_or_used_ballot';
  end if;

  for rec in select * from jsonb_array_elements(p_selections)
  loop
    v_poll := (rec->>'poll_id')::uuid;
    v_cand := (rec->>'candidate_id')::uuid;

    if not exists (
      select 1 from public.election_polls p
      where p.id = v_poll and p.election_id = p_election_id
    ) then
      raise exception 'invalid_poll';
    end if;

    if not exists (
      select 1 from public.election_candidates c
      where c.id = v_cand and c.election_id = p_election_id and c.poll_id = v_poll
    ) then
      raise exception 'invalid_candidate';
    end if;
  end loop;

  for rec in select * from jsonb_array_elements(p_selections)
  loop
    v_poll := (rec->>'poll_id')::uuid;
    v_cand := (rec->>'candidate_id')::uuid;
    v_comment := rec->>'comment';
    
    insert into public.votes (election_id, candidate_id, ballot_token_id, poll_id, comment)
    values (p_election_id, v_cand, v_token_id, v_poll, nullif(trim(v_comment), ''));
  end loop;

  update public.ballot_tokens set used_at = v_now where id = v_token_id;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    v_uid,
    'vote.ballot_submitted',
    'election',
    p_election_id,
    jsonb_build_object('election_id', p_election_id, 'polls', v_poll_count)
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- 4. Update get_election_vote_ledger to return comments
drop function if exists public.get_election_vote_ledger(uuid);

create or replace function public.get_election_vote_ledger(p_election_id uuid)
returns table (
  voter_code text,
  candidate_name text,
  poll_title text,
  voted_at timestamptz,
  comment text
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
    v.cast_at as voted_at,
    v.comment as comment
  from public.votes v
  left join public.voter_public_ids vp on vp.ballot_token_id = v.ballot_token_id
  join public.election_candidates c on c.id = v.candidate_id
  join public.election_polls p on p.id = v.poll_id
  where v.election_id = p_election_id
  order by v.cast_at desc;
end;
$$;

grant execute on function public.get_election_vote_ledger(uuid) to anon, authenticated;
