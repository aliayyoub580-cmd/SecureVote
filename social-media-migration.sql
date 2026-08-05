-- =============================================================================
-- SECUREVOTE SOCIAL MEDIA MODULE — COMPLETE MIGRATION
-- Single file: tables, indexes, constraints, FKs, views, functions, triggers,
-- RLS policies, default values, counters, performance indexes.
-- Run this once in the Supabase SQL editor.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE post_type AS ENUM (
    'text','image','multi_image','pdf','election_announcement',
    'poll','election_result','candidate_highlight','event','public_notice'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_visibility AS ENUM ('public','followers','private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_status AS ENUM ('published','draft','scheduled','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM ('spam','fake','harassment','violence','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE social_notif_type AS ENUM (
    'like','comment','reply','mention','follow','repost',
    'election_invite','election_started','election_ended','result_published'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SOCIAL PROFILES (extends existing profiles table)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bio              TEXT,
  ADD COLUMN IF NOT EXISTS website          TEXT,
  ADD COLUMN IF NOT EXISTS location         TEXT,
  ADD COLUMN IF NOT EXISTS avatar_path      TEXT,
  ADD COLUMN IF NOT EXISTS banner_path      TEXT,
  ADD COLUMN IF NOT EXISTS is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_suspended     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS post_count       INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follower_count   INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count  INT     NOT NULL DEFAULT 0;

-- Auto-generate username from email when null (backfill + trigger)
UPDATE profiles
SET username = LOWER(SPLIT_PART(email, '@', 1)) || '_' || SUBSTR(id::TEXT, 1, 6)
WHERE username IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. POSTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_type       post_type   NOT NULL DEFAULT 'text',
  status          post_status NOT NULL DEFAULT 'published',
  visibility      post_visibility NOT NULL DEFAULT 'public',
  title           TEXT,
  content         TEXT,
  content_html    TEXT,
  is_pinned       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_featured     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_locked       BOOLEAN     NOT NULL DEFAULT FALSE,  -- comments locked
  election_id     UUID        REFERENCES elections(id) ON DELETE SET NULL,
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at       TIMESTAMPTZ,
  -- denormalized counters (updated by triggers)
  like_count      INT NOT NULL DEFAULT 0,
  comment_count   INT NOT NULL DEFAULT 0,
  repost_count    INT NOT NULL DEFAULT 0,
  share_count     INT NOT NULL DEFAULT 0,
  bookmark_count  INT NOT NULL DEFAULT 0,
  view_count      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_author     ON social_posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_status     ON social_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_election   ON social_posts (election_id) WHERE election_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_feed       ON social_posts (status, visibility, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_pinned     ON social_posts (is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_social_posts_type       ON social_posts (post_type, published_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. POST MEDIA (images + PDFs)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  media_type   TEXT NOT NULL CHECK (media_type IN ('image','pdf')),
  storage_path TEXT NOT NULL,
  file_name    TEXT,
  file_size    BIGINT,
  mime_type    TEXT,
  width        INT,
  height       INT,
  display_order INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media (post_id, display_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DRAFT POSTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS draft_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_type    post_type NOT NULL DEFAULT 'text',
  title        TEXT,
  content      TEXT,
  content_html TEXT,
  media_json   JSONB DEFAULT '[]',
  hashtags     TEXT[] DEFAULT '{}',
  visibility   post_visibility NOT NULL DEFAULT 'public',
  election_id  UUID REFERENCES elections(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_posts_author ON draft_posts (author_id, updated_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. POST LIKES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. COMMENTS (nested: parent_id for replies)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (CHAR_LENGTH(content) <= 2000),
  edited_at   TIMESTAMPTZ,
  like_count  INT NOT NULL DEFAULT 0,
  reply_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post      ON post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent    ON post_comments (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_author    ON post_comments (author_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. COMMENT LIKES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. REPOSTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reposts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quote_text   TEXT,            -- NULL = plain repost; TEXT = quote repost
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)    -- one repost per user per post
);

CREATE INDEX IF NOT EXISTS idx_reposts_user ON reposts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reposts_post ON reposts (post_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. BOOKMARKS / SAVED POSTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. FOLLOWS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. HASHTAGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hashtags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag        TEXT NOT NULL UNIQUE,         -- lowercase, no '#'
  post_count INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hashtags_tag       ON hashtags (tag);
CREATE INDEX IF NOT EXISTS idx_hashtags_trending  ON hashtags (post_count DESC);

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag ON post_hashtags (hashtag_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. MENTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        UUID REFERENCES social_posts(id)   ON DELETE CASCADE,
  comment_id     UUID REFERENCES post_comments(id)  ON DELETE CASCADE,
  mentioned_user UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_mentions_user    ON mentions (mentioned_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_post    ON mentions (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions (comment_id) WHERE comment_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. POST VIEWS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = anon
  ip_hash    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_unique ON post_views (post_id, COALESCE(user_id::TEXT, ip_hash));
CREATE INDEX IF NOT EXISTS idx_post_views_post ON post_views (post_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. SOCIAL POLLS (post_type = 'poll')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_polls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL UNIQUE REFERENCES social_posts(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  total_votes  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_poll_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES social_polls(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  vote_count INT  NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON social_poll_options (poll_id, display_order);

CREATE TABLE IF NOT EXISTS social_poll_votes (
  poll_id    UUID NOT NULL REFERENCES social_polls(id)         ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES social_poll_options(id)  ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id)             ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)   -- one vote per user per poll
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. SOCIAL NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notif_type   social_notif_type NOT NULL,
  post_id      UUID REFERENCES social_posts(id)   ON DELETE CASCADE,
  comment_id   UUID REFERENCES post_comments(id)  ON DELETE CASCADE,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snotif_recipient ON social_notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snotif_unread    ON social_notifications (recipient_id, read_at)
  WHERE read_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. REPORTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES social_posts(id)   ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  reason      report_reason NOT NULL,
  details     TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_post     ON post_reports (post_id);
CREATE INDEX IF NOT EXISTS idx_reports_pending  ON post_reports (resolved_at) WHERE resolved_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. TRIGGER HELPER — updated_at auto-stamp
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_social_posts_updated
    BEFORE UPDATE ON social_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_draft_posts_updated
    BEFORE UPDATE ON draft_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_comments_updated
    BEFORE UPDATE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. TRIGGER — auto username on profile insert
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_username()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.username IS NULL AND NEW.email IS NOT NULL THEN
    NEW.username := LOWER(SPLIT_PART(NEW.email,'@',1))
                    || '_' || SUBSTR(NEW.id::TEXT, 1, 6);
  END IF;
  RETURN NEW;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_auto_username
    BEFORE INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION auto_username();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. TRIGGER — post like counter
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_post_likes_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_post_likes_ins
    AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION trg_post_likes_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_post_likes_del
    AFTER DELETE ON post_likes FOR EACH ROW EXECUTE FUNCTION trg_post_likes_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. TRIGGER — comment counter on post + reply counter on parent
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_comment_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts    SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE post_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts    SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE post_comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.parent_id;
    END IF;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_comments_ins
    AFTER INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION trg_comment_counters();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_comments_del
    AFTER DELETE ON post_comments FOR EACH ROW EXECUTE FUNCTION trg_comment_counters();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. TRIGGER — comment like counter
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_comment_likes_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE post_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE post_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_clikes_ins
    AFTER INSERT ON comment_likes FOR EACH ROW EXECUTE FUNCTION trg_comment_likes_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_clikes_del
    AFTER DELETE ON comment_likes FOR EACH ROW EXECUTE FUNCTION trg_comment_likes_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. TRIGGER — repost counter
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_repost_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET repost_count = repost_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET repost_count = GREATEST(repost_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_reposts_ins
    AFTER INSERT ON reposts FOR EACH ROW EXECUTE FUNCTION trg_repost_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_reposts_del
    AFTER DELETE ON reposts FOR EACH ROW EXECUTE FUNCTION trg_repost_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 23. TRIGGER — bookmark counter
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_bookmark_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET bookmark_count = bookmark_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bookmarks_ins
    AFTER INSERT ON bookmarks FOR EACH ROW EXECUTE FUNCTION trg_bookmark_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bookmarks_del
    AFTER DELETE ON bookmarks FOR EACH ROW EXECUTE FUNCTION trg_bookmark_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 24. TRIGGER — view counter
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_view_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE social_posts SET view_count = view_count + 1 WHERE id = NEW.post_id;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_views_ins
    AFTER INSERT ON post_views FOR EACH ROW EXECUTE FUNCTION trg_view_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 25. TRIGGER — follower / following counters on profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_follow_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count  = follower_count  + 1 WHERE id = NEW.followee_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count  = GREATEST(follower_count  - 1, 0) WHERE id = OLD.followee_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_follows_ins
    AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION trg_follow_counters();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_follows_del
    AFTER DELETE ON follows FOR EACH ROW EXECUTE FUNCTION trg_follow_counters();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 26. TRIGGER — post count on profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_post_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'published' THEN
    UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'published' THEN
    UPDATE profiles SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.author_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'published' AND NEW.status = 'published' THEN
      UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.author_id;
    ELSIF OLD.status = 'published' AND NEW.status <> 'published' THEN
      UPDATE profiles SET post_count = GREATEST(post_count - 1, 0) WHERE id = NEW.author_id;
    END IF;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_posts_count
    AFTER INSERT OR UPDATE OR DELETE ON social_posts
    FOR EACH ROW EXECUTE FUNCTION trg_post_count();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 27. TRIGGER — hashtag counter
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_hashtag_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE hashtags SET post_count = post_count + 1 WHERE id = NEW.hashtag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE hashtags SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.hashtag_id;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_post_hashtags_ins
    AFTER INSERT ON post_hashtags FOR EACH ROW EXECUTE FUNCTION trg_hashtag_count();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_post_hashtags_del
    AFTER DELETE ON post_hashtags FOR EACH ROW EXECUTE FUNCTION trg_hashtag_count();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 28. TRIGGER — poll vote counter
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_poll_vote_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    UPDATE social_polls         SET total_votes = total_votes + 1 WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
    UPDATE social_polls         SET total_votes = GREATEST(total_votes - 1, 0) WHERE id = OLD.poll_id;
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_poll_votes_ins
    AFTER INSERT ON social_poll_votes FOR EACH ROW EXECUTE FUNCTION trg_poll_vote_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_poll_votes_del
    AFTER DELETE ON social_poll_votes FOR EACH ROW EXECUTE FUNCTION trg_poll_vote_counter();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 29. VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- Feed view: post + author profile in one row
CREATE OR REPLACE VIEW v_social_feed AS
SELECT
  sp.id,
  sp.post_type,
  sp.status,
  sp.visibility,
  sp.title,
  sp.content,
  sp.content_html,
  sp.is_pinned,
  sp.is_featured,
  sp.is_locked,
  sp.election_id,
  sp.published_at,
  sp.edited_at,
  sp.like_count,
  sp.comment_count,
  sp.repost_count,
  sp.share_count,
  sp.bookmark_count,
  sp.view_count,
  sp.created_at,
  -- author
  p.id           AS author_id,
  p.username     AS author_username,
  p.full_name    AS author_full_name,
  p.avatar_path  AS author_avatar,
  p.role         AS author_role,
  p.is_verified  AS author_verified,
  p.is_suspended AS author_suspended
FROM social_posts sp
JOIN profiles p ON p.id = sp.author_id
WHERE sp.status = 'published';

-- Trending hashtags view
CREATE OR REPLACE VIEW v_trending_hashtags AS
SELECT tag, post_count
FROM hashtags
WHERE post_count > 0
ORDER BY post_count DESC
LIMIT 30;

-- ─────────────────────────────────────────────────────────────────────────────
-- 30. CORE FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- 30a. Create post (with hashtag + mention extraction)
CREATE OR REPLACE FUNCTION create_social_post(
  p_author_id    UUID,
  p_post_type    post_type,
  p_title        TEXT,
  p_content      TEXT,
  p_content_html TEXT,
  p_visibility   post_visibility,
  p_election_id  UUID,
  p_hashtags     TEXT[],   -- lowercase, no '#'
  p_status       post_status DEFAULT 'published'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post_id UUID;
  v_tag     TEXT;
  v_htag_id UUID;
BEGIN
  INSERT INTO social_posts (
    author_id, post_type, status, visibility, title,
    content, content_html, election_id, published_at
  ) VALUES (
    p_author_id, p_post_type, p_status, p_visibility, p_title,
    p_content, p_content_html, p_election_id,
    CASE WHEN p_status = 'published' THEN NOW() ELSE NULL END
  ) RETURNING id INTO v_post_id;

  -- upsert hashtags
  FOREACH v_tag IN ARRAY COALESCE(p_hashtags, '{}') LOOP
    INSERT INTO hashtags (tag) VALUES (LOWER(v_tag))
      ON CONFLICT (tag) DO NOTHING;
    SELECT id INTO v_htag_id FROM hashtags WHERE tag = LOWER(v_tag);
    INSERT INTO post_hashtags (post_id, hashtag_id)
      VALUES (v_post_id, v_htag_id) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_post_id;
END; $$;

-- 30b. Toggle like (insert / delete — idempotent)
CREATE OR REPLACE FUNCTION toggle_post_like(p_post_id UUID, p_user_id UUID)
RETURNS BOOLEAN   -- TRUE = now liked, FALSE = unliked
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id) THEN
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
    RETURN FALSE;
  ELSE
    INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, p_user_id);
    RETURN TRUE;
  END IF;
END; $$;

-- 30c. Toggle comment like
CREATE OR REPLACE FUNCTION toggle_comment_like(p_comment_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM comment_likes WHERE comment_id = p_comment_id AND user_id = p_user_id) THEN
    DELETE FROM comment_likes WHERE comment_id = p_comment_id AND user_id = p_user_id;
    RETURN FALSE;
  ELSE
    INSERT INTO comment_likes (comment_id, user_id) VALUES (p_comment_id, p_user_id);
    RETURN TRUE;
  END IF;
END; $$;

-- 30d. Toggle repost
CREATE OR REPLACE FUNCTION toggle_repost(p_post_id UUID, p_user_id UUID, p_quote TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reposts WHERE post_id = p_post_id AND user_id = p_user_id) THEN
    DELETE FROM reposts WHERE post_id = p_post_id AND user_id = p_user_id;
    RETURN FALSE;
  ELSE
    INSERT INTO reposts (post_id, user_id, quote_text) VALUES (p_post_id, p_user_id, p_quote);
    RETURN TRUE;
  END IF;
END; $$;

-- 30e. Toggle bookmark
CREATE OR REPLACE FUNCTION toggle_bookmark(p_post_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM bookmarks WHERE post_id = p_post_id AND user_id = p_user_id) THEN
    DELETE FROM bookmarks WHERE post_id = p_post_id AND user_id = p_user_id;
    RETURN FALSE;
  ELSE
    INSERT INTO bookmarks (post_id, user_id) VALUES (p_post_id, p_user_id);
    RETURN TRUE;
  END IF;
END; $$;

-- 30f. Toggle follow
CREATE OR REPLACE FUNCTION toggle_follow(p_follower UUID, p_followee UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_follower = p_followee THEN RAISE EXCEPTION 'Cannot follow yourself'; END IF;
  IF EXISTS (SELECT 1 FROM follows WHERE follower_id = p_follower AND followee_id = p_followee) THEN
    DELETE FROM follows WHERE follower_id = p_follower AND followee_id = p_followee;
    RETURN FALSE;
  ELSE
    INSERT INTO follows (follower_id, followee_id) VALUES (p_follower, p_followee);
    RETURN TRUE;
  END IF;
END; $$;

-- 30g. Record view (idempotent per user or ip_hash)
CREATE OR REPLACE FUNCTION record_post_view(p_post_id UUID, p_user_id UUID DEFAULT NULL, p_ip_hash TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO post_views (post_id, user_id, ip_hash)
  VALUES (p_post_id, p_user_id, p_ip_hash)
  ON CONFLICT DO NOTHING;
END; $$;

-- 30h. Get paginated feed (cursor-based) for a given user
CREATE OR REPLACE FUNCTION get_social_feed(
  p_user_id    UUID,
  p_filter     TEXT DEFAULT 'latest',   -- latest | trending | following | election_updates
  p_cursor     TIMESTAMPTZ DEFAULT NULL,
  p_limit      INT DEFAULT 20
)
RETURNS TABLE (
  id UUID, post_type post_type, title TEXT, content TEXT, content_html TEXT,
  visibility post_visibility, is_pinned BOOLEAN, is_featured BOOLEAN, is_locked BOOLEAN,
  election_id UUID, published_at TIMESTAMPTZ, edited_at TIMESTAMPTZ,
  like_count INT, comment_count INT, repost_count INT, bookmark_count INT, view_count INT,
  author_id UUID, author_username TEXT, author_full_name TEXT,
  author_avatar TEXT, author_role user_role, author_verified BOOLEAN,
  user_liked BOOLEAN, user_bookmarked BOOLEAN, user_reposted BOOLEAN,
  media JSONB, hashtags TEXT[]
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cursor TIMESTAMPTZ := COALESCE(p_cursor, NOW() + INTERVAL '1 second');
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT sp.*, p.username, p.full_name, p.avatar_path, p.role AS prole, p.is_verified
    FROM social_posts sp
    JOIN profiles p ON p.id = sp.author_id
    WHERE sp.status = 'published'
      AND sp.published_at < v_cursor
      AND (
        p_filter = 'latest'            OR
        (p_filter = 'following'        AND sp.author_id IN (SELECT followee_id FROM follows WHERE follower_id = p_user_id)) OR
        (p_filter = 'election_updates' AND sp.post_type IN ('election_announcement','election_result','candidate_highlight','public_notice')) OR
        p_filter = 'trending'
      )
    ORDER BY
      CASE WHEN p_filter = 'trending'  THEN (sp.like_count + sp.comment_count * 2 + sp.repost_count * 3) ELSE 0 END DESC,
      sp.published_at DESC
    LIMIT p_limit
  )
  SELECT
    b.id, b.post_type, b.title, b.content, b.content_html,
    b.visibility, b.is_pinned, b.is_featured, b.is_locked,
    b.election_id, b.published_at, b.edited_at,
    b.like_count, b.comment_count, b.repost_count, b.bookmark_count, b.view_count,
    b.author_id, b.username, b.full_name, b.avatar_path, b.prole, b.is_verified,
    EXISTS(SELECT 1 FROM post_likes    WHERE post_id = b.id AND user_id = p_user_id),
    EXISTS(SELECT 1 FROM bookmarks     WHERE post_id = b.id AND user_id = p_user_id),
    EXISTS(SELECT 1 FROM reposts       WHERE post_id = b.id AND user_id = p_user_id),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('storage_path',pm.storage_path,'media_type',pm.media_type,'display_order',pm.display_order) ORDER BY pm.display_order) FROM post_media pm WHERE pm.post_id = b.id), '[]'::JSONB),
    COALESCE((SELECT ARRAY_AGG(h.tag) FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id WHERE ph.post_id = b.id), '{}')
  FROM base b;
END; $$;

-- 30i. Get profile page data
CREATE OR REPLACE FUNCTION get_social_profile(p_username TEXT, p_viewer_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB; BEGIN
  SELECT jsonb_build_object(
    'id',               p.id,
    'username',         p.username,
    'full_name',        p.full_name,
    'bio',              p.bio,
    'website',          p.website,
    'location',         p.location,
    'avatar_path',      p.avatar_path,
    'banner_path',      p.banner_path,
    'role',             p.role,
    'is_verified',      p.is_verified,
    'is_suspended',     p.is_suspended,
    'post_count',       p.post_count,
    'follower_count',   p.follower_count,
    'following_count',  p.following_count,
    'joined_at',        p.created_at,
    'is_following',     CASE WHEN p_viewer_id IS NOT NULL THEN
                          EXISTS(SELECT 1 FROM follows WHERE follower_id = p_viewer_id AND followee_id = p.id)
                        ELSE FALSE END
  ) INTO v_result
  FROM profiles p WHERE p.username = p_username;
  RETURN v_result;
END; $$;

-- 30j. Search users / posts / hashtags
CREATE OR REPLACE FUNCTION social_search(p_query TEXT, p_type TEXT DEFAULT 'all', p_limit INT DEFAULT 20)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB; BEGIN
  SELECT jsonb_build_object(
    'users',    CASE WHEN p_type IN ('all','users') THEN
                  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'username',username,'full_name',full_name,'avatar_path',avatar_path,'role',role,'is_verified',is_verified,'follower_count',follower_count))
                   FROM profiles WHERE (username ILIKE '%'||p_query||'%' OR full_name ILIKE '%'||p_query||'%') AND is_suspended = FALSE LIMIT p_limit),'[]'::JSONB) ELSE '[]'::JSONB END,
    'posts',    CASE WHEN p_type IN ('all','posts') THEN
                  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',sp.id,'title',sp.title,'content',sp.content,'published_at',sp.published_at,'like_count',sp.like_count,'author_username',p.username))
                   FROM social_posts sp JOIN profiles p ON p.id=sp.author_id
                   WHERE sp.status='published' AND (sp.title ILIKE '%'||p_query||'%' OR sp.content ILIKE '%'||p_query||'%') LIMIT p_limit),'[]'::JSONB) ELSE '[]'::JSONB END,
    'hashtags', CASE WHEN p_type IN ('all','hashtags') THEN
                  COALESCE((SELECT jsonb_agg(jsonb_build_object('tag',tag,'post_count',post_count)) FROM hashtags WHERE tag ILIKE '%'||p_query||'%' ORDER BY post_count DESC LIMIT p_limit),'[]'::JSONB) ELSE '[]'::JSONB END
  ) INTO v_result;
  RETURN v_result;
END; $$;

-- 30k. Mark all social notifications as read
CREATE OR REPLACE FUNCTION mark_social_notifications_read(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE social_notifications
  SET read_at = NOW()
  WHERE recipient_id = p_user_id AND read_at IS NULL;
END; $$;

-- 30l. Admin: delete post
CREATE OR REPLACE FUNCTION admin_delete_social_post(p_admin_id UUID, p_post_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE social_posts SET status = 'removed' WHERE id = p_post_id;
END; $$;

-- 30m. Admin: suspend user from posting
CREATE OR REPLACE FUNCTION admin_suspend_poster(p_admin_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET is_suspended = TRUE WHERE id = p_user_id;
  UPDATE social_posts SET status = 'removed' WHERE author_id = p_user_id AND status = 'published';
END; $$;

-- 30n. Vote on social poll (one per user)
CREATE OR REPLACE FUNCTION vote_social_poll(p_poll_id UUID, p_option_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM social_polls WHERE id = p_poll_id AND ends_at < NOW()) THEN
    RAISE EXCEPTION 'Poll has ended';
  END IF;
  INSERT INTO social_poll_votes (poll_id, option_id, user_id) VALUES (p_poll_id, p_option_id, p_user_id)
  ON CONFLICT (poll_id, user_id) DO NOTHING;
END; $$;

-- 30o. Create social notification (used by triggers + client)
CREATE OR REPLACE FUNCTION create_social_notification(
  p_recipient  UUID, p_actor UUID, p_type social_notif_type,
  p_post_id UUID DEFAULT NULL, p_comment_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_recipient = p_actor THEN RETURN; END IF;  -- no self-notify
  INSERT INTO social_notifications (recipient_id, actor_id, notif_type, post_id, comment_id)
  VALUES (p_recipient, p_actor, p_type, p_post_id, p_comment_id);
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 31. NOTIFICATION TRIGGER FUNCTIONS (auto-fire on DB events)
-- ─────────────────────────────────────────────────────────────────────────────

-- Notify post author when someone likes their post
CREATE OR REPLACE FUNCTION trg_notify_like()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM social_posts WHERE id = NEW.post_id;
  PERFORM create_social_notification(v_author, NEW.user_id, 'like', NEW.post_id, NULL);
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_like_notif
    AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION trg_notify_like();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notify post author when someone comments
CREATE OR REPLACE FUNCTION trg_notify_comment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM social_posts WHERE id = NEW.post_id;
  IF NEW.parent_id IS NULL THEN
    PERFORM create_social_notification(v_author, NEW.author_id, 'comment', NEW.post_id, NEW.id);
  ELSE
    -- notify parent comment author (reply)
    SELECT author_id INTO v_author FROM post_comments WHERE id = NEW.parent_id;
    PERFORM create_social_notification(v_author, NEW.author_id, 'reply', NEW.post_id, NEW.id);
  END IF;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_comment_notif
    AFTER INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION trg_notify_comment();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notify when someone follows
CREATE OR REPLACE FUNCTION trg_notify_follow()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM create_social_notification(NEW.followee_id, NEW.follower_id, 'follow', NULL, NULL);
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_follow_notif
    AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION trg_notify_follow();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notify when someone reposts
CREATE OR REPLACE FUNCTION trg_notify_repost()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_author UUID;
BEGIN
  SELECT author_id INTO v_author FROM social_posts WHERE id = NEW.post_id;
  PERFORM create_social_notification(v_author, NEW.user_id, 'repost', NEW.post_id, NULL);
  RETURN NULL;
END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_repost_notif
    AFTER INSERT ON reposts FOR EACH ROW EXECUTE FUNCTION trg_notify_repost();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 32. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE social_posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media              ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtags                ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_hashtags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_views              ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_polls            ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_poll_options     ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_poll_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reports            ENABLE ROW LEVEL SECURITY;

-- ── social_posts ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "social_posts_select" ON social_posts;
CREATE POLICY "social_posts_select" ON social_posts FOR SELECT
  USING (
    status = 'published' AND (
      visibility = 'public' OR
      author_id = auth.uid() OR
      (visibility = 'followers' AND EXISTS (
        SELECT 1 FROM follows WHERE follower_id = auth.uid() AND followee_id = author_id
      )) OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "social_posts_insert" ON social_posts;
CREATE POLICY "social_posts_insert" ON social_posts FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_suspended = TRUE)
  );

DROP POLICY IF EXISTS "social_posts_update" ON social_posts;
CREATE POLICY "social_posts_update" ON social_posts FOR UPDATE
  USING (
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "social_posts_delete" ON social_posts;
CREATE POLICY "social_posts_delete" ON social_posts FOR DELETE
  USING (
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── post_media ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "post_media_select" ON post_media;
CREATE POLICY "post_media_select" ON post_media FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "post_media_insert" ON post_media;
CREATE POLICY "post_media_insert" ON post_media FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM social_posts WHERE id = post_id AND author_id = auth.uid()));

DROP POLICY IF EXISTS "post_media_delete" ON post_media;
CREATE POLICY "post_media_delete" ON post_media FOR DELETE
  USING (EXISTS (SELECT 1 FROM social_posts WHERE id = post_id AND author_id = auth.uid()));

-- ── draft_posts ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "drafts_all" ON draft_posts;
CREATE POLICY "drafts_all" ON draft_posts FOR ALL USING (author_id = auth.uid());

-- ── post_likes ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "likes_select" ON post_likes;
CREATE POLICY "likes_select" ON post_likes FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "likes_insert" ON post_likes;
CREATE POLICY "likes_insert" ON post_likes FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "likes_delete" ON post_likes;
CREATE POLICY "likes_delete" ON post_likes FOR DELETE USING (user_id = auth.uid());

-- ── post_comments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "comments_select" ON post_comments;
CREATE POLICY "comments_select" ON post_comments FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "comments_insert" ON post_comments;
CREATE POLICY "comments_insert" ON post_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_suspended = TRUE) AND
    NOT EXISTS (SELECT 1 FROM social_posts WHERE id = post_id AND is_locked = TRUE)
  );

DROP POLICY IF EXISTS "comments_update" ON post_comments;
CREATE POLICY "comments_update" ON post_comments FOR UPDATE
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "comments_delete" ON post_comments;
CREATE POLICY "comments_delete" ON post_comments FOR DELETE
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ── comment_likes ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clikes_all" ON comment_likes;
CREATE POLICY "clikes_all" ON comment_likes FOR ALL USING (user_id = auth.uid());

-- ── reposts ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reposts_select" ON reposts;
CREATE POLICY "reposts_select" ON reposts FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "reposts_insert" ON reposts;
CREATE POLICY "reposts_insert" ON reposts FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "reposts_delete" ON reposts;
CREATE POLICY "reposts_delete" ON reposts FOR DELETE USING (user_id = auth.uid());

-- ── bookmarks ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bookmarks_all" ON bookmarks;
CREATE POLICY "bookmarks_all" ON bookmarks FOR ALL USING (user_id = auth.uid());

-- ── follows ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "follows_select" ON follows;
CREATE POLICY "follows_select" ON follows FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "follows_insert" ON follows;
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS "follows_delete" ON follows;
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (follower_id = auth.uid());

-- ── hashtags / post_hashtags ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "hashtags_select" ON hashtags;
CREATE POLICY "hashtags_select" ON hashtags FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "hashtags_insert" ON hashtags;
CREATE POLICY "hashtags_insert" ON hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "post_hashtags_select" ON post_hashtags;
CREATE POLICY "post_hashtags_select" ON post_hashtags FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "post_hashtags_insert" ON post_hashtags;
CREATE POLICY "post_hashtags_insert" ON post_hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── mentions ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "mentions_select" ON mentions;
CREATE POLICY "mentions_select" ON mentions FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "mentions_insert" ON mentions;
CREATE POLICY "mentions_insert" ON mentions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── post_views ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "views_all" ON post_views;
CREATE POLICY "views_all" ON post_views FOR ALL USING (TRUE);

-- ── polls ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "polls_select" ON social_polls;
CREATE POLICY "polls_select" ON social_polls FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "poll_opts_select" ON social_poll_options;
CREATE POLICY "poll_opts_select" ON social_poll_options FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "poll_votes_all" ON social_poll_votes;
CREATE POLICY "poll_votes_all" ON social_poll_votes FOR ALL USING (user_id = auth.uid());

-- ── social_notifications ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "snotif_all" ON social_notifications;
CREATE POLICY "snotif_all" ON social_notifications FOR ALL USING (recipient_id = auth.uid());

-- ── post_reports ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reports_insert" ON post_reports;
CREATE POLICY "reports_insert" ON post_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "reports_select_admin" ON post_reports;
CREATE POLICY "reports_select_admin" ON post_reports FOR SELECT
  USING (reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 33. STORAGE BUCKETS (run once — idempotent via DO block)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('post-images', 'post-images', TRUE,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('post-pdfs',   'post-pdfs',   FALSE, 20971520, ARRAY['application/pdf']),
  ('avatars',     'avatars',     TRUE,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('banners',     'banners',     TRUE,  10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "post-images-public-read" ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images') ;

CREATE POLICY "post-images-auth-upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "post-images-owner-delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'post-images' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

CREATE POLICY "post-pdfs-auth-read" ON storage.objects FOR SELECT
  USING (bucket_id = 'post-pdfs' AND auth.uid() IS NOT NULL);

CREATE POLICY "post-pdfs-auth-upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-pdfs' AND auth.uid() IS NOT NULL);

CREATE POLICY "avatars-public-read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars-owner-upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "avatars-owner-update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "banners-public-read" ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "banners-owner-upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'banners' AND auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 34. REALTIME PUBLICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE reposts;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;
ALTER PUBLICATION supabase_realtime ADD TABLE social_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE social_poll_votes;

-- =============================================================================
-- END OF SOCIAL MEDIA MIGRATION
-- =============================================================================
