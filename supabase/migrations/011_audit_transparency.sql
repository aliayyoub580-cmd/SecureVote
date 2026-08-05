-- Audit & transparency: context columns, append RPC, paginated admin query, realtime.

alter table public.audit_logs
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists device_label text,
  add column if not exists category text not null default 'general';

create index if not exists idx_audit_logs_category_created on public.audit_logs (category, created_at desc);
create index if not exists idx_audit_logs_action_created on public.audit_logs (action, created_at desc);
create index if not exists idx_audit_logs_actor_created on public.audit_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Client / app events (authenticated); runs as definer so RLS does not block.
-- ---------------------------------------------------------------------------
create or replace function public.record_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_metadata jsonb,
  p_ip text,
  p_user_agent text,
  p_device_label text,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
  v_cat text := coalesce(nullif(trim(p_category), ''), 'general');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'invalid_action';
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent,
    device_label,
    category
  )
  values (
    v_uid,
    trim(p_action),
    coalesce(nullif(trim(p_resource_type), ''), 'platform'),
    p_resource_id,
    coalesce(p_metadata, '{}'::jsonb),
    nullif(trim(p_ip), ''),
    nullif(trim(p_user_agent), ''),
    nullif(trim(p_device_label), ''),
    v_cat
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_audit_event(text, text, uuid, jsonb, text, text, text, text) from public;
grant execute on function public.record_audit_event(text, text, uuid, jsonb, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Super Admin: paginated + filterable audit trail (single round-trip).
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_audit_logs(
  p_limit int default 50,
  p_offset int default 0,
  p_category text default null,
  p_action_prefix text default null,
  p_actor_id uuid default null,
  p_resource_type text default null,
  p_search text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(nullif(p_limit, 0), 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
  v_search text := nullif(trim(p_search), '');
  v_cat text := nullif(trim(p_category), '');
  v_prefix text := nullif(trim(p_action_prefix), '');
  v_rt text := nullif(trim(p_resource_type), '');
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;

  select count(*) into v_total
  from public.audit_logs a
  where
    (v_cat is null or a.category = v_cat)
    and (v_prefix is null or a.action ilike v_prefix || '%')
    and (p_actor_id is null or a.actor_id = p_actor_id)
    and (v_rt is null or a.resource_type = v_rt)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to)
    and (
      v_search is null
      or a.action ilike '%' || v_search || '%'
      or a.resource_type ilike '%' || v_search || '%'
      or coalesce(a.ip_address, '') ilike '%' || v_search || '%'
      or coalesce(a.device_label, '') ilike '%' || v_search || '%'
      or coalesce(a.user_agent, '') ilike '%' || v_search || '%'
      or coalesce(a.metadata::text, '') ilike '%' || v_search || '%'
      or (a.resource_id is not null and a.resource_id::text ilike '%' || v_search || '%')
      or (a.actor_id is not null and a.actor_id::text ilike '%' || v_search || '%')
    );

  select coalesce(
    (
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select
          a.id,
          a.actor_id,
          a.action,
          a.resource_type,
          a.resource_id,
          a.metadata,
          a.created_at,
          a.ip_address,
          a.user_agent,
          a.device_label,
          a.category
        from public.audit_logs a
        where
          (v_cat is null or a.category = v_cat)
          and (v_prefix is null or a.action ilike v_prefix || '%')
          and (p_actor_id is null or a.actor_id = p_actor_id)
          and (v_rt is null or a.resource_type = v_rt)
          and (p_from is null or a.created_at >= p_from)
          and (p_to is null or a.created_at <= p_to)
          and (
            v_search is null
            or a.action ilike '%' || v_search || '%'
            or a.resource_type ilike '%' || v_search || '%'
            or coalesce(a.ip_address, '') ilike '%' || v_search || '%'
            or coalesce(a.device_label, '') ilike '%' || v_search || '%'
            or coalesce(a.user_agent, '') ilike '%' || v_search || '%'
            or coalesce(a.metadata::text, '') ilike '%' || v_search || '%'
            or (a.resource_id is not null and a.resource_id::text ilike '%' || v_search || '%')
            or (a.actor_id is not null and a.actor_id::text ilike '%' || v_search || '%')
          )
        order by a.created_at desc
        limit v_limit offset v_offset
      ) r
    ),
    '[]'::jsonb
  )
  into v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function public.admin_list_audit_logs(int, int, text, text, uuid, text, text, timestamptz, timestamptz) from public;
grant execute on function public.admin_list_audit_logs(int, int, text, text, uuid, text, text, timestamptz, timestamptz) to authenticated;

-- Backfill category for existing rows (idempotent heuristics)
update public.audit_logs set category = 'auth' where action ilike 'auth.%';
update public.audit_logs set category = 'vote' where action ilike 'vote.%';
update public.audit_logs set category = 'voter' where action ilike 'voter.%';
update public.audit_logs set category = 'admin' where action ilike 'admin.%' or action ilike 'profile.%' or action ilike 'creator_application.%';
update public.audit_logs set category = 'election' where action ilike 'election.%';

-- Realtime: if this errors because audit_logs is already in supabase_realtime, skip manually.
alter publication supabase_realtime add table public.audit_logs;
