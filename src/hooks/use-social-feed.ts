import * as React from 'react'
import { supabase } from '@/lib/supabase/client'
import { socialFeedService, socialInteractionsService } from '@/services/social.service'
import type { SocialPost, FeedFilter } from '@/types/social'

export function useSocialFeed(userId: string | undefined, filter: FeedFilter = 'latest', myPostsOnly = false) {
  const [posts,   setPosts]   = React.useState<SocialPost[]>([])
  const [loading, setLoading] = React.useState(true)
  const [cursor,  setCursor]  = React.useState<string | undefined>()
  const [hasMore, setHasMore] = React.useState(true)

  const fetchPage = React.useCallback(async (reset = false) => {
    if (!userId) return
    setLoading(true)
    try {
      if (myPostsOnly) {
        let q = supabase
          .from('social_posts')
          .select(`*, profiles!author_id(id,username,full_name,avatar_path,role,is_verified)`)
          .eq('author_id', userId)
          .order('published_at', { ascending: false })
          .limit(20)

        if (!reset && cursor) q = q.lt('published_at', cursor)
        const { data, error } = await q
        if (error) throw error

        const rawPosts = data ?? []
        const postIds = rawPosts.map(p => p.id)
        let userLikes = new Set<string>()
        let userBookmarks = new Set<string>()

        if (postIds.length > 0) {
          const [likesRes, bmRes] = await Promise.all([
            supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
            supabase.from('bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds),
          ])
          if (likesRes.data) userLikes = new Set(likesRes.data.map(l => l.post_id))
          if (bmRes.data) userBookmarks = new Set(bmRes.data.map(b => b.post_id))
        }

        const formatted = rawPosts.map(p => ({
          ...p,
          user_liked: userLikes.has(p.id),
          user_bookmarked: userBookmarks.has(p.id),
        })) as SocialPost[]

        setPosts(prev => reset ? formatted : [...prev, ...formatted])
        if (formatted.length > 0) setCursor(formatted[formatted.length - 1].published_at)
        setHasMore(formatted.length === 20)
        return
      }

      const page = await socialFeedService.getFeed(userId, filter, reset ? undefined : cursor)
      setPosts(prev => reset ? page : [...prev, ...page])
      if (page.length > 0) setCursor(page[page.length - 1].published_at)
      setHasMore(page.length === 20)
    } finally {
      setLoading(false)
    }
  }, [userId, filter, cursor, myPostsOnly])

  // initial load + reset when filter or myPostsOnly changes
  React.useEffect(() => {
    setCursor(undefined)
    setPosts([])
    setHasMore(true)
    if (userId) void fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, myPostsOnly])

  // Realtime: prepend new published posts (only if author matches when myPostsOnly is true)
  React.useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('social-feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_posts' },
        (payload) => {
          const post = payload.new as SocialPost
          if (post.status === 'published') {
            if (!myPostsOnly || post.author_id === userId) {
              setPosts(prev => [post, ...prev])
            }
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'social_posts' },
        (payload) => {
          const updated = payload.new as SocialPost
          setPosts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, myPostsOnly])

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
    refresh:  () => fetchPage(true),
    optimisticLike,
    optimisticBookmark,
  }
}
