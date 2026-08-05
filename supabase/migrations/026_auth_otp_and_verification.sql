-- Migration 026: Auth OTPs, Verification RPC, and Audit Event Fixes
-- Safe to re-run: uses IF NOT EXISTS and OR REPLACE.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Table: auth_otps
-- ---------------------------------------------------------------------------
create table if not exists public.auth_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_code text not null,
  type text not null default 'signup',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists idx_auth_otps_email_type on public.auth_otps (lower(email), type, created_at desc);

-- Enable RLS for auth_otps
alter table public.auth_otps enable row level security;

drop policy if exists "auth_otps_insert_policy" on public.auth_otps;
create policy "auth_otps_insert_policy" on public.auth_otps for insert to anon, authenticated with check (true);

drop policy if exists "auth_otps_select_policy" on public.auth_otps;
create policy "auth_otps_select_policy" on public.auth_otps for select to anon, authenticated using (true);

drop policy if exists "auth_otps_delete_policy" on public.auth_otps;
create policy "auth_otps_delete_policy" on public.auth_otps for delete to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. Function: verify_auth_otp
-- ---------------------------------------------------------------------------
create or replace function public.verify_auth_otp(
  p_email text,
  p_otp text,
  p_type text default 'signup'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp_rec record;
begin
  select * into v_otp_rec
  from public.auth_otps
  where lower(email) = lower(p_email)
    and otp_code = p_otp
    and type = p_type
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_otp_rec is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired verification code');
  end if;

  -- Confirm email in auth.users if type is signup
  if p_type = 'signup' then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where lower(email) = lower(p_email);
  end if;

  -- Clean up used OTP
  delete from public.auth_otps where id = v_otp_rec.id;

  return jsonb_build_object(
    'ok', true,
    'metadata', coalesce(v_otp_rec.metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.verify_auth_otp(text, text, text) from public;
grant execute on function public.verify_auth_otp(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Function: reset_password_with_token
-- ---------------------------------------------------------------------------
create or replace function public.reset_password_with_token(
  p_token text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reset_password_with_token(text, text) from public;
grant execute on function public.reset_password_with_token(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Fix record_audit_event to handle anonymous / system audit events
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
grant execute on function public.record_audit_event(text, text, uuid, jsonb, text, text, text, text) to anon, authenticated;
