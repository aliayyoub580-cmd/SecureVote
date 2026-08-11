import * as React from 'react'
import { supabase }                from '@/lib/supabase/client'
import { socialFeedService, socialInteractionsService, formatSocialPost } from '@/services/social.service'
import type { SocialPost, FeedFilter } from '@/types/social'

/**
 * useSocialFeed
 * Works for both authenticated users (userId provided) and guests (userId = undefined).
 * When userId is undefined the feed still loads public posts; interaction helpers
 * are no-ops (the caller is expected to show an auth-guard modal instead).
 */
export function useSocialFeed(userId: string | undefined, filter: FeedFilter = 'latest', myPostsOnly = false) {
  const [posts,   setPosts]   = React.useState<SocialPost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [cursor,  setCursor]  = React.useState<string | undefined>()
  const [hasMore, setHasMore] = React.useState(true)

  const fetchPage = React.useCallback(async (reset = false) => {
    setLoading(true)
    try {
      const isMyPosts = myPostsOnly || filter === 'my_posts'
      // ── "My Posts" view: needs an authenticated user ──────────────────────
      if (isMyPosts && userId) {
        let q = supabase
          .from('social_posts')
          .select(`
            *,
            profiles!author_id(id,username,full_name,avatar_path,role,is_verified),
            post_media(id,storage_path,media_type,file_name,file_size,mime_type,display_order)
          `)
          .eq('author_id', userId)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(20)
        if (!reset && cursor) q = q.lt('published_at', cursor)

        const { data, error } = await q
        if (error) throw error
        const rawPosts = data ?? []

        // Fetch interaction state for the logged-in user
        const postIds = rawPosts.map(p => p.id)
        let liked = new Set<string>()
        let bookmarked = new Set<string>()
        if (postIds.length > 0) {
          const [l, b] = await Promise.all([
            supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
            supabase.from('bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds),
          ])
          if (l.data) liked      = new Set(l.data.map((r: any) => r.post_id))
          if (b.data) bookmarked = new Set(b.data.map((r: any) => r.post_id))
        }

        const formatted = rawPosts.map(p => formatSocialPost({
          ...p,
          user_liked:      liked.has(p.id),
          user_bookmarked: bookmarked.has(p.id),
        }))

        setPosts(prev => reset ? formatted : [...prev, ...formatted])
        if (formatted.length) setCursor(formatted[formatted.length - 1].published_at)
        setHasMore(formatted.length === 20)
        return
      }

      // ── Public / community feed ───────────────────────────────────────────
      if (userId) {
        // Authenticated: use the RPC which includes user_liked/bookmarked
        const page = await socialFeedService.getFeed(userId, filter, reset ? undefined : cursor)
        const formatted = page.map(formatSocialPost)
        setPosts(prev => reset ? formatted : [...prev, ...formatted])
        if (formatted.length) setCursor(formatted[formatted.length - 1].published_at)
        setHasMore(formatted.length === 20)
      } else {
        // Guest: query public posts directly including post_media
        let q = supabase
          .from('social_posts')
          .select(`
            *,
            profiles!author_id(id,username,full_name,avatar_path,role,is_verified,is_suspended),
            post_media(id,storage_path,media_type,file_name,file_size,mime_type,display_order)
          `)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .order('published_at', { ascending: false })
          .limit(20)
        if (!reset && cursor) q = q.lt('published_at', cursor)

        const { data, error } = await q
        if (error) throw error
        const rawPosts = (data ?? []).map(formatSocialPost)

        setPosts(prev => reset ? rawPosts : [...prev, ...rawPosts])
        if (rawPosts.length) setCursor(rawPosts[rawPosts.length - 1].published_at)
        setHasMore(rawPosts.length === 20)
      }
    } catch (err) {
      console.error('[useSocialFeed]', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, myPostsOnly, cursor])

  // Reset and re-fetch when dependencies (filter / userId / myPostsOnly) change
  React.useEffect(() => {
    setCursor(undefined)
    setPosts([])
    setHasMore(true)
    void (async () => {
      setLoading(true)
      try {
        const isMyPosts = myPostsOnly || filter === 'my_posts'
        if (isMyPosts && userId) {
          const { data } = await supabase
            .from('social_posts')
            .select(`
              *,
              profiles!author_id(id,username,full_name,avatar_path,role,is_verified),
              post_media(id,storage_path,media_type,file_name,file_size,mime_type,display_order)
            `)
            .eq('author_id', userId)
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(20)
          const rawPosts = data ?? []
          const postIds  = rawPosts.map(p => p.id)
          let liked = new Set<string>(); let bookmarked = new Set<string>()
          if (postIds.length) {
            const [l, b] = await Promise.all([
              supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
              supabase.from('bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds),
            ])
            if (l.data) liked      = new Set(l.data.map((r: any) => r.post_id))
            if (b.data) bookmarked = new Set(b.data.map((r: any) => r.post_id))
          }
          const formatted = rawPosts.map(p => formatSocialPost({ ...p, user_liked: liked.has(p.id), user_bookmarked: bookmarked.has(p.id) }))
          setPosts(formatted)
          if (formatted.length) setCursor(formatted[formatted.length - 1].published_at)
          setHasMore(formatted.length === 20)
        } else if (userId) {
          const page = await socialFeedService.getFeed(userId, filter, undefined)
          const formatted = page.map(formatSocialPost)
          setPosts(formatted)
          if (formatted.length) setCursor(formatted[formatted.length - 1].published_at)
          setHasMore(formatted.length === 20)
        } else {
          // Guest
          const { data } = await supabase
            .from('social_posts')
            .select(`
              *,
              profiles!author_id(id,username,full_name,avatar_path,role,is_verified,is_suspended),
              post_media(id,storage_path,media_type,file_name,file_size,mime_type,display_order)
            `)
            .eq('status', 'published')
            .eq('visibility', 'public')
            .order('published_at', { ascending: false })
            .limit(20)
          const rawPosts = (data ?? []).map(formatSocialPost)
          setPosts(rawPosts)
          if (rawPosts.length) setCursor(rawPosts[rawPosts.length - 1].published_at)
          setHasMore(rawPosts.length === 20)
        }
      } finally {
        setLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, myPostsOnly])

  // Realtime: new published posts
  React.useEffect(() => {
    const channel = supabase
      .channel('social-feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_posts' }, (payload) => {
        const post = payload.new as SocialPost
        if (post.status === 'published' && post.visibility === 'public') {
          if (!myPostsOnly || post.author_id === userId) {
            setPosts(prev => [post, ...prev])
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'social_posts' }, (payload) => {
        const updated = payload.new as SocialPost
        setPosts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, myPostsOnly])

  // Optimistic interactions — only run if userId is defined; callers guard before calling
  const optimisticLike = React.useCallback(async (postId: string) => {
    if (!userId) return
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, user_liked: !p.user_liked, like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1 }
        : p
    ))
    try {
      await socialInteractionsService.toggleLike(postId, userId)
    } catch {
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, user_liked: !p.user_liked, like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1 }
          : p
      ))
    }
  }, [userId])

  const optimisticBookmark = React.useCallback(async (postId: string) => {
    if (!userId) return
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, user_bookmarked: !p.user_bookmarked } : p
    ))
    try {
      await socialInteractionsService.toggleBookmark(postId, userId)
    } catch {
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, user_bookmarked: !p.user_bookmarked } : p
      ))
    }
  }, [userId])

  return {
    posts, loading, hasMore,
    loadMore: () => fetchPage(false),
    refresh:  () => {
      setCursor(undefined)
      setPosts([])
      setHasMore(true)
      void fetchPage(true)
    },
    optimisticLike,
    optimisticBookmark,
  }
}
