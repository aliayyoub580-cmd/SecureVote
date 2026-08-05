import { supabase } from '@/lib/supabase/client'
import type { SocialPost, SocialProfile, SocialComment, SocialNotification, SocialPoll, FeedFilter } from '@/types/social'

// ─── Feed ────────────────────────────────────────────────────────────────────

export const socialFeedService = {
  async getFeed(userId: string, filter: FeedFilter = 'latest', cursor?: string, limit = 20): Promise<SocialPost[]> {
    const { data, error } = await supabase.rpc('get_social_feed', {
      p_user_id: userId,
      p_filter: filter,
      p_cursor: cursor ?? null,
      p_limit: limit,
    })
    if (error) throw error
    return (data ?? []) as SocialPost[]
  },
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export const socialPostsService = {
  async create(payload: {
    authorId: string
    postType: SocialPost['post_type']
    title?: string
    content?: string
    contentHtml?: string
    visibility?: SocialPost['visibility']
    electionId?: string
    hashtags?: string[]
    status?: 'published' | 'draft'
  }): Promise<string> {
    const { data, error } = await supabase.rpc('create_social_post', {
      p_author_id:    payload.authorId,
      p_post_type:    payload.postType,
      p_title:        payload.title ?? null,
      p_content:      payload.content ?? null,
      p_content_html: payload.contentHtml ?? null,
      p_visibility:   payload.visibility ?? 'public',
      p_election_id:  payload.electionId ?? null,
      p_hashtags:     payload.hashtags ?? [],
      p_status:       payload.status ?? 'published',
    })
    if (error) throw error
    return data as string
  },

  async getById(id: string): Promise<SocialPost | null> {
    const { data, error } = await supabase
      .from('social_posts')
      .select(`*, profiles!author_id(id,username,full_name,avatar_path,role,is_verified,is_suspended)`)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle()
    if (error) throw error
    return data as SocialPost | null
  },

  async getByUsername(username: string, cursor?: string, limit = 20): Promise<SocialPost[]> {
    let q = supabase
      .from('social_posts')
      .select(`*, profiles!author_id(id,username,full_name,avatar_path,role,is_verified)`)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit)

    // join by username sub-select
    const { data: profile } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
    if (!profile) return []
    q = q.eq('author_id', profile.id)
    if (cursor) q = q.lt('published_at', cursor)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as SocialPost[]
  },

  async update(id: string, patch: { title?: string; content?: string; contentHtml?: string; visibility?: string }) {
    const { error } = await supabase.from('social_posts').update({
      title:        patch.title,
      content:      patch.content,
      content_html: patch.contentHtml,
      visibility:   patch.visibility as any,
      edited_at:    new Date().toISOString(),
    }).eq('id', id)
    if (error) throw error
  },

  async delete(id: string) {
    const { error } = await supabase.from('social_posts').delete().eq('id', id)
    if (error) throw error
  },

  async pin(id: string, pin: boolean) {
    const { error } = await supabase.from('social_posts').update({ is_pinned: pin }).eq('id', id)
    if (error) throw error
  },

  async lockComments(id: string, lock: boolean) {
    const { error } = await supabase.from('social_posts').update({ is_locked: lock }).eq('id', id)
    if (error) throw error
  },

  async recordView(postId: string, userId?: string) {
    await supabase.rpc('record_post_view', { p_post_id: postId, p_user_id: userId ?? null, p_ip_hash: null })
  },
}

// ─── Interactions ─────────────────────────────────────────────────────────────

export const socialInteractionsService = {
  async toggleLike(postId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('toggle_post_like', { p_post_id: postId, p_user_id: userId })
    if (error) throw error
    return data as boolean
  },

  async toggleBookmark(postId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('toggle_bookmark', { p_post_id: postId, p_user_id: userId })
    if (error) throw error
    return data as boolean
  },

  async toggleRepost(postId: string, userId: string, quoteText?: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('toggle_repost', {
      p_post_id: postId,
      p_user_id: userId,
      p_quote:   quoteText ?? null,
    })
    if (error) throw error
    return data as boolean
  },

  async toggleFollow(followerId: string, followeeId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('toggle_follow', { p_follower: followerId, p_followee: followeeId })
    if (error) throw error
    return data as boolean
  },

  async reportPost(postId: string, reporterId: string, reason: string, details?: string) {
    const { error } = await supabase.from('post_reports').insert({
      post_id: postId, reporter_id: reporterId, reason: reason as any, details: details ?? null,
    })
    if (error) throw error
  },

  async getPostInteractionState(postId: string, userId: string) {
    const [likes, bookmarks, reposts] = await Promise.all([
      supabase.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
      supabase.from('bookmarks').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
      supabase.from('reposts').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
    ])
    return {
      liked:      Boolean(likes.data),
      bookmarked: Boolean(bookmarks.data),
      reposted:   Boolean(reposts.data),
    }
  },
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export const socialCommentsService = {
  async getComments(postId: string, cursor?: string, limit = 20): Promise<SocialComment[]> {
    let q = supabase
      .from('post_comments')
      .select(`*, profiles!author_id(id,username,full_name,avatar_path,role,is_verified)`)
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (cursor) q = q.gt('created_at', cursor)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as SocialComment[]
  },

  async getReplies(parentId: string): Promise<SocialComment[]> {
    const { data, error } = await supabase
      .from('post_comments')
      .select(`*, profiles!author_id(id,username,full_name,avatar_path,role,is_verified)`)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as SocialComment[]
  },

  async addComment(postId: string, authorId: string, content: string, parentId?: string): Promise<SocialComment> {
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, author_id: authorId, content, parent_id: parentId ?? null })
      .select(`*, profiles!author_id(id,username,full_name,avatar_path,role,is_verified)`)
      .single()
    if (error) throw error
    return data as SocialComment
  },

  async updateComment(id: string, content: string) {
    const { error } = await supabase.from('post_comments')
      .update({ content, edited_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },

  async deleteComment(id: string) {
    const { error } = await supabase.from('post_comments').delete().eq('id', id)
    if (error) throw error
  },

  async toggleCommentLike(commentId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('toggle_comment_like', { p_comment_id: commentId, p_user_id: userId })
    if (error) throw error
    return data as boolean
  },
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export const socialProfilesService = {
  async getByUsername(username: string, viewerId?: string): Promise<SocialProfile | null> {
    const { data, error } = await supabase.rpc('get_social_profile', {
      p_username:  username,
      p_viewer_id: viewerId ?? null,
    })
    if (error) throw error
    return data as SocialProfile | null
  },

  async updateProfile(userId: string, patch: {
    username?: string; bio?: string; website?: string; location?: string
  }) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) throw error
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const ext  = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_path: data.publicUrl }).eq('id', userId)
    return data.publicUrl
  },

  async uploadBanner(userId: string, file: File): Promise<string> {
    const ext  = file.name.split('.').pop()
    const path = `${userId}/banner.${ext}`
    const { error } = await supabase.storage.from('banners').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('banners').getPublicUrl(path)
    await supabase.from('profiles').update({ banner_path: data.publicUrl }).eq('id', userId)
    return data.publicUrl
  },

  async getFollowers(userId: string): Promise<SocialProfile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('profiles!follower_id(id,username,full_name,avatar_path,role,is_verified,follower_count,following_count)')
      .eq('followee_id', userId)
    if (error) throw error
    return (data?.map((r: any) => r.profiles) ?? []) as SocialProfile[]
  },

  async getFollowing(userId: string): Promise<SocialProfile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('profiles!followee_id(id,username,full_name,avatar_path,role,is_verified,follower_count,following_count)')
      .eq('follower_id', userId)
    if (error) throw error
    return (data?.map((r: any) => r.profiles) ?? []) as SocialProfile[]
  },
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export const socialBookmarksService = {
  async getBookmarks(userId: string, cursor?: string, limit = 20): Promise<SocialPost[]> {
    let q = supabase
      .from('bookmarks')
      .select(`social_posts(*, profiles!author_id(id,username,full_name,avatar_path,role,is_verified))`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (cursor) q = q.lt('created_at', cursor)
    const { data, error } = await q
    if (error) throw error
    return (data?.map((r: any) => r.social_posts).filter(Boolean) ?? []) as SocialPost[]
  },
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const socialNotificationsService = {
  async getNotifications(userId: string, limit = 30): Promise<SocialNotification[]> {
    const { data, error } = await supabase
      .from('social_notifications')
      .select(`*, actor:profiles!actor_id(id,username,full_name,avatar_path,role)`)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as SocialNotification[]
  },

  async markAllRead(userId: string) {
    await supabase.rpc('mark_social_notifications_read', { p_user_id: userId })
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('social_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null)
    return count ?? 0
  },
}

// ─── Search ───────────────────────────────────────────────────────────────────

export const socialSearchService = {
  async search(query: string, type: 'all' | 'users' | 'posts' | 'hashtags' = 'all') {
    const { data, error } = await supabase.rpc('social_search', {
      p_query: query, p_type: type, p_limit: 20,
    })
    if (error) throw error
    return data as { users: SocialProfile[]; posts: SocialPost[]; hashtags: { tag: string; post_count: number }[] }
  },

  async getPostsByHashtag(tag: string, cursor?: string, limit = 20): Promise<SocialPost[]> {
    const { data: hashRow } = await supabase.from('hashtags').select('id').eq('tag', tag.toLowerCase()).maybeSingle()
    if (!hashRow) return []
    const { data: ph } = await supabase.from('post_hashtags').select('post_id').eq('hashtag_id', hashRow.id)
    const ids = ph?.map((r: any) => r.post_id) ?? []
    if (!ids.length) return []
    let q = supabase
      .from('social_posts')
      .select(`*, profiles!author_id(id,username,full_name,avatar_path,role,is_verified)`)
      .in('id', ids)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit)
    if (cursor) q = q.lt('published_at', cursor)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as SocialPost[]
  },

  async getTrendingHashtags() {
    const { data, error } = await supabase.from('hashtags').select('tag,post_count').order('post_count', { ascending: false }).limit(20)
    if (error) throw error
    return data ?? []
  },
}

// ─── Media ────────────────────────────────────────────────────────────────────

export const socialMediaService = {
  async uploadPostImage(userId: string, postId: string, file: File, order: number): Promise<string> {
    const ext  = file.name.split('.').pop()
    const path = `${userId}/${postId}/${Date.now()}_${order}.${ext}`
    const { error } = await supabase.storage.from('post-images').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('post-images').getPublicUrl(path)
    await supabase.from('post_media').insert({
      post_id: postId, media_type: 'image', storage_path: path,
      file_name: file.name, file_size: file.size, mime_type: file.type, display_order: order,
    })
    return data.publicUrl
  },

  async uploadPostPdf(userId: string, postId: string, file: File): Promise<string> {
    const path = `${userId}/${postId}/${file.name}`
    const { error } = await supabase.storage.from('post-pdfs').upload(path, file)
    if (error) throw error
    await supabase.from('post_media').insert({
      post_id: postId, media_type: 'pdf', storage_path: path,
      file_name: file.name, file_size: file.size, mime_type: 'application/pdf', display_order: 0,
    })
    return path
  },

  getImageUrl(path: string): string {
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  },
}

// ─── Drafts ───────────────────────────────────────────────────────────────────

export const socialDraftsService = {
  async saveDraft(authorId: string, draft: {
    postType?: string; title?: string; content?: string; contentHtml?: string; hashtags?: string[]
  }): Promise<string> {
    const { data, error } = await supabase
      .from('draft_posts')
      .insert({ author_id: authorId, post_type: (draft.postType ?? 'text') as any, title: draft.title, content: draft.content, content_html: draft.contentHtml, hashtags: draft.hashtags ?? [] })
      .select('id').single()
    if (error) throw error
    return data.id
  },

  async updateDraft(id: string, draft: { title?: string; content?: string; contentHtml?: string; hashtags?: string[] }) {
    const { error } = await supabase.from('draft_posts').update({ ...draft, content_html: draft.contentHtml, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },

  async listDrafts(authorId: string) {
    const { data, error } = await supabase
      .from('draft_posts')
      .select('*')
      .eq('author_id', authorId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async deleteDraft(id: string) {
    const { error } = await supabase.from('draft_posts').delete().eq('id', id)
    if (error) throw error
  },
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const socialAdminService = {
  async deletePost(adminId: string, postId: string) {
    await supabase.rpc('admin_delete_social_post', { p_admin_id: adminId, p_post_id: postId })
  },

  async suspendPoster(adminId: string, userId: string) {
    await supabase.rpc('admin_suspend_poster', { p_admin_id: adminId, p_user_id: userId })
  },

  async getPendingReports() {
    const { data, error } = await supabase
      .from('post_reports')
      .select(`*, reporter:profiles!reporter_id(username,full_name), post:social_posts!post_id(title,content,author_id)`)
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async resolveReport(reportId: string, adminId: string) {
    const { error } = await supabase.from('post_reports').update({ resolved_at: new Date().toISOString(), resolved_by: adminId }).eq('id', reportId)
    if (error) throw error
  },

  async featurePost(postId: string, featured: boolean) {
    const { error } = await supabase.from('social_posts').update({ is_featured: featured }).eq('id', postId)
    if (error) throw error
  },
}

// ─── Polls ────────────────────────────────────────────────────────────────────

export const socialPollsService = {
  async createPoll(postId: string, question: string, options: string[], endsAt: string): Promise<SocialPoll> {
    const { data, error } = await supabase
      .from('social_polls')
      .insert({ post_id: postId, question, ends_at: endsAt })
      .select('*')
      .single()
    if (error) throw error
    const opts = options.map((label, i) => ({ poll_id: data.id, label, display_order: i }))
    await supabase.from('social_poll_options').insert(opts)
    return data as SocialPoll
  },

  async getPollWithOptions(postId: string, userId?: string) {
    const { data: poll, error } = await supabase
      .from('social_polls')
      .select(`*, social_poll_options(*)`)
      .eq('post_id', postId)
      .maybeSingle()
    if (error) throw error
    let userVote: string | null = null
    if (userId && poll) {
      const { data: v } = await supabase.from('social_poll_votes').select('option_id').eq('poll_id', poll.id).eq('user_id', userId).maybeSingle()
      userVote = v?.option_id ?? null
    }
    return { poll, userVote }
  },

  async vote(pollId: string, optionId: string, userId: string) {
    await supabase.rpc('vote_social_poll', { p_poll_id: pollId, p_option_id: optionId, p_user_id: userId })
  },
}
