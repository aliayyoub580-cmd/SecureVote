import * as React from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft }       from 'lucide-react'
import { motion }          from 'framer-motion'

import { PostCard }          from '@/components/social/post-card'
import { CommentThread }     from '@/components/social/comment-thread'
import { AuthGuardModal, useAuthGuard } from '@/components/social/auth-guard-modal'
import { useAuth }           from '@/contexts/auth-context'
import { socialPostsService, socialInteractionsService } from '@/services/social.service'
import type { SocialPost }   from '@/types/social'

export function SocialPostDetailPage() {
  const { id }            = useParams<{ id: string }>()
  const { user }          = useAuth()
  const { guard, modalOpen, modalAction, closeModal } = useAuthGuard(user?.id)

  const [post,      setPost]      = React.useState<SocialPost | null>(null)
  const [loading,   setLoading]   = React.useState(true)
  const [liked,     setLiked]     = React.useState(false)
  const [bookmarked,setBookmarked]= React.useState(false)

  // Load post publicly — no auth required
  React.useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      try {
        const data = await socialPostsService.getById(id)
        setPost(data)
        if (data) {
          setLiked(data.user_liked ?? false)
          setBookmarked(data.user_bookmarked ?? false)
          // record view (works for guests too — userId can be undefined)
          void socialPostsService.recordView(id, user?.id)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [id, user?.id])

  const handleLike = () => {
    guard('like this post', async () => {
      if (!post) return
      const now = !liked
      setLiked(now)
      setPost(p => p ? { ...p, like_count: now ? p.like_count + 1 : p.like_count - 1, user_liked: now } : p)
      try {
        await socialInteractionsService.toggleLike(post.id, user!.id)
      } catch {
        // revert on failure
        setLiked(!now)
        setPost(p => p ? { ...p, like_count: now ? p.like_count - 1 : p.like_count + 1 } : p)
      }
    })
  }

  const handleBookmark = () => {
    guard('save this post', async () => {
      if (!post) return
      const now = !bookmarked
      setBookmarked(now)
      try {
        await socialInteractionsService.toggleBookmark(post.id, user!.id)
      } catch {
        setBookmarked(!now)
      }
    })
  }

  const handleRepost = () => {
    guard('repost', async () => {
      if (!post) return
      await socialInteractionsService.toggleRepost(post.id, user!.id)
    })
  }

  if (loading) return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-10 animate-pulse space-y-4">
      <div className="h-6 bg-[var(--muted)] rounded w-28" />
      <div className="h-64 bg-[var(--card)] border border-[var(--border)] rounded-2xl" />
      <div className="h-40 bg-[var(--card)] border border-[var(--border)] rounded-2xl" />
    </div>
  )

  if (!post) return (
    <div className="text-center py-24 text-[var(--muted-foreground)]">
      <p className="font-medium mb-2">Post not found.</p>
      <Link to="/social" className="text-[var(--accent-primary)] text-sm hover:underline">← Back to feed</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-32 space-y-5">
      {/* Auth guard modal */}
      <AuthGuardModal open={modalOpen} action={modalAction} onClose={closeModal} />

      <Link to="/social" className="flex items-center gap-1.5 text-[var(--muted-foreground)] hover:text-[var(--accent-primary)] text-sm font-medium transition-colors">
        <ArrowLeft className="size-4" /> Back to feed
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <PostCard
          post={{ ...post, user_liked: liked, user_bookmarked: bookmarked }}
          onLike={handleLike}
          onBookmark={handleBookmark}
          onRepost={handleRepost}
        />
      </motion.div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-[var(--foreground)] mb-4">
          {post.comment_count} Comment{post.comment_count !== 1 ? 's' : ''}
        </h2>
        <CommentThread postId={post.id} locked={post.is_locked} />
      </div>
    </div>
  )
}
