-- Voter Management for Super Admins
-- Adds ability to block/unblock/remove registrants on a per-election basis

-- 1. Add is_blocked column to ballot_tokens
alter table public.ballot_tokens
  add column if not exists is_blocked boolean not null default false;

-- 2. RPC: List registrants with full profile info (super admin only)
create or replace function public.admin_list_election_voters(p_election_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'ballot_token_id', bt.id,
          'user_id',         bt.user_id,
          'registered_at',   bt.created_at,
          'has_voted',       bt.used_at is not null,
          'is_blocked',      bt.is_blocked,
          'full_name',       p.full_name,
          'email',           p.email,
          'voter_public_id', vpi.public_id
        )
        order by bt.created_at asc
      )
      from public.ballot_tokens bt
      join public.profiles p on p.id = bt.user_id
      left join public.voter_public_ids vpi on vpi.ballot_token_id = bt.id
      where bt.election_id = p_election_id
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.admin_list_election_voters(uuid) to authenticated;

-- 3. RPC: Block a voter (prevent them from casting a ballot)
create or replace function public.admin_block_voter(p_election_id uuid, p_ballot_token_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  update public.ballot_tokens
  set is_blocked = true
  where id = p_ballot_token_id
    and election_id = p_election_id;

  if not found then
    raise exception 'voter_not_found';
  end if;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(), 'admin.voter_blocked', 'election', p_election_id,
    jsonb_build_object('election_id', p_election_id, 'ballot_token_id', p_ballot_token_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_block_voter(uuid, uuid) to authenticated;

-- 4. RPC: Unblock a voter
create or replace function public.admin_unblock_voter(p_election_id uuid, p_ballot_token_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  update public.ballot_tokens
  set is_blocked = false
  where id = p_ballot_token_id
    and election_id = p_election_id;

  if not found then
    raise exception 'voter_not_found';
  end if;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(), 'admin.voter_unblocked', 'election', p_election_id,
    jsonb_build_object('election_id', p_election_id, 'ballot_token_id', p_ballot_token_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_unblock_voter(uuid, uuid) to authenticated;

-- 5. RPC: Remove a voter (only if they haven't voted yet)
create or replace function public.admin_remove_voter(p_election_id uuid, p_ballot_token_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_voted boolean;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  select (used_at is not null) into v_has_voted
  from public.ballot_tokens
  where id = p_ballot_token_id and election_id = p_election_id;

  if not found then
    raise exception 'voter_not_found';
  end if;

  if v_has_voted then
    raise exception 'voter_already_voted_cannot_remove';
  end if;

  -- Remove public ID first (FK constraint)
  delete from public.voter_public_ids where ballot_token_id = p_ballot_token_id;
  delete from public.ballot_tokens where id = p_ballot_token_id;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(), 'admin.voter_removed', 'election', p_election_id,
    jsonb_build_object('election_id', p_election_id, 'ballot_token_id', p_ballot_token_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_remove_voter(uuid, uuid) to authenticated;

-- 6. Enforce blocked voters cannot cast ballot
-- Patch submit_ballot to check is_blocked
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
    insert into public.votes (election_id, candidate_id, ballot_token_id, poll_id)
    values (p_election_id, v_cand, v_token_id, v_poll);
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
