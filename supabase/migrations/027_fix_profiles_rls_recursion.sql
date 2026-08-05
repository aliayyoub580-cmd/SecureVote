-- Migration 027: Fix profiles table RLS infinite recursion
-- Removes recursive subqueries inside profiles select policy.

drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);
