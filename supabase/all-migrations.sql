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
-- Auth profiles: email mirror, phone, organization, creator application workflow
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where applicable.

-- ---------------------------------------------------------------------------
-- Enum: creator application (voter requests election_creator; admin approves)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.creator_application_status as enum ('none', 'pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists organization text;

do $$ begin
  alter table public.profiles
    add column creator_application_status public.creator_application_status not null default 'none';
exception when duplicate_column then null;
end $$;

-- Backfill: existing election creators are treated as approved applicants
update public.profiles
set creator_application_status = 'approved'
where role = 'election_creator' and creator_application_status = 'none';

-- Mirror emails from auth where missing
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email is distinct from u.email);

-- ---------------------------------------------------------------------------
-- Enforce: only super_admin may change role or creator_application_status (via trigger)
-- ---------------------------------------------------------------------------
create or replace function public.profiles_lock_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if public.is_super_admin(auth.uid()) then
    return new;
  end if;

  if new.id is distinct from auth.uid() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.creator_application_status is distinct from old.creator_application_status then
    raise exception 'privileged_profile_update_denied';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_lock_privileged on public.profiles;
create trigger trg_profiles_lock_privileged
  before update on public.profiles
  for each row
  execute function public.profiles_lock_privileged_columns();

-- ---------------------------------------------------------------------------
-- New user → profiles (extended metadata + creator request)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text := coalesce(new.raw_user_meta_data->>'account_type', 'voter');
  v_role public.user_role := 'voter';
  v_creator_status public.creator_application_status := 'none'::public.creator_application_status;
begin
  if v_account_type = 'request_creator' then
    v_creator_status := 'pending'::public.creator_application_status;
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    organization,
    role,
    creator_application_status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'organization', '')), ''),
    v_role,
    v_creator_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Keep profiles.email in sync when auth.users.email changes
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_email_sync on auth.users;
create trigger trg_auth_user_email_sync
  after update of email on auth.users
  for each row
  execute function public.sync_profile_email_from_auth();
-- Super Admin operations: election suspend, delete, stats RPCs, ballot lock reset, in-app admin notifications

-- ---------------------------------------------------------------------------
-- Election suspension flag
-- ---------------------------------------------------------------------------
alter table public.elections add column if not exists suspended boolean not null default false;

-- ---------------------------------------------------------------------------
-- RLS: elections — public must not see suspended published rows; super admin sees all
-- ---------------------------------------------------------------------------
drop policy if exists "elections_select" on public.elections;
create policy "elections_select"
  on public.elections for select
  using (
    public.is_super_admin(auth.uid())
    or created_by = auth.uid()
    or (
      coalesce(suspended, false) = false
      and status in ('approved', 'active', 'closed')
    )
  );

drop policy if exists "elections_delete_super_admin" on public.elections;
create policy "elections_delete_super_admin"
  on public.elections for delete
  using (public.is_super_admin(auth.uid()));

-- (Super admin update already allowed by elections_update_owner in base migration.)

-- ---------------------------------------------------------------------------
-- Creator rejection reason (profile)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists creator_application_rejection_reason text;

-- ---------------------------------------------------------------------------
-- Candidates visible only when election is not suspended (for public browse)
-- ---------------------------------------------------------------------------
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
          or (
            coalesce(e.suspended, false) = false
            and e.status in ('approved', 'active', 'closed')
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Block voting / registration when suspended
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

  v_secret := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash);

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.registered', 'election', p_election_id, jsonb_build_object('election_id', p_election_id));

  return jsonb_build_object('secret_token', v_secret);
end;
$$;

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

  if coalesce(v_election.suspended, false) then
    raise exception 'election_suspended';
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

-- ---------------------------------------------------------------------------
-- Admin: notify user (in-app). Transactional email should use Edge Functions + provider.
-- ---------------------------------------------------------------------------
create or replace function public.admin_notify_user(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_link_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  insert into public.notifications (user_id, title, body, type, link_path)
  values (p_user_id, p_title, p_body, 'admin', p_link_path);
end;
$$;

grant execute on function public.admin_notify_user(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: reset ballot lock (removes vote row if present, clears used_at)
-- ---------------------------------------------------------------------------
create or replace function public.admin_reset_ballot_lock(p_election_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid uuid;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  select id into v_tid
  from public.ballot_tokens
  where election_id = p_election_id and user_id = p_user_id
  limit 1;

  if v_tid is null then
    raise exception 'ballot_not_found';
  end if;

  delete from public.votes where ballot_token_id = v_tid;
  update public.ballot_tokens set used_at = null where id = v_tid;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(),
    'admin.ballot_lock_reset',
    'election',
    p_election_id,
    jsonb_build_object('election_id', p_election_id, 'user_id', p_user_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_reset_ballot_lock(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin overview stats (single round-trip)
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview_stats()
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

  return jsonb_build_object(
    'profiles', (select count(*)::int from public.profiles),
    'elections', (select count(*)::int from public.elections),
    'elections_active', (
      select count(*)::int
      from public.elections e
      where coalesce(e.suspended, false) = false
        and e.status in ('approved', 'active')
        and now() >= e.starts_at
        and now() < e.ends_at
    ),
    'approvals_pending', (
      select count(*)::int from public.elections e
      where e.status = 'pending_approval' and coalesce(e.suspended, false) = false
    ),
    'votes_total', (select count(*)::int from public.votes),
    'creators_pending', (
      select count(*)::int from public.profiles p where p.creator_application_status = 'pending'
    ),
    'ballots_issued', (select count(*)::int from public.ballot_tokens)
  );
end;
$$;

grant execute on function public.admin_overview_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Vote trend (last 14 days, UTC day buckets)
-- ---------------------------------------------------------------------------
create or replace function public.admin_vote_trend()
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
      with days as (
        select date_trunc('day', cast_at) as d, count(*)::int as c
        from public.votes
        where cast_at >= now() - interval '14 days'
        group by 1
        order by 1 asc
      )
      select jsonb_agg(jsonb_build_object('day', d, 'votes', c))
      from days
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.admin_vote_trend() to authenticated;
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

-- Candidate profile: designation + manifesto (long-form); optional fields for ballot UX

alter table public.election_candidates add column if not exists designation text;
alter table public.election_candidates add column if not exists manifesto text;
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
-- Audit & transparency: context columns, append RPC, paginated admin query, realtime.

alter table public.audit_logs
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists device_label text,
  add column if not exists category text not null default 'general';

create index if not exists idx_audit_logs_category_created on public.audit_logs (category, created_at desc);
create index if not exists idx_audit_logs_action_created on public.audit_logs (action, created_at desc);
create index if not exists idx_audit_logs_actor_created on public.audit_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Client / app events (authenticated); runs as definer so RLS does not block.
-- ---------------------------------------------------------------------------
create or replace function public.record_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_metadata jsonb,
  p_ip text,
  p_user_agent text,
  p_device_label text,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
  v_cat text := coalesce(nullif(trim(p_category), ''), 'general');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'invalid_action';
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent,
    device_label,
    category
  )
  values (
    v_uid,
    trim(p_action),
    coalesce(nullif(trim(p_resource_type), ''), 'platform'),
    p_resource_id,
    coalesce(p_metadata, '{}'::jsonb),
    nullif(trim(p_ip), ''),
    nullif(trim(p_user_agent), ''),
    nullif(trim(p_device_label), ''),
    v_cat
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_audit_event(text, text, uuid, jsonb, text, text, text, text) from public;
grant execute on function public.record_audit_event(text, text, uuid, jsonb, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Super Admin: paginated + filterable audit trail (single round-trip).
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_audit_logs(
  p_limit int default 50,
  p_offset int default 0,
  p_category text default null,
  p_action_prefix text default null,
  p_actor_id uuid default null,
  p_resource_type text default null,
  p_search text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(nullif(p_limit, 0), 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
  v_search text := nullif(trim(p_search), '');
  v_cat text := nullif(trim(p_category), '');
  v_prefix text := nullif(trim(p_action_prefix), '');
  v_rt text := nullif(trim(p_resource_type), '');
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  select count(*) into v_total
  from public.audit_logs a
  where
    (v_cat is null or a.category = v_cat)
    and (v_prefix is null or a.action ilike v_prefix || '%')
    and (p_actor_id is null or a.actor_id = p_actor_id)
    and (v_rt is null or a.resource_type = v_rt)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to)
    and (
      v_search is null
      or a.action ilike '%' || v_search || '%'
      or a.resource_type ilike '%' || v_search || '%'
      or coalesce(a.ip_address, '') ilike '%' || v_search || '%'
      or coalesce(a.device_label, '') ilike '%' || v_search || '%'
      or coalesce(a.user_agent, '') ilike '%' || v_search || '%'
      or coalesce(a.metadata::text, '') ilike '%' || v_search || '%'
      or (a.resource_id is not null and a.resource_id::text ilike '%' || v_search || '%')
      or (a.actor_id is not null and a.actor_id::text ilike '%' || v_search || '%')
    );

  select coalesce(
    (
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select
          a.id,
          a.actor_id,
          a.action,
          a.resource_type,
          a.resource_id,
          a.metadata,
          a.created_at,
          a.ip_address,
          a.user_agent,
          a.device_label,
          a.category
        from public.audit_logs a
        where
          (v_cat is null or a.category = v_cat)
          and (v_prefix is null or a.action ilike v_prefix || '%')
          and (p_actor_id is null or a.actor_id = p_actor_id)
          and (v_rt is null or a.resource_type = v_rt)
          and (p_from is null or a.created_at >= p_from)
          and (p_to is null or a.created_at <= p_to)
          and (
            v_search is null
            or a.action ilike '%' || v_search || '%'
            or a.resource_type ilike '%' || v_search || '%'
            or coalesce(a.ip_address, '') ilike '%' || v_search || '%'
            or coalesce(a.device_label, '') ilike '%' || v_search || '%'
            or coalesce(a.user_agent, '') ilike '%' || v_search || '%'
            or coalesce(a.metadata::text, '') ilike '%' || v_search || '%'
            or (a.resource_id is not null and a.resource_id::text ilike '%' || v_search || '%')
            or (a.actor_id is not null and a.actor_id::text ilike '%' || v_search || '%')
          )
        order by a.created_at desc
        limit v_limit offset v_offset
      ) r
    ),
    '[]'::jsonb
  )
  into v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function public.admin_list_audit_logs(int, int, text, text, uuid, text, text, timestamptz, timestamptz) from public;
grant execute on function public.admin_list_audit_logs(int, int, text, text, uuid, text, text, timestamptz, timestamptz) to authenticated;

-- Backfill category for existing rows (idempotent heuristics)
update public.audit_logs set category = 'auth' where action ilike 'auth.%';
update public.audit_logs set category = 'vote' where action ilike 'vote.%';
update public.audit_logs set category = 'voter' where action ilike 'voter.%';
update public.audit_logs set category = 'admin' where action ilike 'admin.%' or action ilike 'profile.%' or action ilike 'creator_application.%';
update public.audit_logs set category = 'election' where action ilike 'election.%';

-- Realtime: if this errors because audit_logs is already in supabase_realtime, skip manually.
alter publication supabase_realtime add table public.audit_logs;
-- Add visibility column to elections table
ALTER TABLE elections ADD COLUMN IF NOT EXISTS visibility TEXT CHECK (visibility IN ('public', 'private')) DEFAULT 'public';

-- Add comment for documentation
COMMENT ON COLUMN elections.visibility IS 'Whether the election is publicly discoverable or requires a direct link/invitation.';

-- Ensure RLS allows selecting public elections (this might already be handled by status checks, but let's be explicit if needed)
-- Note: Existing policies usually filter by status. We might need to adjust them if "private" elections shouldn't show up in public lists even if approved.
-- Migration to support full ballot token regeneration for voters who lost their voting code.
-- This will revoke the old token and issue a completely new one.

create or replace function public.regenerate_ballot_token(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_election public.elections%rowtype;
  v_old_ballot_id uuid;
  v_secret text;
  v_hash text;
  v_new_ballot_id uuid;
  v_vid text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 1. Get election and check status
  select * into v_election from public.elections where id = p_election_id for update;
  if not found then
    raise exception 'election_not_found';
  end if;

  if v_election.status not in ('approved', 'active') then
    raise exception 'election_not_open';
  end if;

  -- 2. Find old ballot
  select id into v_old_ballot_id 
  from public.ballot_tokens 
  where election_id = p_election_id and user_id = v_uid;

  if v_old_ballot_id is null then
    raise exception 'no_existing_registration';
  end if;

  -- 3. Check if already voted (cannot regenerate if already voted)
  if exists (select 1 from public.votes where ballot_token_id = v_old_ballot_id) then
    raise exception 'already_voted_cannot_regenerate';
  end if;

  -- 4. Delete/Revoke old ballot and its public ID
  delete from public.voter_public_ids where ballot_token_id = v_old_ballot_id;
  delete from public.ballot_tokens where id = v_old_ballot_id;

  -- 5. Issue new secret token
  v_secret := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash)
  returning id into v_new_ballot_id;

  -- 6. New public ID will be handled by the trigger automatically (trg_ballot_tokens_voter_public_id)
  -- But we fetch it to return it to the UI
  select v.public_id
  into v_vid
  from public.voter_public_ids v
  where v.ballot_token_id = v_new_ballot_id
  limit 1;

  -- 7. Audit log
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.ballot_regenerated', 'election', p_election_id, jsonb_build_object('election_id', p_election_id));

  return jsonb_build_object(
    'secret_token', v_secret,
    'voter_public_id', coalesce(v_vid, '')
  );
end;
$$;

grant execute on function public.regenerate_ballot_token(uuid) to authenticated;
-- Allow election creators to update approved elections (schedule, participant limit).
-- Previously the policy blocked updates once status moved to 'approved',
-- causing PostgREST PGRST116 (cannot coerce result to single JSON object) errors.

drop policy if exists "elections_update_owner" on public.elections;
create policy "elections_update_owner"
  on public.elections for update
  using (
    public.is_super_admin(auth.uid())
    or (
      created_by = auth.uid()
      and status in ('draft', 'pending_approval', 'rejected', 'approved')
    )
  )
  with check (
    public.is_super_admin(auth.uid())
    or created_by = auth.uid()
  );
-- Update registration function to use user-friendly Voting Codes (SV-XXXXXX)
CREATE OR REPLACE FUNCTION public.register_for_election(p_election_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_election public.elections%rowtype;
  v_secret text;
  v_hash text;
  v_reg_open timestamptz;
  v_reg_close timestamptz;
  v_cnt int;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- User friendly characters (no 0, 1, I, O)
  v_i int;
BEGIN
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

  -- Generate SV-XXXXXX code
  v_secret := 'SV-';
  FOR v_i IN 1..6 LOOP
    v_secret := v_secret || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;
  
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash);

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.registered', 'election', p_election_id, jsonb_build_object('election_id', p_election_id, 'code_format', 'SV-6'));

  return jsonb_build_object('voting_code', v_secret);
END;
$$;
-- Auto-lock when max voters reached & freeze final voter list
CREATE OR REPLACE FUNCTION public.register_for_election(p_election_id uuid, p_accept_terms boolean default true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_election public.elections%rowtype;
  v_secret text;
  v_hash text;
  v_reg_open timestamptz;
  v_reg_close timestamptz;
  v_cnt int;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- User friendly characters
  v_i int;
BEGIN
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
  v_reg_close := coalesce(v_election.registration_closes_at, v_election.ends_at);

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

  -- Generate SV-XXXXXX code
  v_secret := 'SV-';
  FOR v_i IN 1..6 LOOP
    v_secret := v_secret || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;
  
  v_hash := encode(extensions.digest(v_secret::bytea, 'sha256'), 'hex');

  -- Atomic Ballot Insert
  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash);

  -- Log action
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.registered', 'election', p_election_id, jsonb_build_object('election_id', p_election_id, 'code_format', 'SV-6'));

  -- Auto-lock check: If we have reached the max voters cap, freeze the registration window instantly
  if v_election.max_voters is not null then
    select count(*)::int into v_cnt from public.ballot_tokens b where b.election_id = p_election_id;
    if v_cnt >= v_election.max_voters then
      update public.elections
      set registration_closes_at = now()
      where id = p_election_id;
    end if;
  end if;

  -- Return both keys for complete frontend compatibility & triggering email delivery
  return jsonb_build_object('voting_code', v_secret, 'secret_token', v_secret);
END;
$$;
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
-- Security definer function to check if a voter code is valid for an election
create or replace function public.verify_voter_code_for_audit(p_election_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from public.voter_public_ids
    where election_id = p_election_id
      and (public_id = p_code or public_id = upper(p_code) or public_id = trim(p_code))
  ) into v_exists;
  return v_exists;
end;
$$;

grant execute on function public.verify_voter_code_for_audit(uuid, text) to anon, authenticated;
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
-- Fix digest function missing schema and casts
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
-- Allow authenticated users to insert their own notifications, and system/service functions to insert notifications.
-- Specifically, this fixes the "new row violates row-level security policy for table 'notifications'" error.

drop policy if exists "notifications_insert_any" on public.notifications;

create policy "notifications_insert_any"
  on public.notifications for insert
  to authenticated
  with check (true);
-- Create RPCs to notify specific roles bypassing the `profiles` table RLS

create or replace function public.notify_role(p_role public.user_role, p_title text, p_body text, p_link_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, type, link_path)
  select id, p_title, p_body, 'info', p_link_path
  from public.profiles
  where role = p_role;
end;
$$;

grant execute on function public.notify_role(public.user_role, text, text, text) to authenticated;
-- Add delete policy for notifications so users can clear them
create policy "notifications_delete_self"
  on public.notifications for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Migration 025: Seed Admin Credentials (admin@gmail.com / admin123)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid := '6995d94a-6eab-44e6-98a6-77fc6c415ece';
  v_email text := 'admin@gmail.com';
  v_password text := 'admin123';
  v_encrypted_pw text;
begin
  v_encrypted_pw := crypt(v_password, gen_salt('bf'));

  if not exists (select 1 from auth.users where lower(email) = lower(v_email)) then
    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    )
    values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      v_encrypted_pw,
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "System Admin"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  else
    update auth.users
    set encrypted_password = v_encrypted_pw,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where lower(email) = lower(v_email);

    select id into v_user_id from auth.users where lower(email) = lower(v_email);
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    creator_application_status,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_email,
    'System Admin',
    'super_admin',
    'approved',
    now(),
    now()
  )
  on conflict (id) do update set
    role = 'super_admin',
    creator_application_status = 'approved',
    email = v_email,
    updated_at = now();

end $$;

