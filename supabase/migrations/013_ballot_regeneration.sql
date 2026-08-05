-- Migration to support full ballot token regeneration for voters who lost their voting code.
-- This will revoke the old token and issue a completely new one.

create or replace function public.regenerate_ballot_token(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_election public.elections%rowtype;
  v_old_ballot_id uuid;
  v_secret text;
  v_hash text;
  v_new_ballot_id uuid;
  v_vid text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 1. Get election and check status
  select * into v_election from public.elections where id = p_election_id for update;
  if not found then
    raise exception 'election_not_found';
  end if;

  if v_election.status not in ('approved', 'active') then
    raise exception 'election_not_open';
  end if;

  -- 2. Find old ballot
  select id into v_old_ballot_id 
  from public.ballot_tokens 
  where election_id = p_election_id and user_id = v_uid;

  if v_old_ballot_id is null then
    raise exception 'no_existing_registration';
  end if;

  -- 3. Check if already voted (cannot regenerate if already voted)
  if exists (select 1 from public.votes where ballot_token_id = v_old_ballot_id) then
    raise exception 'already_voted_cannot_regenerate';
  end if;

  -- 4. Delete/Revoke old ballot and its public ID
  delete from public.voter_public_ids where ballot_token_id = v_old_ballot_id;
  delete from public.ballot_tokens where id = v_old_ballot_id;

  -- 5. Issue new secret token
  v_secret := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash)
  returning id into v_new_ballot_id;

  -- 6. New public ID will be handled by the trigger automatically (trg_ballot_tokens_voter_public_id)
  -- But we fetch it to return it to the UI
  select v.public_id
  into v_vid
  from public.voter_public_ids v
  where v.ballot_token_id = v_new_ballot_id
  limit 1;

  -- 7. Audit log
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.ballot_regenerated', 'election', p_election_id, jsonb_build_object('election_id', p_election_id));

  return jsonb_build_object(
    'secret_token', v_secret,
    'voter_public_id', coalesce(v_vid, '')
  );
end;
$$;

grant execute on function public.regenerate_ballot_token(uuid) to authenticated;
