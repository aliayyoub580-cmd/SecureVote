-- Super Admin operations: election suspend, delete, stats RPCs, ballot lock reset, in-app admin notifications

-- ---------------------------------------------------------------------------
-- Election suspension flag
-- ---------------------------------------------------------------------------
alter table public.elections add column if not exists suspended boolean not null default false;

-- ---------------------------------------------------------------------------
-- RLS: elections — public must not see suspended published rows; super admin sees all
-- ---------------------------------------------------------------------------
drop policy if exists "elections_select" on public.elections;
create policy "elections_select"
  on public.elections for select
  using (
    public.is_super_admin(auth.uid())
    or created_by = auth.uid()
    or (
      coalesce(suspended, false) = false
      and status in ('approved', 'active', 'closed')
    )
  );

drop policy if exists "elections_delete_super_admin" on public.elections;
create policy "elections_delete_super_admin"
  on public.elections for delete
  using (public.is_super_admin(auth.uid()));

-- (Super admin update already allowed by elections_update_owner in base migration.)

-- ---------------------------------------------------------------------------
-- Creator rejection reason (profile)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists creator_application_rejection_reason text;

-- ---------------------------------------------------------------------------
-- Candidates visible only when election is not suspended (for public browse)
-- ---------------------------------------------------------------------------
drop policy if exists "candidates_select" on public.election_candidates;
create policy "candidates_select"
  on public.election_candidates for select
  using (
    exists (
      select 1 from public.elections e
      where e.id = election_id
        and (
          public.is_super_admin(auth.uid())
          or e.created_by = auth.uid()
          or (
            coalesce(e.suspended, false) = false
            and e.status in ('approved', 'active', 'closed')
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Block voting / registration when suspended
-- ---------------------------------------------------------------------------
create or replace function public.register_for_election(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_election public.elections%rowtype;
  v_secret text;
  v_hash text;
  v_reg_open timestamptz;
  v_reg_close timestamptz;
begin
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
  v_reg_close := coalesce(v_election.registration_closes_at, v_election.starts_at);

  if now() < v_reg_open or now() > v_reg_close then
    raise exception 'registration_window_closed';
  end if;

  if exists (
    select 1 from public.ballot_tokens b
    where b.election_id = p_election_id and b.user_id = v_uid
  ) then
    raise exception 'already_registered';
  end if;

  v_secret := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.ballot_tokens (election_id, user_id, token_hash)
  values (p_election_id, v_uid, v_hash);

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'voter.registered', 'election', p_election_id, jsonb_build_object('election_id', p_election_id));

  return jsonb_build_object('secret_token', v_secret);
end;
$$;

create or replace function public.cast_vote(
  p_election_id uuid,
  p_candidate_id uuid,
  p_secret_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text := encode(digest(trim(p_secret_token), 'sha256'), 'hex');
  v_token_id uuid;
  v_election public.elections%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_election from public.elections where id = p_election_id;
  if not found then
    raise exception 'election_not_found';
  end if;

  if coalesce(v_election.suspended, false) then
    raise exception 'election_suspended';
  end if;

  if v_now < v_election.starts_at or v_now >= v_election.ends_at then
    raise exception 'voting_not_in_window';
  end if;

  if public.effective_election_status(v_election) <> 'active' then
    raise exception 'election_not_active';
  end if;

  select b.id into v_token_id
  from public.ballot_tokens b
  where b.election_id = p_election_id
    and b.token_hash = v_hash
    and b.used_at is null
  for update;

  if v_token_id is null then
    raise exception 'invalid_or_used_ballot';
  end if;

  if not exists (
    select 1 from public.election_candidates c
    where c.id = p_candidate_id and c.election_id = p_election_id
  ) then
    raise exception 'invalid_candidate';
  end if;

  insert into public.votes (election_id, candidate_id, ballot_token_id)
  values (p_election_id, p_candidate_id, v_token_id);

  update public.ballot_tokens set used_at = v_now where id = v_token_id;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    v_uid,
    'vote.cast',
    'election',
    p_election_id,
    jsonb_build_object('election_id', p_election_id, 'candidate_id', p_candidate_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_election_results(p_election_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_suspended boolean;
begin
  select coalesce(suspended, false) into v_suspended from public.elections where id = p_election_id;
  if not found then
    return '[]'::jsonb;
  end if;
  if coalesce(v_suspended, false) then
    return '[]'::jsonb;
  end if;

  select exists (
    select 1 from public.elections e
    where e.id = p_election_id
      and e.status in ('approved', 'active', 'closed')
  ) into v_ok;

  if not v_ok then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(t.row_json)
      from (
        select jsonb_build_object(
          'candidate_id', c.id,
          'name', c.name,
          'votes', (
            select count(*)::int
            from public.votes v
            where v.election_id = p_election_id
              and v.candidate_id = c.id
          )
        ) as row_json
        from public.election_candidates c
        where c.election_id = p_election_id
        order by c.display_order, c.name
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: notify user (in-app). Transactional email should use Edge Functions + provider.
-- ---------------------------------------------------------------------------
create or replace function public.admin_notify_user(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_link_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  insert into public.notifications (user_id, title, body, type, link_path)
  values (p_user_id, p_title, p_body, 'admin', p_link_path);
end;
$$;

grant execute on function public.admin_notify_user(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: reset ballot lock (removes vote row if present, clears used_at)
-- ---------------------------------------------------------------------------
create or replace function public.admin_reset_ballot_lock(p_election_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid uuid;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  select id into v_tid
  from public.ballot_tokens
  where election_id = p_election_id and user_id = p_user_id
  limit 1;

  if v_tid is null then
    raise exception 'ballot_not_found';
  end if;

  delete from public.votes where ballot_token_id = v_tid;
  update public.ballot_tokens set used_at = null where id = v_tid;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(),
    'admin.ballot_lock_reset',
    'election',
    p_election_id,
    jsonb_build_object('election_id', p_election_id, 'user_id', p_user_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_reset_ballot_lock(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin overview stats (single round-trip)
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  return jsonb_build_object(
    'profiles', (select count(*)::int from public.profiles),
    'elections', (select count(*)::int from public.elections),
    'elections_active', (
      select count(*)::int
      from public.elections e
      where coalesce(e.suspended, false) = false
        and e.status in ('approved', 'active')
        and now() >= e.starts_at
        and now() < e.ends_at
    ),
    'approvals_pending', (
      select count(*)::int from public.elections e
      where e.status = 'pending_approval' and coalesce(e.suspended, false) = false
    ),
    'votes_total', (select count(*)::int from public.votes),
    'creators_pending', (
      select count(*)::int from public.profiles p where p.creator_application_status = 'pending'
    ),
    'ballots_issued', (select count(*)::int from public.ballot_tokens)
  );
end;
$$;

grant execute on function public.admin_overview_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Vote trend (last 14 days, UTC day buckets)
-- ---------------------------------------------------------------------------
create or replace function public.admin_vote_trend()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  return coalesce(
    (
      with days as (
        select date_trunc('day', cast_at) as d, count(*)::int as c
        from public.votes
        where cast_at >= now() - interval '14 days'
        group by 1
        order by 1 asc
      )
      select jsonb_agg(jsonb_build_object('day', d, 'votes', c))
      from days
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.admin_vote_trend() to authenticated;
