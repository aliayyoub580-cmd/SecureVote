-- Secret voter display IDs (human-readable; ballot token remains the voting secret).

create table if not exists public.voter_public_ids (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  ballot_token_id uuid not null references public.ballot_tokens (id) on delete cascade,
  public_id text not null,
  sequence_num int not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (public_id)
);

create unique index if not exists voter_public_ids_one_active_per_user_election
  on public.voter_public_ids (election_id, user_id)
  where revoked_at is null;

create index if not exists idx_voter_public_ids_ballot on public.voter_public_ids (ballot_token_id);
create index if not exists idx_voter_public_ids_election on public.voter_public_ids (election_id);

-- Monotonic per-election counter for ...-NNNN tail (with election prefix in string for global uniqueness)
create table if not exists public.election_voter_id_seq (
  election_id uuid primary key references public.elections (id) on delete cascade,
  n int not null default 0
);

alter table public.election_voter_id_seq enable row level security;
drop policy if exists "election_voter_id_seq_deny" on public.election_voter_id_seq;
create policy "election_voter_id_seq_deny"
  on public.election_voter_id_seq for all
  using (false);

-- ---------------------------------------------------------------------------
-- Issue ID: POLL-{segment}-{electionKey}{seq} e.g. POLL-K-A3F20001
-- electionKey = first 4 hex chars of election UUID (no dashes); seq 4-digit per election
-- ---------------------------------------------------------------------------
create or replace function public.issue_voter_public_id_for_ballot(p_ballot_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election uuid;
  v_uid uuid;
  v_key text;
  v_seg text;
  v_n int;
  v_public text;
  v_attempt int := 0;
begin
  select b.election_id, b.user_id
  into strict v_election, v_uid
  from public.ballot_tokens b
  where b.id = p_ballot_id;

  v_key := upper(substring(replace(v_election::text, '-', ''), 1, 4));

  insert into public.election_voter_id_seq as s (election_id, n)
  values (v_election, 1)
  on conflict (election_id) do update
    set n = s.n + 1
  returning n into v_n;

  loop
    v_seg := chr(65 + floor(random() * 26)::int);
    v_public := 'POLL-' || v_seg || '-' || v_key || lpad(v_n::text, 4, '0');
    exit when not exists (select 1 from public.voter_public_ids v where v.public_id = v_public);
    v_attempt := v_attempt + 1;
    if v_attempt > 40 then
      raise exception 'voter_public_id_generation_failed';
    end if;
  end loop;

  insert into public.voter_public_ids (election_id, user_id, ballot_token_id, public_id, sequence_num)
  values (v_election, v_uid, p_ballot_id, v_public, v_n);

  return v_public;
end;
$$;

revoke all on function public.issue_voter_public_id_for_ballot(uuid) from public;

create or replace function public.trg_ballot_issue_voter_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.issue_voter_public_id_for_ballot(new.id);
  return new;
end;
$$;

drop trigger if exists trg_ballot_tokens_voter_public_id on public.ballot_tokens;
create trigger trg_ballot_tokens_voter_public_id
  after insert on public.ballot_tokens
  for each row execute function public.trg_ballot_issue_voter_public_id();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.voter_public_ids enable row level security;

drop policy if exists "voter_public_ids_select" on public.voter_public_ids;
create policy "voter_public_ids_select"
  on public.voter_public_ids for select
  using (
    user_id = auth.uid()
    or public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.elections e
      where e.id = election_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "voter_public_ids_no_mutate" on public.voter_public_ids;
create policy "voter_public_ids_no_mutate"
  on public.voter_public_ids for all
  using (false);

-- ---------------------------------------------------------------------------
-- register_for_election: return voter_public_id after ballot insert (trigger runs first)
-- ---------------------------------------------------------------------------
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
  v_ballot_id uuid;
  v_vid text;
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
  values (p_election_id, v_uid, v_hash)
  returning id into v_ballot_id;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.registered', 'election', p_election_id, jsonb_build_object('election_id', p_election_id));

  select v.public_id
  into v_vid
  from public.voter_public_ids v
  where v.ballot_token_id = v_ballot_id and v.revoked_at is null
  limit 1;

  return jsonb_build_object('secret_token', v_secret, 'voter_public_id', coalesce(v_vid, ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Regenerate (revoke prior active row, issue new for same ballot)
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_my_voter_public_id(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ballot uuid;
  v_new text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select b.id
  into v_ballot
  from public.ballot_tokens b
  where b.election_id = p_election_id and b.user_id = v_uid
  limit 1;

  if v_ballot is null then
    raise exception 'no_ballot';
  end if;

  update public.voter_public_ids
  set revoked_at = now()
  where ballot_token_id = v_ballot and revoked_at is null;

  v_new := public.issue_voter_public_id_for_ballot(v_ballot);

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.public_id_regenerated', 'election', p_election_id, jsonb_build_object('election_id', p_election_id));

  return jsonb_build_object('voter_public_id', v_new);
end;
$$;

revoke all on function public.regenerate_my_voter_public_id(uuid) from public;
grant execute on function public.regenerate_my_voter_public_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Read active ID for current user
-- ---------------------------------------------------------------------------
create or replace function public.get_my_voter_public_id(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select v.public_id
  into v_pid
  from public.voter_public_ids v
  inner join public.ballot_tokens b on b.id = v.ballot_token_id
  where b.election_id = p_election_id and b.user_id = v_uid and v.revoked_at is null
  order by v.created_at desc
  limit 1;

  if v_pid is null then
    return jsonb_build_object('public_id', null, 'has_active', false);
  end if;

  return jsonb_build_object('public_id', v_pid, 'has_active', true);
end;
$$;

revoke all on function public.get_my_voter_public_id(uuid) from public;
grant execute on function public.get_my_voter_public_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Validate (e.g. check-in); revoked / wrong election => invalid
-- ---------------------------------------------------------------------------
create or replace function public.validate_voter_public_id(p_election_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := upper(trim(both from p_code));
  v_row public.voter_public_ids%rowtype;
begin
  if v_norm is null or length(v_norm) < 6 then
    return jsonb_build_object('valid', false, 'reason', 'format');
  end if;

  select * into v_row from public.voter_public_ids v where v.public_id = v_norm limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'unknown');
  end if;

  if v_row.election_id <> p_election_id then
    return jsonb_build_object('valid', false, 'reason', 'wrong_election');
  end if;

  if v_row.revoked_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'revoked');
  end if;

  return jsonb_build_object('valid', true, 'reason', null);
end;
$$;

revoke all on function public.validate_voter_public_id(uuid, text) from public;
grant execute on function public.validate_voter_public_id(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill existing ballots
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select b.id
    from public.ballot_tokens b
    where not exists (
      select 1 from public.voter_public_ids v where v.ballot_token_id = b.id
    )
  loop
    perform public.issue_voter_public_id_for_ballot(r.id);
  end loop;
end;
$$;

revoke all on function public.register_for_election(uuid, boolean) from public;
grant execute on function public.register_for_election(uuid, boolean) to authenticated;
