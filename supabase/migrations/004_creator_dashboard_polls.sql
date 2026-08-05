-- Creator dashboard: election metadata, max voters, multi-poll (ballot sections), submit_ballot, owner delete

-- ---------------------------------------------------------------------------
-- Election columns
-- ---------------------------------------------------------------------------
alter table public.elections add column if not exists category text;
alter table public.elections add column if not exists organization text;
alter table public.elections add column if not exists max_voters int;
alter table public.elections add column if not exists description_html text;

alter table public.elections drop constraint if exists elections_max_voters_check;
alter table public.elections add constraint elections_max_voters_check check (max_voters is null or max_voters > 0);

-- ---------------------------------------------------------------------------
-- Polls (multi-section ballot)
-- ---------------------------------------------------------------------------
create table if not exists public.election_polls (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  title text not null,
  description text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_election_polls_election on public.election_polls (election_id, display_order);

alter table public.election_candidates add column if not exists poll_id uuid;

-- Backfill: one default poll per election, attach candidates
insert into public.election_polls (election_id, title, description, display_order)
select e.id, 'General ballot', null, 0
from public.elections e
where not exists (select 1 from public.election_polls p where p.election_id = e.id);

update public.election_candidates c
set poll_id = (
  select p.id from public.election_polls p
  where p.election_id = c.election_id
  order by p.display_order asc, p.created_at asc
  limit 1
)
where c.poll_id is null;

do $$ begin
  alter table public.election_candidates
    add constraint election_candidates_poll_fk foreign key (poll_id) references public.election_polls (id) on delete restrict;
exception when duplicate_object then null;
end $$;

alter table public.election_candidates
  alter column poll_id set not null;

-- ---------------------------------------------------------------------------
-- Votes: one row per (ballot token, poll)
-- ---------------------------------------------------------------------------
alter table public.votes add column if not exists poll_id uuid;

update public.votes v
set poll_id = c.poll_id
from public.election_candidates c
where v.candidate_id = c.id and v.poll_id is null;

do $$ begin
  alter table public.votes
    add constraint votes_poll_fk foreign key (poll_id) references public.election_polls (id) on delete restrict;
exception when duplicate_object then null;
end $$;

alter table public.votes alter column poll_id set not null;

alter table public.votes drop constraint if exists votes_ballot_token_id_key;

do $$ begin
  alter table public.votes add constraint votes_ballot_poll_unique unique (ballot_token_id, poll_id);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: election_polls
-- ---------------------------------------------------------------------------
alter table public.election_polls enable row level security;

drop policy if exists "election_polls_select" on public.election_polls;
create policy "election_polls_select"
  on public.election_polls for select
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (
          public.is_super_admin(auth.uid())
          or e.created_by = auth.uid()
          or (
            coalesce(e.suspended, false) = false
            and e.status in ('approved', 'active', 'closed')
          )
        )
    )
  );

drop policy if exists "election_polls_insert_owner" on public.election_polls;
create policy "election_polls_insert_owner"
  on public.election_polls for insert
  with check (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and e.created_by = auth.uid()
        and e.status in ('draft', 'pending_approval', 'rejected')
    )
  );

drop policy if exists "election_polls_update_owner" on public.election_polls;
create policy "election_polls_update_owner"
  on public.election_polls for update
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and e.created_by = auth.uid()
        and e.status in ('draft', 'pending_approval', 'rejected')
    )
  )
  with check (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and e.created_by = auth.uid()
    )
  );

drop policy if exists "election_polls_delete_owner" on public.election_polls;
create policy "election_polls_delete_owner"
  on public.election_polls for delete
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and e.created_by = auth.uid()
        and e.status in ('draft', 'pending_approval', 'rejected')
    )
  );

-- ---------------------------------------------------------------------------
-- Creator may delete own draft/rejected elections
-- ---------------------------------------------------------------------------
drop policy if exists "elections_delete_owner_draft" on public.elections;
create policy "elections_delete_owner_draft"
  on public.elections for delete
  using (
    created_by = auth.uid()
    and status in ('draft', 'rejected')
  );

-- ---------------------------------------------------------------------------
-- Registration with max_voters
-- ---------------------------------------------------------------------------
create or replace function public.register_for_election(p_election_id uuid)
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
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

  if v_election.max_voters is not null then
    select count(*)::int into v_cnt from public.ballot_tokens b where b.election_id = p_election_id;
    if v_cnt >= v_election.max_voters then
      raise exception 'registration_full';
    end if;
  end if;

  if exists (
    select 1 from public.ballot_tokens b
    where b.election_id = p_election_id and b.user_id = v_uid
  ) then
    raise exception 'already_registered';
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

-- ---------------------------------------------------------------------------
-- submit_ballot: atomic multi-poll vote
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
  v_hash text := encode(digest(trim(p_secret_token), 'sha256'), 'hex');
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

grant execute on function public.submit_ballot(uuid, text, jsonb) to authenticated;

-- Legacy single-candidate cast wraps submit_ballot
create or replace function public.cast_vote(
  p_election_id uuid,
  p_candidate_id uuid,
  p_secret_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll uuid;
begin
  select c.poll_id into v_poll
  from public.election_candidates c
  where c.id = p_candidate_id and c.election_id = p_election_id;

  if v_poll is null then
    raise exception 'invalid_candidate';
  end if;

  return public.submit_ballot(
    p_election_id,
    p_secret_token,
    jsonb_build_array(
      jsonb_build_object('poll_id', v_poll, 'candidate_id', p_candidate_id)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Results include poll metadata
-- ---------------------------------------------------------------------------
create or replace function public.get_election_results(p_election_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_suspended boolean;
begin
  select coalesce(suspended, false) into v_suspended from public.elections where id = p_election_id;
  if not found then
    return '[]'::jsonb;
  end if;
  if coalesce(v_suspended, false) then
    return '[]'::jsonb;
  end if;

  select exists (
    select 1 from public.elections e
    where e.id = p_election_id
      and e.status in ('approved', 'active', 'closed')
  ) into v_ok;

  if not v_ok then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(t.row_json)
      from (
        select jsonb_build_object(
          'candidate_id', c.id,
          'name', c.name,
          'poll_id', c.poll_id,
          'poll_title', p.title,
          'votes', (
            select count(*)::int
            from public.votes v
            where v.election_id = p_election_id
              and v.candidate_id = c.id
          )
        ) as row_json
        from public.election_candidates c
        join public.election_polls p on p.id = c.poll_id
        where c.election_id = p_election_id
        order by p.display_order, c.display_order, c.name
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Creator schedule helpers
-- ---------------------------------------------------------------------------
create or replace function public.creator_start_voting_now(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.elections e
  set starts_at = now()
  where e.id = p_election_id
    and e.created_by = auth.uid()
    and e.status = 'approved'
    and now() < e.starts_at;

  if not found then
    raise exception 'not_applicable';
  end if;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (auth.uid(), 'election.creator_start_now', 'election', p_election_id, jsonb_build_object());

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.creator_start_voting_now(uuid) to authenticated;

create or replace function public.creator_close_voting_now(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.elections e
  set ends_at = now()
  where e.id = p_election_id
    and e.created_by = auth.uid()
    and e.status in ('approved', 'active')
    and now() < e.ends_at;

  if not found then
    raise exception 'not_applicable';
  end if;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (auth.uid(), 'election.creator_close_now', 'election', p_election_id, jsonb_build_object());

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.creator_close_voting_now(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Default poll for every new election (after migration backfill)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_election_default_poll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.election_polls (election_id, title, description, display_order)
  values (new.id, 'General ballot', null, 0);
  return new;
end;
$$;

drop trigger if exists trg_elections_default_poll on public.elections;
create trigger trg_elections_default_poll
  after insert on public.elections
  for each row
  execute function public.handle_new_election_default_poll();

