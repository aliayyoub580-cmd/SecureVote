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
