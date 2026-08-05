-- Secure Online Election Management System — initial schema, RLS, and RPCs
-- Run in Supabase SQL Editor or via CLI after linking the project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('super_admin', 'election_creator', 'voter');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.election_status as enum (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'active',
    'closed'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'voter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'voter'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Elections & candidates
-- ---------------------------------------------------------------------------
create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status public.election_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint elections_time_order check (ends_at > starts_at)
);

create table if not exists public.election_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  name text not null,
  bio text,
  image_path text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ballots & anonymous votes (ballot_token_id is never exposed in public aggregates)
-- ---------------------------------------------------------------------------
create table if not exists public.ballot_tokens (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (election_id, user_id),
  unique (election_id, token_hash)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  candidate_id uuid not null references public.election_candidates (id) on delete restrict,
  ballot_token_id uuid not null references public.ballot_tokens (id) on delete restrict,
  cast_at timestamptz not null default now(),
  unique (ballot_token_id)
);

-- ---------------------------------------------------------------------------
-- Audit & notifications
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  link_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_elections_updated on public.elections;
create trigger trg_elections_updated
  before update on public.elections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_elections_created_by on public.elections (created_by);
create index if not exists idx_elections_status on public.elections (status);
create index if not exists idx_candidates_election on public.election_candidates (election_id);
create index if not exists idx_ballot_tokens_user on public.ballot_tokens (user_id);
create index if not exists idx_ballot_tokens_election on public.ballot_tokens (election_id);
create index if not exists idx_votes_election on public.votes (election_id);
create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);
create index if not exists idx_notifications_user on public.notifications (user_id, read_at);

-- ---------------------------------------------------------------------------
-- Helper SQL functions
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'super_admin'
  );
$$;

create or replace function public.is_election_creator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'election_creator'
  );
$$;

create or replace function public.effective_election_status(e public.elections)
returns text
language plpgsql
stable
as $$
declare
  now_ts timestamptz := now();
begin
  if e.status = 'closed' or e.status = 'rejected' or e.status = 'draft' or e.status = 'pending_approval' then
    return e.status::text;
  end if;
  if e.status in ('approved', 'active') then
    if now_ts < e.starts_at then
      return 'approved';
    elsif now_ts >= e.starts_at and now_ts < e.ends_at then
      return 'active';
    else
      return 'closed';
    end if;
  end if;
  return e.status::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: register for election — returns one-time secret ballot token
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_election from public.elections where id = p_election_id for update;
  if not found then
    raise exception 'election_not_found';
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

  v_secret := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash);

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.registered', 'election', p_election_id, jsonb_build_object('election_id', p_election_id));

  return jsonb_build_object('secret_token', v_secret);
end;
$$;

grant execute on function public.register_for_election(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cast vote using secret token (anonymous tally; no user_id on vote row)
-- ---------------------------------------------------------------------------
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
  v_uid uuid := auth.uid();
  v_hash text := encode(digest(trim(p_secret_token), 'sha256'), 'hex');
  v_token_id uuid;
  v_election public.elections%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_election from public.elections where id = p_election_id;
  if not found then
    raise exception 'election_not_found';
  end if;

  if v_now < v_election.starts_at or v_now >= v_election.ends_at then
    raise exception 'voting_not_in_window';
  end if;

  if public.effective_election_status(v_election) <> 'active' then
    raise exception 'election_not_active';
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

  if not exists (
    select 1 from public.election_candidates c
    where c.id = p_candidate_id and c.election_id = p_election_id
  ) then
    raise exception 'invalid_candidate';
  end if;

  insert into public.votes (election_id, candidate_id, ballot_token_id)
  values (p_election_id, p_candidate_id, v_token_id);

  update public.ballot_tokens set used_at = v_now where id = v_token_id;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    v_uid,
    'vote.cast',
    'election',
    p_election_id,
    jsonb_build_object('election_id', p_election_id, 'candidate_id', p_candidate_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cast_vote(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Results & registrants (no sensitive ballot material exposed)
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
begin
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
          'votes', (
            select count(*)::int
            from public.votes v
            where v.election_id = p_election_id
              and v.candidate_id = c.id
          )
        ) as row_json
        from public.election_candidates c
        where c.election_id = p_election_id
        order by c.display_order, c.name
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_election_results(uuid) to anon, authenticated;

create or replace function public.list_election_registrants(p_election_id uuid)
returns table (user_id uuid, registered_at timestamptz, has_voted boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.elections e
    where e.id = p_election_id and e.created_by = auth.uid()
  ) and not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  return query
  select
    b.user_id,
    b.created_at as registered_at,
    (b.used_at is not null) as has_voted
  from public.ballot_tokens b
  where b.election_id = p_election_id
  order by b.created_at desc;
end;
$$;

grant execute on function public.list_election_registrants(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notify creator on approval / rejection
-- ---------------------------------------------------------------------------
create or replace function public.notify_election_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'approved' then
      insert into public.notifications (user_id, title, body, type, link_path)
      values (
        new.created_by,
        'Election approved',
        format('"%s" is approved and will follow the published schedule.', new.title),
        'success',
        '/elections/' || new.id::text
      );
    elsif new.status = 'rejected' then
      insert into public.notifications (user_id, title, body, type, link_path)
      values (
        new.created_by,
        'Election rejected',
        coalesce(new.rejection_reason, 'Your election was rejected.'),
        'warning',
        '/elections/' || new.id::text
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_elections_notify on public.elections;
create trigger trg_elections_notify
  after update on public.elections
  for each row execute function public.notify_election_status_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.elections enable row level security;
alter table public.election_candidates enable row level security;
alter table public.ballot_tokens enable row level security;
alter table public.votes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Profiles
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
  on public.profiles for select
  using (id = auth.uid() or public.is_super_admin(auth.uid()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      role = (select p.role from public.profiles p where p.id = auth.uid())
      or public.is_super_admin(auth.uid())
    )
  );

drop policy if exists "profiles_super_admin_update" on public.profiles;
create policy "profiles_super_admin_update"
  on public.profiles for update
  using (public.is_super_admin(auth.uid()));

-- Elections
drop policy if exists "elections_select" on public.elections;
create policy "elections_select"
  on public.elections for select
  using (
    public.is_super_admin(auth.uid())
    or created_by = auth.uid()
    or status in ('approved', 'active', 'closed')
  );

drop policy if exists "elections_insert_creator" on public.elections;
create policy "elections_insert_creator"
  on public.elections for insert
  with check (
    created_by = auth.uid()
    and (
      public.is_election_creator(auth.uid())
      or public.is_super_admin(auth.uid())
    )
  );

drop policy if exists "elections_update_owner" on public.elections;
create policy "elections_update_owner"
  on public.elections for update
  using (
    public.is_super_admin(auth.uid())
    or (
      created_by = auth.uid()
      and status in ('draft', 'pending_approval', 'rejected')
    )
  )
  with check (
    public.is_super_admin(auth.uid())
    or created_by = auth.uid()
  );

-- Candidates
drop policy if exists "candidates_select" on public.election_candidates;
create policy "candidates_select"
  on public.election_candidates for select
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (
          public.is_super_admin(auth.uid())
          or e.created_by = auth.uid()
          or e.status in ('approved', 'active', 'closed')
        )
    )
  );

drop policy if exists "candidates_insert_owner" on public.election_candidates;
create policy "candidates_insert_owner"
  on public.election_candidates for insert
  with check (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and e.created_by = auth.uid()
        and e.status in ('draft', 'pending_approval', 'rejected')
    )
  );

drop policy if exists "candidates_update_owner" on public.election_candidates;
create policy "candidates_update_owner"
  on public.election_candidates for update
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and e.created_by = auth.uid()
        and e.status in ('draft', 'pending_approval', 'rejected')
    )
  );

drop policy if exists "candidates_delete_owner" on public.election_candidates;
create policy "candidates_delete_owner"
  on public.election_candidates for delete
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and e.created_by = auth.uid()
        and e.status in ('draft', 'pending_approval', 'rejected')
    )
  );

-- Ballot tokens: never expose rows (including hashes) to election owners; use list_election_registrants instead
drop policy if exists "ballot_select_self" on public.ballot_tokens;
create policy "ballot_select_self"
  on public.ballot_tokens for select
  using (
    user_id = auth.uid()
    or public.is_super_admin(auth.uid())
  );

-- Inserts only through RPC (security definer). Block direct inserts from clients.
drop policy if exists "ballot_no_direct_insert" on public.ballot_tokens;
create policy "ballot_no_direct_insert"
  on public.ballot_tokens for insert
  with check (false);

-- Votes: managed by RPC only
drop policy if exists "votes_select_aggregators" on public.votes;
create policy "votes_select_aggregators"
  on public.votes for select
  using (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.elections e
      where e.id = election_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "votes_no_direct_mutations" on public.votes;
create policy "votes_no_direct_mutations"
  on public.votes for insert
  with check (false);

drop policy if exists "votes_no_update" on public.votes;
create policy "votes_no_update"
  on public.votes for update
  using (false);

drop policy if exists "votes_no_delete" on public.votes;
create policy "votes_no_delete"
  on public.votes for delete
  using (false);

-- Audit logs
drop policy if exists "audit_select_super" on public.audit_logs;
create policy "audit_select_super"
  on public.audit_logs for select
  using (public.is_super_admin(auth.uid()));

drop policy if exists "audit_insert_self" on public.audit_logs;
create policy "audit_insert_self"
  on public.audit_logs for insert
  with check (actor_id = auth.uid() or actor_id is null);

-- Notifications
drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self"
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self"
  on public.notifications for update
  using (user_id = auth.uid());

-- Service role / triggers insert notifications — already security definer on trigger

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.elections;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Storage bucket for candidate images (public read, authenticated write for owners)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('candidate-images', 'candidate-images', true)
on conflict (id) do nothing;

create policy "candidate_images_public_read"
  on storage.objects for select
  using (bucket_id = 'candidate-images');

create policy "candidate_images_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'candidate-images');

create policy "candidate_images_owner_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'candidate-images' and owner = auth.uid());

create policy "candidate_images_owner_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'candidate-images' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Post-deploy (run manually in Supabase SQL editor when needed)
-- ---------------------------------------------------------------------------
-- 1) Promote your first Super Admin (replace UUID with auth.users.id):
--    update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-000000000000';
-- 2) If `alter publication supabase_realtime add table` fails because the table is already
--    in the publication, comment out or skip those lines.
-- 3) In Authentication > Providers / Security: enable MFA, leaked-password protection, and
--    email confirmation for production workloads.
