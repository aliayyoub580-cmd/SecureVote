-- Migration 027: Allow managing polls and candidates for approved elections
-- (Only active and closed elections should restrict ballot structure changes)

-- 1. election_polls insert
drop policy if exists "election_polls_insert_owner" on public.election_polls;
create policy "election_polls_insert_owner"
  on public.election_polls for insert
  with check (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (e.created_by = auth.uid() or public.is_super_admin(auth.uid()))
        and e.status in ('draft', 'pending_approval', 'rejected', 'approved')
    )
  );

-- 2. election_polls update
drop policy if exists "election_polls_update_owner" on public.election_polls;
create policy "election_polls_update_owner"
  on public.election_polls for update
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (e.created_by = auth.uid() or public.is_super_admin(auth.uid()))
        and e.status in ('draft', 'pending_approval', 'rejected', 'approved')
    )
  )
  with check (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (e.created_by = auth.uid() or public.is_super_admin(auth.uid()))
    )
  );

-- 3. election_polls delete
drop policy if exists "election_polls_delete_owner" on public.election_polls;
create policy "election_polls_delete_owner"
  on public.election_polls for delete
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (e.created_by = auth.uid() or public.is_super_admin(auth.uid()))
        and e.status in ('draft', 'pending_approval', 'rejected', 'approved')
    )
  );

-- 4. election_candidates insert
drop policy if exists "candidates_insert_owner" on public.election_candidates;
create policy "candidates_insert_owner"
  on public.election_candidates for insert
  with check (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (e.created_by = auth.uid() or public.is_super_admin(auth.uid()))
        and e.status in ('draft', 'pending_approval', 'rejected', 'approved')
    )
  );

-- 5. election_candidates update
drop policy if exists "candidates_update_owner" on public.election_candidates;
create policy "candidates_update_owner"
  on public.election_candidates for update
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (e.created_by = auth.uid() or public.is_super_admin(auth.uid()))
        and e.status in ('draft', 'pending_approval', 'rejected', 'approved')
    )
  );

-- 6. election_candidates delete
drop policy if exists "candidates_delete_owner" on public.election_candidates;
create policy "candidates_delete_owner"
  on public.election_candidates for delete
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (e.created_by = auth.uid() or public.is_super_admin(auth.uid()))
        and e.status in ('draft', 'pending_approval', 'rejected', 'approved')
    )
  );
