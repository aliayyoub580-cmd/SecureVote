-- Migration 029: Enforce Election Status Transitions & Social Caller Authorization

-- 1. Prevent creators from self-approving or self-rejecting elections.
-- Status changes to 'approved' or 'rejected' must be performed by super_admin only.
create or replace function public.check_election_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (NEW.status is distinct from OLD.status) then
    if (NEW.status in ('approved', 'rejected') and not public.is_super_admin(auth.uid())) then
      raise exception 'Only super administrators are permitted to approve or reject elections.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_election_status_guard on public.elections;
create trigger trg_election_status_guard
before update on public.elections
for each row
execute function public.check_election_status_transition();

-- 2. Secure Social RPCs against Caller Impersonation (IDOR/BOLA)

-- 2a. create_social_post: enforce author_id = auth.uid()
create or replace function public.create_social_post(
  p_author_id    uuid,
  p_post_type    post_type,
  p_title        text,
  p_content      text,
  p_content_html text,
  p_visibility   post_visibility,
  p_election_id  uuid,
  p_hashtags     text[],
  p_status       post_status default 'published'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_post_id uuid;
  v_tag text;
  v_htag_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentication required to publish posts.';
  end if;

  if p_author_id is distinct from v_caller and not public.is_super_admin(v_caller) then
    raise exception 'Unauthorized: author_id must match authenticated caller.';
  end if;

  insert into social_posts (
    author_id, post_type, status, visibility, title,
    content, content_html, election_id, published_at
  ) values (
    p_author_id, p_post_type, p_status, p_visibility, p_title,
    p_content, p_content_html, p_election_id,
    case when p_status = 'published' then now() else null end
  ) returning id into v_post_id;

  -- upsert hashtags
  foreach v_tag in array coalesce(p_hashtags, '{}') loop
    insert into hashtags (tag) values (lower(v_tag))
      on conflict (tag) do nothing;
    select id into v_htag_id from hashtags where tag = lower(v_tag);
    insert into post_hashtags (post_id, hashtag_id)
      values (v_post_id, v_htag_id) on conflict do nothing;
  end loop;

  return v_post_id;
end;
$$;

-- 2b. toggle_post_like: enforce user_id = auth.uid()
create or replace function public.toggle_post_like(p_post_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required to like posts.';
  end if;

  if p_user_id is distinct from v_caller and not public.is_super_admin(v_caller) then
    raise exception 'Unauthorized: user_id must match authenticated caller.';
  end if;

  if exists (select 1 from post_likes where post_id = p_post_id and user_id = p_user_id) then
    delete from post_likes where post_id = p_post_id and user_id = p_user_id;
    return false;
  else
    insert into post_likes (post_id, user_id) values (p_post_id, p_user_id);
    return true;
  end if;
end;
$$;

-- 2c. toggle_comment_like: enforce user_id = auth.uid()
create or replace function public.toggle_comment_like(p_comment_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required to like comments.';
  end if;

  if p_user_id is distinct from v_caller and not public.is_super_admin(v_caller) then
    raise exception 'Unauthorized: user_id must match authenticated caller.';
  end if;

  if exists (select 1 from comment_likes where comment_id = p_comment_id and user_id = p_user_id) then
    delete from comment_likes where comment_id = p_comment_id and user_id = p_user_id;
    return false;
  else
    insert into comment_likes (comment_id, user_id) values (p_comment_id, p_user_id);
    return true;
  end if;
end;
$$;

-- 2d. toggle_repost: enforce user_id = auth.uid()
create or replace function public.toggle_repost(p_post_id uuid, p_user_id uuid, p_quote text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required to repost.';
  end if;

  if p_user_id is distinct from v_caller and not public.is_super_admin(v_caller) then
    raise exception 'Unauthorized: user_id must match authenticated caller.';
  end if;

  if exists (select 1 from reposts where post_id = p_post_id and user_id = p_user_id) then
    delete from reposts where post_id = p_post_id and user_id = p_user_id;
    return false;
  else
    insert into reposts (post_id, user_id, quote_text) values (p_post_id, p_user_id, p_quote);
    return true;
  end if;
end;
$$;

-- 2e. toggle_bookmark: enforce user_id = auth.uid()
create or replace function public.toggle_bookmark(p_post_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required to bookmark posts.';
  end if;

  if p_user_id is distinct from v_caller and not public.is_super_admin(v_caller) then
    raise exception 'Unauthorized: user_id must match authenticated caller.';
  end if;

  if exists (select 1 from bookmarks where post_id = p_post_id and user_id = p_user_id) then
    delete from bookmarks where post_id = p_post_id and user_id = p_user_id;
    return false;
  else
    insert into bookmarks (post_id, user_id) values (p_post_id, p_user_id);
    return true;
  end if;
end;
$$;

-- 2f. toggle_follow: enforce follower_id = auth.uid()
create or replace function public.toggle_follow(p_follower uuid, p_followee uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required to follow.';
  end if;

  if p_follower is distinct from v_caller and not public.is_super_admin(v_caller) then
    raise exception 'Unauthorized: follower must match authenticated caller.';
  end if;

  if p_follower = p_followee then
    raise exception 'Cannot follow yourself';
  end if;

  if exists (select 1 from follows where follower_id = p_follower and followee_id = p_followee) then
    delete from follows where follower_id = p_follower and followee_id = p_followee;
    return false;
  else
    insert into follows (follower_id, followee_id) values (p_follower, p_followee);
    return true;
  end if;
end;
$$;
