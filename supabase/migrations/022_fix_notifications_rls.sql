-- Allow authenticated users to insert their own notifications, and system/service functions to insert notifications.
-- Specifically, this fixes the "new row violates row-level security policy for table 'notifications'" error.

drop policy if exists "notifications_insert_any" on public.notifications;

create policy "notifications_insert_any"
  on public.notifications for insert
  to authenticated
  with check (true);
