-- Voter registration: waitlist, denormalized counts for realtime UI, terms gate, duplicate prevention.

-- ---------------------------------------------------------------------------
-- Waitlist (no ballot token until promoted — promotion out of scope)
-- ---------------------------------------------------------------------------
create table if not exists public.election_waitlist (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (election_id, user_id)
);

create index if not exists idx_election_waitlist_election on public.election_waitlist (election_id);
create index if not exists idx_election_waitlist_user on public.election_waitlist (user_id);

alter table public.elections
  add column if not exists registrant_count int not null default 0;

alter table public.elections
  add column if not exists waitlist_count int not null default 0;

-- ---------------------------------------------------------------------------
-- Keep counts in sync (powers Supabase Realtime on `elections` row updates)
-- ---------------------------------------------------------------------------
create or replace function public.sync_election_registration_counts(p_election_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b int;
  w int;
begin
  select count(*)::int into b from public.ballot_tokens where election_id = p_election_id;
  select count(*)::int into w from public.election_waitlist where election_id = p_election_id;
  update public.elections
  set registrant_count = b,
      waitlist_count = w
  where id = p_election_id;
end;
$$;

create or replace function public.trg_sync_reg_counts_ballot()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_election_registration_counts(old.election_id);
  else
    perform public.sync_election_registration_counts(new.election_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ballot_tokens_sync_reg_counts on public.ballot_tokens;
create trigger trg_ballot_tokens_sync_reg_counts
  after insert or delete on public.ballot_tokens
  for each row execute function public.trg_sync_reg_counts_ballot();

create or replace function public.trg_sync_reg_counts_waitlist()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_election_registration_counts(old.election_id);
  else
    perform public.sync_election_registration_counts(new.election_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_waitlist_sync_reg_counts on public.election_waitlist;
create trigger trg_waitlist_sync_reg_counts
  after insert or delete on public.election_waitlist
  for each row execute function public.trg_sync_reg_counts_waitlist();

-- Backfill counts
do $$
declare
  r record;
begin
  for r in select id from public.elections loop
    perform public.sync_election_registration_counts(r.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: waitlist — read for self / owner / super admin; no direct writes
-- ---------------------------------------------------------------------------
alter table public.election_waitlist enable row level security;

drop policy if exists "election_waitlist_select" on public.election_waitlist;
create policy "election_waitlist_select"
  on public.election_waitlist for select
  using (
    user_id = auth.uid()
    or public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.elections e
      where e.id = election_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "election_waitlist_no_insert" on public.election_waitlist;
create policy "election_waitlist_no_insert"
  on public.election_waitlist for insert
  with check (false);

drop policy if exists "election_waitlist_no_update" on public.election_waitlist;
create policy "election_waitlist_no_update"
  on public.election_waitlist for update
  using (false);

drop policy if exists "election_waitlist_no_delete" on public.election_waitlist;
create policy "election_waitlist_no_delete"
  on public.election_waitlist for delete
  using (false);

-- ---------------------------------------------------------------------------
-- register_for_election: terms required, capacity -> waitlist, duplicates blocked
-- ---------------------------------------------------------------------------
drop function if exists public.register_for_election(uuid);

create or replace function public.register_for_election(p_election_id uuid, p_accept_terms boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_election public.elections%rowtype;
  v_secret text;
  v_hash text;
  v_reg_open timestamptz;
  v_reg_close timestamptz;
  v_cnt int;
  v_queue int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not coalesce(p_accept_terms, false) then
    raise exception 'terms_not_accepted';
  end if;

  select * into v_election from public.elections where id = p_election_id for update;
  if not found then
    raise exception 'election_not_found';
  end if;

  if coalesce(v_election.suspended, false) then
    raise exception 'election_suspended';
  end if;

  if v_election.status not in ('approved', 'active') then
    raise exception 'election_not_open_for_registration';
  end if;

  v_reg_open := coalesce(v_election.registration_opens_at, v_election.starts_at - interval '30 days');
  v_reg_close := coalesce(v_election.registration_closes_at, v_election.starts_at);

  if now() < v_reg_open or now() > v_reg_close then
    raise exception 'registration_window_closed';
  end if;

  if exists (
    select 1 from public.ballot_tokens b
    where b.election_id = p_election_id and b.user_id = v_uid
  ) then
    raise exception 'already_registered';
  end if;

  if v_election.max_voters is not null then
    select count(*)::int into v_cnt from public.ballot_tokens b where b.election_id = p_election_id;
    if v_cnt >= v_election.max_voters then
      if exists (
        select 1 from public.election_waitlist w
        where w.election_id = p_election_id and w.user_id = v_uid
      ) then
        raise exception 'already_on_waitlist';
      end if;

      insert into public.election_waitlist (election_id, user_id)
      values (p_election_id, v_uid);

      select count(*)::int into v_queue from public.election_waitlist where election_id = p_election_id;

      insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
      values (
        v_uid,
        'voter.waitlisted',
        'election',
        p_election_id,
        jsonb_build_object('election_id', p_election_id, 'queue_position', v_queue)
      );

      return jsonb_build_object('status', 'waitlisted', 'queue_position', v_queue);
    end if;
  end if;

  v_secret := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash);

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.registered', 'election', p_election_id, jsonb_build_object('election_id', p_election_id));

  return jsonb_build_object('secret_token', v_secret);
end;
$$;

revoke all on function public.register_for_election(uuid, boolean) from public;
grant execute on function public.register_for_election(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Creator: waitlist table view
-- ---------------------------------------------------------------------------
create or replace function public.list_election_waitlist(p_election_id uuid)
returns table (user_id uuid, created_at timestamptz, queue_position int)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.elections e
      where e.id = p_election_id and e.created_by = auth.uid()
    )
  ) then
    raise exception 'not_allowed';
  end if;

  return query
  select
    w.user_id,
    w.created_at,
    (row_number() over (order by w.created_at asc, w.id asc))::int as queue_position
  from public.election_waitlist w
  where w.election_id = p_election_id
  order by w.created_at asc, w.id asc;
end;
$$;

revoke all on function public.list_election_waitlist(uuid) from public;
grant execute on function public.list_election_waitlist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Current user: ballot / waitlist position (single round-trip for UI)
-- ---------------------------------------------------------------------------
create or replace function public.get_registration_status_for_user(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pos int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1 from public.ballot_tokens b
    where b.election_id = p_election_id and b.user_id = v_uid
  ) then
    return jsonb_build_object('has_ballot', true, 'waitlist_position', null::int);
  end if;

  if exists (
    select 1 from public.election_waitlist w
    where w.election_id = p_election_id and w.user_id = v_uid
  ) then
    select (count(*)::int)
    into v_pos
    from public.election_waitlist w
    where w.election_id = p_election_id
      and (w.created_at, w.id) <= (
        select w2.created_at, w2.id
        from public.election_waitlist w2
        where w2.election_id = p_election_id and w2.user_id = v_uid
        limit 1
      );
    return jsonb_build_object('has_ballot', false, 'waitlist_position', v_pos);
  end if;

  return jsonb_build_object('has_ballot', false, 'waitlist_position', null::int);
end;
$$;

revoke all on function public.get_registration_status_for_user(uuid) from public;
grant execute on function public.get_registration_status_for_user(uuid) to authenticated;
