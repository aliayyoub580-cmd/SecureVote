import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Rss, UserCheck, Globe, Compass, Plus, Search, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { PostCard }     from '@/components/social/post-card'
import { PostComposer } from '@/components/social/post-composer'
import { useSocialFeed }from '@/hooks/use-social-feed'
import { useAuth }      from '@/contexts/auth-context'
import { socialInteractionsService } from '@/services/social.service'
import type { FeedFilter } from '@/types/social'
import { ROUTES } from '@/constants/routes'

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'latest',          label: 'Latest'     },
  { value: 'trending',        label: 'Trending'   },
  { value: 'following',       label: 'Following'  },
  { value: 'election_updates',label: 'Elections'  },
]

export function SocialFeedPage({ myPostsOnly = false }: { myPostsOnly?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = React.useState<FeedFilter>('latest')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showComposer, setShowComposer] = React.useState(false)
  const { posts, loading, hasMore, loadMore, refresh, optimisticLike, optimisticBookmark } =
    useSocialFeed(user?.id, filter, myPostsOnly)

  const handleRepost = async (postId: string) => {
    if (!user) return
    await socialInteractionsService.toggleRepost(postId, user.id)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/social/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-4 pb-32">
      {/* Top Hero Banner — for Community Feed matching Screenshot 3 */}
      {!myPostsOnly && (
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0B3541] via-[#092B35] to-[#041920] border border-[#0F4A5E] rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 size-64 bg-gradient-to-br from-[#2EE6B8]/10 to-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          {/* Top Bar with Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-[#2EE6B8]/15 border border-[#2EE6B8]/30 flex items-center justify-center text-[#2EE6B8] font-black text-sm">
                SV
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#EDF7F6]">SecureVote Social</h2>
                <p className="text-[10px] text-[#7FA3AB]">Connect. Share. Engage.</p>
              </div>
            </div>

            {/* Quick Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#7FA3AB]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search users or posts..."
                className="w-full h-9 rounded-xl bg-[#031F28]/80 border border-[#0F4A5E] pl-9 pr-3 text-xs text-[#EDF7F6] placeholder:text-[#7FA3AB] focus:outline-none focus:border-[#2EE6B8]/50 transition-colors"
              />
            </form>
          </div>

          {/* Hero Content */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-[#2EE6B8] uppercase tracking-widest bg-[#2EE6B8]/10 px-3 py-1 rounded-full border border-[#2EE6B8]/20 inline-block">
              Modern Social Networking Platform
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#EDF7F6] tracking-tight">
              SecureVote Social
            </h1>
            <p className="text-xs sm:text-sm text-[#7FA3AB] max-w-lg">
              Connect with voters, candidates, and election creators. Share updates, join discussions, and follow key political insights.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowComposer(prev => !prev)}
                className="px-5 py-2.5 rounded-xl bg-[#2EE6B8] text-[#031F28] font-bold text-xs hover:bg-[#2EE6B8]/90 shadow-[0_0_15px_rgba(46,230,184,0.25)] flex items-center gap-2 transition-all active:scale-95"
              >
                {showComposer ? <X className="size-4" /> : <Plus className="size-4" />}
                <span>{showComposer ? 'Close Form' : 'Create Post'}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilter('trending')}
                className="px-5 py-2.5 rounded-xl bg-[#0F4A5E]/60 border border-[#0F4A5E] text-[#EDF7F6] font-bold text-xs hover:bg-[#0F4A5E] flex items-center gap-2 transition-all"
              >
                <Compass className="size-4 text-[#F5A15C]" />
                <span>Explore Posts</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Rss className="size-5 text-[#2EE6B8]" />
          <h2 className="text-xl font-black text-[#EDF7F6] tracking-tight">
            {myPostsOnly ? 'My Activity & Posts' : 'Community Feed'}
          </h2>
          {myPostsOnly && (
            <span className="px-2 py-0.5 rounded-full bg-[#2EE6B8]/10 text-[#2EE6B8] border border-[#2EE6B8]/30 text-[10px] font-bold">
              Portal View
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => setShowComposer(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2EE6B8] text-[#031F28] text-xs font-bold hover:bg-[#2EE6B8]/90 transition-all"
            >
              {showComposer ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
              <span>{showComposer ? 'Close' : 'Create Post'}</span>
            </button>
          )}
          {myPostsOnly && (
            <Link
              to={ROUTES.communityFeed || '/community-feed'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B3541] border border-[#0F4A5E] text-xs font-semibold text-[#7FA3AB] hover:text-[#2EE6B8] hover:border-[#2EE6B8]/30 transition-all"
            >
              <Globe className="size-3.5" />
              <span>Full Community Feed</span>
            </Link>
          )}
          <button onClick={refresh} className="p-2 rounded-lg text-[#7FA3AB] hover:text-[#2EE6B8] hover:bg-[#0F4A5E] transition-colors" title="Refresh Feed">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Post Composer — Hidden by default, shown ONLY when Create Post is clicked */}
      <AnimatePresence>
        {showComposer && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <PostComposer
              onSuccess={() => {
                refresh()
                setShowComposer(false)
              }}
              onCancel={() => setShowComposer(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs — shown for Community Feed */}
      {!myPostsOnly && (
        <div className="flex items-center gap-1 bg-[#0B3541] border border-[#0F4A5E] rounded-xl p-1">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.value
                  ? 'bg-[#2EE6B8] text-[#031F28] shadow-[0_0_10px_rgba(46,230,184,0.2)]'
                  : 'text-[#7FA3AB] hover:text-[#EDF7F6]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Posts */}
      <div className="space-y-4">
        {loading && posts.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#0B3541] border border-[#0F4A5E] rounded-2xl p-5 animate-pulse space-y-3">
              <div className="flex gap-3 items-center">
                <div className="size-10 bg-[#0F4A5E] rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[#0F4A5E] rounded w-32" />
                  <div className="h-2 bg-[#0F4A5E] rounded w-24" />
                </div>
              </div>
              <div className="h-16 bg-[#0F4A5E] rounded-lg" />
              <div className="h-8 bg-[#0F4A5E] rounded-lg" />
            </div>
          ))
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-[#7FA3AB] bg-[#0B3541]/40 rounded-2xl border border-[#0F4A5E]/50 p-8">
            {myPostsOnly ? (
              <>
                <UserCheck className="size-10 mx-auto mb-3 text-[#2EE6B8] opacity-60" />
                <p className="font-bold text-[#EDF7F6]">No posts published by you yet</p>
                <p className="text-xs mt-1 text-[#7FA3AB]">
                  Click "Create Post" above to share updates with voters!
                </p>
              </>
            ) : (
              <>
                <Rss className="size-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nothing here yet.</p>
                <p className="text-xs mt-1">Be the first to post!</p>
              </>
            )}
          </div>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onLike={optimisticLike}
              onBookmark={optimisticBookmark}
              onRepost={handleRepost}
            />
          ))
        )}

        {hasMore && posts.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full py-3 text-sm font-medium text-[#7FA3AB] hover:text-[#2EE6B8] border border-[#0F4A5E] rounded-xl hover:border-[#2EE6B8]/30 transition-all"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}
