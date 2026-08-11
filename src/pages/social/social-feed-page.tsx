import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Rss, UserCheck, Globe, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PostCard }             from '@/components/social/post-card'
import { PostComposer }         from '@/components/social/post-composer'
import { SocialProfileHeader }  from '@/components/social/social-profile-header'
import { AuthGuardModal, useAuthGuard } from '@/components/social/auth-guard-modal'
import { useSocialFeed }        from '@/hooks/use-social-feed'
import { useAuth }              from '@/contexts/auth-context'
import { socialInteractionsService } from '@/services/social.service'
import { ROUTES } from '@/constants/routes'
import type { FeedFilter } from '@/types/social'

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'latest',           label: 'Latest'    },
  { value: 'trending',         label: 'Trending'  },
  { value: 'following',        label: 'Following' },
  { value: 'election_updates', label: 'Elections' },
]

export function SocialFeedPage({ myPostsOnly = false }: { myPostsOnly?: boolean }) {
  const { user } = useAuth()
  const [filter,       setFilter]       = React.useState<FeedFilter>('latest')
  const [showComposer, setShowComposer] = React.useState(false)

  // Auth guard — used for interactions when not logged in
  const { guard, modalOpen, modalAction, closeModal } = useAuthGuard(user?.id)

  // Feed works for both guests (userId = undefined) and logged-in users
  const { posts, loading, hasMore, loadMore, refresh, optimisticLike, optimisticBookmark } =
    useSocialFeed(user?.id, filter, myPostsOnly)

  const handleLike = (postId: string) => {
    guard('like this post', () => optimisticLike(postId))
  }

  const handleBookmark = (postId: string) => {
    guard('save this post', () => optimisticBookmark(postId))
  }

  const handleRepost = (postId: string) => {
    guard('repost', () => {
      if (user) void socialInteractionsService.toggleRepost(postId, user.id)
    })
  }

  const handleCreatePost = () => {
    guard('create a post', () => setShowComposer(v => !v))
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5 pb-24">
      {/* Auth guard modal — shown to guests who click an interaction */}
      <AuthGuardModal open={modalOpen} action={modalAction} onClose={closeModal} />

      {/* Logged-in user profile header */}
      {user && (
        <SocialProfileHeader onCreatePost={handleCreatePost} />
      )}

      {/* Guest CTA banner */}
      {!user && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--foreground)] mb-0.5">Welcome to SecureVote Community</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Browse public posts freely. Sign in to like, comment, follow, and post.</p>
          </div>
          <Link
            to="/login"
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--primary-foreground)] text-xs font-bold hover:opacity-90 transition-all text-center shadow-sm"
          >
            Sign In
          </Link>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rss className="size-4 text-[var(--accent-primary)]" />
          <h2 className="text-base font-black text-[var(--foreground)] tracking-tight">
            {myPostsOnly ? 'My Posts' : 'Community Feed'}
          </h2>
          {myPostsOnly && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 text-[10px] font-bold">
              My Posts
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={handleCreatePost}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--primary-foreground)] text-xs font-bold hover:opacity-90 transition-all"
            >
              {showComposer ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
              <span>{showComposer ? 'Close' : 'New Post'}</span>
            </button>
          )}
          {myPostsOnly && (
            <Link
              to={ROUTES.social}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/30 transition-all"
            >
              <Globe className="size-3.5" />
              <span>All Posts</span>
            </Link>
          )}
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--accent-primary)] hover:bg-[var(--muted)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Post Composer — only visible when logged-in user clicks Create Post */}
      <AnimatePresence>
        {showComposer && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <PostComposer
              onSuccess={() => { refresh(); setShowComposer(false) }}
              onCancel={() => setShowComposer(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      {!myPostsOnly && (
        <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-xl p-1">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => {
                if (f.value === 'following') {
                  guard('view posts from accounts you follow', () => setFilter('following'))
                } else {
                  setFilter(f.value)
                }
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.value
                  ? 'bg-[var(--accent-primary)] text-[var(--primary-foreground)] shadow-xs'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Posts: 2-column on md+, 1-column on mobile ── */}
      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 animate-pulse space-y-3">
              <div className="flex gap-3 items-center">
                <div className="size-10 bg-[var(--muted)] rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[var(--muted)] rounded w-28" />
                  <div className="h-2 bg-[var(--muted)] rounded w-20" />
                </div>
              </div>
              <div className="h-14 bg-[var(--muted)] rounded-lg" />
              <div className="h-7 bg-[var(--muted)] rounded-lg" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted-foreground)] bg-[var(--card)] rounded-2xl border border-[var(--border)]">
          {myPostsOnly ? (
            <>
              <UserCheck className="size-10 mx-auto mb-3 opacity-40 text-[var(--accent-primary)]" />
              <p className="font-bold text-[var(--foreground)] text-sm">No posts from you yet.</p>
              <p className="text-xs mt-1">Click "New Post" to share something!</p>
            </>
          ) : (
            <>
              <Rss className="size-10 mx-auto mb-3 opacity-30 text-[var(--accent-primary)]" />
              <p className="font-bold text-[var(--foreground)] text-sm">No public posts yet.</p>
              <p className="text-xs mt-1">Be the first to post!</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* 2-column responsive grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onRepost={handleRepost}
              />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--accent-primary)] bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-[var(--accent-primary)]/30 transition-all"
            >
              {loading ? 'Loading…' : 'Load more posts'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
