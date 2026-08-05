-- Security definer function to check if a voter code is valid for an election
create or replace function public.verify_voter_code_for_audit(p_election_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from public.voter_public_ids
    where election_id = p_election_id
      and (public_id = p_code or public_id = upper(p_code) or public_id = trim(p_code))
  ) into v_exists;
  return v_exists;
end;
$$;

grant execute on function public.verify_voter_code_for_audit(uuid, text) to anon, authenticated;
