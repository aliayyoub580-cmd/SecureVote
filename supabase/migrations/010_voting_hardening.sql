-- Core anonymous voting: row locks, live stats bump for Realtime, optional autoclose, anonymous audit for ballot submit.

-- ---------------------------------------------------------------------------
-- Bump elections row so clients can subscribe for live turnout-style updates
-- ---------------------------------------------------------------------------
alter table public.elections add column if not exists votes_version int not null default 0;

-- One bump per completed ballot is done inside submit_ballot (multi-poll = many vote rows).
-- This trigger covers rare vote-row deletes (e.g. service role maintenance).
create or replace function public.bump_election_votes_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eid uuid;
begin
  eid := old.election_id;
  update public.elections
  set votes_version = coalesce(votes_version, 0) + 1,
      updated_at = now()
  where id = eid;
  return old;
end;
$$;

drop trigger if exists trg_votes_bump_delete on public.votes;
create trigger trg_votes_bump_delete
  after delete on public.votes
  for each row execute function public.bump_election_votes_version();

-- ---------------------------------------------------------------------------
-- submit_ballot: lock election row, anonymous audit (no actor link to ballot)
-- ---------------------------------------------------------------------------
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

  select * into v_election from public.elections where id = p_election_id for update;
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
    and b.user_id = v_uid
    and b.used_at is null
  for update;

  if v_token_id is null then
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

  update public.elections
  set votes_version = coalesce(votes_version, 0) + 1,
      updated_at = now()
  where id = p_election_id;

  -- Anonymous: do not store auth user on audit row for ballot submission (tally remains unlinkable).
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    null,
    'vote.ballot_submitted',
    'election',
    p_election_id,
    jsonb_build_object('election_id', p_election_id::text, 'polls', v_poll_count)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_ballot(uuid, text, jsonb) from public;
grant execute on function public.submit_ballot(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Public aggregate stats for live turnout (no per-vote rows exposed)
-- ---------------------------------------------------------------------------
create or replace function public.get_election_live_stats(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_votes int;
  v_reg int;
  v_used int;
begin
  select exists (
    select 1 from public.elections e
    where e.id = p_election_id
      and coalesce(e.suspended, false) = false
      and e.status in ('approved', 'active', 'closed')
  ) into v_ok;

  if not v_ok then
    return jsonb_build_object('votes_cast', 0, 'registered', 0, 'ballots_completed', 0);
  end if;

  select count(*)::int into v_votes from public.votes where election_id = p_election_id;
  select count(*)::int into v_reg from public.ballot_tokens where election_id = p_election_id;
  select count(*)::int into v_used from public.ballot_tokens where election_id = p_election_id and used_at is not null;

  return jsonb_build_object(
    'votes_cast', v_votes,
    'registered', v_reg,
    'ballots_completed', v_used
  );
end;
$$;

revoke all on function public.get_election_live_stats(uuid) from public;
grant execute on function public.get_election_live_stats(uuid) to authenticated;
grant execute on function public.get_election_live_stats(uuid) to anon;

-- ---------------------------------------------------------------------------
-- Lazy auto-close: flip DB status when window ended (call from app or pg_cron)
-- ---------------------------------------------------------------------------
create or replace function public.autoclose_expired_elections()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.elections
  set status = 'closed'::public.election_status,
      updated_at = now()
  where ends_at <= now()
    and starts_at <= now()
    and status in ('approved', 'active');

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.autoclose_expired_elections() from public;
grant execute on function public.autoclose_expired_elections() to authenticated;
grant execute on function public.autoclose_expired_elections() to service_role;
