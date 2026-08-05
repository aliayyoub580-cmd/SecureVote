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
