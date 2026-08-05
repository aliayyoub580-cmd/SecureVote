-- Add delete policy for notifications so users can clear them
create policy "notifications_delete_self"
  on public.notifications for delete
  using (user_id = auth.uid());
