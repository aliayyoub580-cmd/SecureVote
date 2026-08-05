import * as React from 'react'
import { supabase } from '@/lib/supabase/client'
import { socialCommentsService } from '@/services/social.service'
import type { SocialComment } from '@/types/social'

export function useSocialComments(postId: string, userId?: string) {
  const [comments, setComments] = React.useState<SocialComment[]>([])
  const [loading,  setLoading]  = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await socialCommentsService.getComments(postId)
      setComments(data)
    } finally {
      setLoading(false)
    }
  }, [postId])

  React.useEffect(() => { void load() }, [load])

  // Realtime inserts
  React.useEffect(() => {
    const channel = supabase
      .channel(`comments-${postId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'post_comments',
        filter: `post_id=eq.${postId}`,
      }, (payload) => {
        const c = payload.new as SocialComment
        if (!c.parent_id) {
          setComments(prev => [...prev, c])
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'post_comments',
        filter: `post_id=eq.${postId}`,
      }, (payload) => {
        const c = payload.new as SocialComment
        setComments(prev => prev.map(x => x.id === c.id ? { ...x, ...c } : x))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'post_comments',
        filter: `post_id=eq.${postId}`,
      }, (payload) => {
        setComments(prev => prev.filter(x => x.id !== payload.old.id))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [postId])

  const addComment = React.useCallback(async (content: string, parentId?: string) => {
    if (!userId) return
    const comment = await socialCommentsService.addComment(postId, userId, content, parentId)
    if (!parentId) setComments(prev => [...prev, comment])
  }, [postId, userId])

  const deleteComment = React.useCallback(async (id: string) => {
    await socialCommentsService.deleteComment(id)
    setComments(prev => prev.filter(c => c.id !== id))
  }, [])

  const toggleLike = React.useCallback(async (commentId: string) => {
    if (!userId) return
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, user_liked: !c.user_liked, like_count: c.user_liked ? c.like_count - 1 : c.like_count + 1 }
        : c
    ))
    await socialCommentsService.toggleCommentLike(commentId, userId)
  }, [userId])

  return { comments, loading, addComment, deleteComment, toggleLike, refresh: load }
}
