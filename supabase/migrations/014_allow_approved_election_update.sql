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
