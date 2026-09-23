-- Migration 028: Secure Password Reset & OTP Lockdown
-- 1. Revoke public SELECT and DELETE on auth_otps to prevent OTP exposure over PostgREST.
-- 2. Implement secure 3-argument and 2-argument reset_password_with_token functions.

-- Revoke public read/delete access on auth_otps
drop policy if exists "auth_otps_select_policy" on public.auth_otps;
drop policy if exists "auth_otps_delete_policy" on public.auth_otps;

-- Only service_role can directly select and delete from auth_otps
create policy "auth_otps_select_admin_only"
  on public.auth_otps for select
  to authenticated
  using (public.is_super_admin(auth.uid()));

create policy "auth_otps_delete_admin_only"
  on public.auth_otps for delete
  to authenticated
  using (public.is_super_admin(auth.uid()));

-- 3-argument function: unauthenticated password reset using OTP verification
create or replace function public.reset_password_with_token(
  p_email text,
  p_token text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp_rec record;
  v_user_id uuid;
begin
  if p_email is null or p_token is null or p_new_password is null then
    return jsonb_build_object('ok', false, 'error', 'All fields are required');
  end if;

  if length(p_new_password) < 6 then
    return jsonb_build_object('ok', false, 'error', 'Password must be at least 6 characters');
  end if;

  -- 1. Validate OTP from auth_otps
  select * into v_otp_rec
  from public.auth_otps
  where lower(email) = lower(trim(p_email))
    and otp_code = trim(p_token)
    and type = 'reset'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_otp_rec is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired verification code');
  end if;

  -- 2. Find user in auth.users
  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'No user found with this email');
  end if;

  -- 3. Update password in auth.users
  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  where id = v_user_id;

  -- 4. Invalidate / delete used OTP
  delete from public.auth_otps where id = v_otp_rec.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reset_password_with_token(text, text, text) from public;
grant execute on function public.reset_password_with_token(text, text, text) to anon, authenticated;

-- 2-argument function: authenticated password update
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

  if length(p_new_password) < 6 then
    return jsonb_build_object('ok', false, 'error', 'Password must be at least 6 characters');
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
