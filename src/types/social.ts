import type { UserRole } from './database'

export type FeedFilter = 'latest' | 'trending' | 'following' | 'election_updates' | 'most_liked'

export type PostType =
  | 'text' | 'image' | 'multi_image' | 'pdf'
  | 'election_announcement' | 'poll' | 'election_result'
  | 'candidate_highlight' | 'event' | 'public_notice'

export type PostVisibility = 'public' | 'followers' | 'private'
export type PostStatus     = 'published' | 'draft' | 'scheduled' | 'removed'

export type SocialPost = {
  id:             string
  post_type:      PostType
  status:         PostStatus
  visibility:     PostVisibility
  title:          string | null
  content:        string | null
  content_html:   string | null
  is_pinned:      boolean
  is_featured:    boolean
  is_locked:      boolean
  election_id:    string | null
  scheduled_at:   string | null
  published_at:   string
  edited_at:      string | null
  like_count:     number
  comment_count:  number
  repost_count:   number
  share_count:    number
  bookmark_count: number
  view_count:     number
  created_at:     string
  updated_at:     string
  // joined author
  author_id:       string
  author_username: string
  author_full_name: string | null
  author_avatar:   string | null
  author_role:     UserRole
  author_verified: boolean
  author_suspended?: boolean
  // client-side state (from get_social_feed)
  user_liked?:      boolean
  user_bookmarked?: boolean
  user_reposted?:   boolean
  // joined media
  media?:    PostMedia[]
  hashtags?: string[]
  // nested from .select() queries
  profiles?: {
    id: string; username: string; full_name: string | null
    avatar_path: string | null; role: UserRole; is_verified: boolean
  }
}

export type PostMedia = {
  id:            string
  post_id:       string
  media_type:    'image' | 'pdf'
  storage_path:  string
  file_name:     string | null
  file_size:     number | null
  mime_type:     string | null
  width:         number | null
  height:        number | null
  display_order: number
  created_at:    string
}

export type SocialComment = {
  id:          string
  post_id:     string
  author_id:   string
  parent_id:   string | null
  content:     string
  edited_at:   string | null
  like_count:  number
  reply_count: number
  created_at:  string
  updated_at:  string
  // joined
  profiles?: {
    id: string; username: string; full_name: string | null
    avatar_path: string | null; role: UserRole; is_verified: boolean
  }
  // client
  user_liked?: boolean
  replies?:    SocialComment[]
}

export type SocialProfile = {
  id:              string
  username:        string
  full_name:       string | null
  bio:             string | null
  website:         string | null
  location:        string | null
  avatar_path:     string | null
  banner_path:     string | null
  role:            UserRole
  is_verified:     boolean
  is_suspended:    boolean
  post_count:      number
  follower_count:  number
  following_count: number
  joined_at?:      string
  is_following?:   boolean
}

export type SocialNotification = {
  id:           string
  recipient_id: string
  actor_id:     string | null
  notif_type:   'like' | 'comment' | 'reply' | 'mention' | 'follow' | 'repost' |
                'election_invite' | 'election_started' | 'election_ended' | 'result_published'
  post_id:      string | null
  comment_id:   string | null
  read_at:      string | null
  created_at:   string
  actor?: {
    id: string; username: string; full_name: string | null; avatar_path: string | null; role: UserRole
  }
}

export type SocialPoll = {
  id:           string
  post_id:      string
  question:     string
  ends_at:      string
  total_votes:  number
  created_at:   string
  options?:     SocialPollOption[]
}

export type SocialPollOption = {
  id:            string
  poll_id:       string
  label:         string
  vote_count:    number
  display_order: number
}

export type PostReport = {
  id:          string
  post_id:     string
  reporter_id: string
  reason:      'spam' | 'fake' | 'harassment' | 'violence' | 'other'
  details:     string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at:  string
}
