-- Migration 025: Seed Admin Credentials (admin@gmail.com / admin123)
-- Safe to re-run on clean or existing databases.

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid := '6995d94a-6eab-44e6-98a6-77fc6c415ece';
  v_email text := 'admin@gmail.com';
  v_password text := 'admin123';
  v_encrypted_pw text;
begin
  v_encrypted_pw := crypt(v_password, gen_salt('bf'));

  -- 1. Insert or update auth.users
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

  -- 2. Insert or update public.profiles
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
