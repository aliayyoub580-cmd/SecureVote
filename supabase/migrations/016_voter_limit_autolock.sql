-- Auto-lock when max voters reached & freeze final voter list
CREATE OR REPLACE FUNCTION public.register_for_election(p_election_id uuid, p_accept_terms boolean default true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_election public.elections%rowtype;
  v_secret text;
  v_hash text;
  v_reg_open timestamptz;
  v_reg_close timestamptz;
  v_cnt int;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- User friendly characters
  v_i int;
BEGIN
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_election from public.elections where id = p_election_id for update;
  if not found then
    raise exception 'election_not_found';
  end if;

  if coalesce(v_election.suspended, false) then
    raise exception 'election_suspended';
  end if;

  if v_election.status not in ('approved', 'active') then
    raise exception 'election_not_open_for_registration';
  end if;

  v_reg_open := coalesce(v_election.registration_opens_at, v_election.starts_at - interval '30 days');
  v_reg_close := coalesce(v_election.registration_closes_at, v_election.ends_at);

  if now() < v_reg_open or now() > v_reg_close then
    raise exception 'registration_window_closed';
  end if;

  if v_election.max_voters is not null then
    select count(*)::int into v_cnt from public.ballot_tokens b where b.election_id = p_election_id;
    if v_cnt >= v_election.max_voters then
      raise exception 'registration_full';
    end if;
  end if;

  if exists (
    select 1 from public.ballot_tokens b
    where b.election_id = p_election_id and b.user_id = v_uid
  ) then
    raise exception 'already_registered';
  end if;

  -- Generate SV-XXXXXX code
  v_secret := 'SV-';
  FOR v_i IN 1..6 LOOP
    v_secret := v_secret || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;
  
  v_hash := encode(extensions.digest(v_secret::bytea, 'sha256'), 'hex');

  -- Atomic Ballot Insert
  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash);

  -- Log action
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.registered', 'election', p_election_id, jsonb_build_object('election_id', p_election_id, 'code_format', 'SV-6'));

  -- Auto-lock check: If we have reached the max voters cap, freeze the registration window instantly
  if v_election.max_voters is not null then
    select count(*)::int into v_cnt from public.ballot_tokens b where b.election_id = p_election_id;
    if v_cnt >= v_election.max_voters then
      update public.elections
      set registration_closes_at = now()
      where id = p_election_id;
    end if;
  end if;

  -- Return both keys for complete frontend compatibility & triggering email delivery
  return jsonb_build_object('voting_code', v_secret, 'secret_token', v_secret);
END;
$$;
