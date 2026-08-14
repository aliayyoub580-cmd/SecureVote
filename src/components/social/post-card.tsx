import * as React from 'react'
import { Link }    from 'react-router-dom'
import { motion }  from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Heart, MessageCircle, Repeat2, Bookmark, Share2, Flag,
  MoreHorizontal, Pencil, Trash2, Pin, Lock, Eye, Copy, UserPlus, UserCheck,
} from 'lucide-react'
import DOMPurify from 'dompurify'

import { SocialAvatar }        from './avatar'
import { RoleBadge }           from './role-badge'
import { MediaGallery }        from './media-gallery'
import { AuthGuardModal, useAuthGuard } from './auth-guard-modal'
import { useAuth }             from '@/contexts/auth-context'
import { socialInteractionsService, socialPostsService } from '@/services/social.service'
import { toast }               from '@/lib/toast'
import type { SocialPost }     from '@/types/social'

interface PostCardProps {
  post:           SocialPost
  onLike?:        (id: string) => void
  onBookmark?:    (id: string) => void
  onDelete?:      (id: string) => void
  onRepost?:      (id: string) => void
  compact?:       boolean
}

export function PostCard({ post, onLike, onBookmark, onDelete, onRepost, compact }: PostCardProps) {
  const { user, profile } = useAuth()
  const { guard, modalOpen, modalAction, closeModal } = useAuthGuard(user?.id)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [reporting, setReporting] = React.useState(false)
  const [following, setFollowing] = React.useState(false)
  const isOwner   = user?.id === post.author_id
  const isAdmin   = profile?.role === 'super_admin'

  const handleFollowToggle = () => {
    guard('follow this user', async () => {
      const prev = following
      setFollowing(!prev)
      try {
        await socialInteractionsService.toggleFollow(user!.id, post.author_id)
        toast.success(prev ? 'Unfollowed' : 'Following author')
      } catch {
        setFollowing(prev)
        toast.error('Action failed')
      }
    })
  }

  const handleShare = () => {
    const url = `${window.location.origin}/social/posts/${post.id}`
    void navigator.clipboard.writeText(url)
    toast.success('Link copied!')
  }

  const handleReport = () => {
    guard('report this post', async () => {
      setReporting(true)
      try {
        await socialInteractionsService.reportPost(post.id, user!.id, 'spam')
        toast.success('Post reported. Thank you.')
      } catch { toast.error('Failed to report.') }
      finally { setReporting(false); setMenuOpen(false) }
    })
  }

  const handleDelete = async () => {
    if (!user) return
    try {
      await socialPostsService.delete(post.id)
      onDelete?.(post.id)
      toast.success('Post deleted.')
    } catch { toast.error('Failed to delete.') }
    setMenuOpen(false)
  }

  const authorName = post.author_full_name ?? post.author_username
  const timeAgo    = formatDistanceToNow(new Date(post.published_at), { addSuffix: true })

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y:  0 }}
      exit={{    opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="group relative bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--accent-primary)]/40 transition-all duration-300 shadow-sm"
    >
      {/* Auth guard modal — mounted per-card so the guard context is local */}
      <AuthGuardModal open={modalOpen} action={modalAction} onClose={closeModal} />
      {/* pinned banner */}
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent-primary)]/10 border-b border-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[10px] font-bold uppercase tracking-widest">
          <Pin className="size-3" /> Pinned
        </div>
      )}
      {post.is_featured && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-widest">
          ⭐ Featured
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/social/profile/${post.author_username}`}>
              <SocialAvatar src={post.author_avatar} name={authorName} size="md" verified={post.author_verified} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <Link to={`/social/profile/${post.author_username}`} className="font-bold text-[var(--foreground)] hover:text-[var(--accent-primary)] transition-colors text-sm truncate">
                  {authorName}
                </Link>
                <RoleBadge role={post.author_role} />
                {post.edited_at && (
                  <span className="text-[10px] text-[var(--muted-foreground)] font-medium">Edited</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-[var(--muted-foreground)]">@{post.author_username}</span>
                <span className="text-[var(--border)]">·</span>
                <span className="text-xs text-[var(--muted-foreground)]">{timeAgo}</span>
              </div>
            </div>
          </div>

          {/* Follow Button & Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isOwner && user && (
              <button
                type="button"
                onClick={handleFollowToggle}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                  following
                    ? 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--accent-danger)]'
                    : 'bg-[var(--accent-primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-xs'
                }`}
              >
                {following ? (
                  <>
                    <UserCheck className="size-3.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                aria-label="Post options"
              >
                <MoreHorizontal className="size-4" />
              </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden p-1" onClick={() => setMenuOpen(false)}>
                <button onClick={handleShare} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors">
                  <Copy className="size-3.5" /> Copy Link
                </button>
                {(isOwner || isAdmin) && (
                  <>
                    {isOwner && (
                      <Link to={`/social/posts/${post.id}/edit`} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors">
                        <Pencil className="size-3.5" /> Edit
                      </Link>
                    )}
                    <button onClick={handleDelete} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 rounded-lg transition-colors">
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </>
                )}
                {isAdmin && (
                  <button onClick={() => void socialPostsService.lockComments(post.id, !post.is_locked).then(() => toast.success('Updated'))} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors">
                    <Lock className="size-3.5" /> {post.is_locked ? 'Unlock' : 'Lock'} Comments
                  </button>
                )}
                {!isOwner && (
                  <button onClick={handleReport} disabled={reporting} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 rounded-lg transition-colors">
                    <Flag className="size-3.5" /> Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Content */}
        {post.title && (
          <Link to={`/social/posts/${post.id}`}>
            <h3 className="font-bold text-[var(--foreground)] text-base mb-1 hover:text-[var(--accent-primary)] transition-colors line-clamp-2">{post.title}</h3>
          </Link>
        )}
        {post.content_html ? (
          <div
            className="prose prose-sm max-w-none text-[var(--foreground)]/90 leading-relaxed mb-3 line-clamp-4 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content_html) }}
          />
        ) : post.content ? (
          <p className="text-[var(--foreground)]/90 text-sm leading-relaxed mb-3 line-clamp-4">{post.content}</p>
        ) : null}

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.hashtags.map(tag => (
              <Link key={tag} to={`/social/hashtag/${tag}`} className="text-xs text-[var(--accent-primary)] hover:underline font-medium">
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Media */}
        {post.media && post.media.length > 0 && !compact && (
          <div className="mb-3">
            <MediaGallery media={post.media} />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-1">
            <ActionButton
              icon={<Heart className={`size-4 ${post.user_liked ? 'fill-[var(--accent-danger)] text-[var(--accent-danger)]' : ''}`} />}
              count={post.like_count}
              active={post.user_liked}
              activeClass="text-[var(--accent-danger)]"
              onClick={() => onLike?.(post.id)}
              label="Like"
            />
            <Link to={`/social/posts/${post.id}`}>
              <ActionButton icon={<MessageCircle className="size-4" />} count={post.comment_count} label="Comment" />
            </Link>
            <ActionButton
              icon={<Repeat2 className={`size-4 ${post.user_reposted ? 'text-[var(--accent-primary)]' : ''}`} />}
              count={post.repost_count}
              active={post.user_reposted}
              activeClass="text-[var(--accent-primary)]"
              onClick={() => onRepost?.(post.id)}
              label="Repost"
            />
          </div>
          <div className="flex items-center gap-1">
            <ActionButton
              icon={<Bookmark className={`size-4 ${post.user_bookmarked ? 'fill-[var(--accent-secondary)] text-[var(--accent-secondary)]' : ''}`} />}
              active={post.user_bookmarked}
              activeClass="text-[var(--accent-secondary)]"
              onClick={() => onBookmark?.(post.id)}
              label="Bookmark"
            />
            <ActionButton icon={<Share2 className="size-4" />} onClick={handleShare} label="Share" />
            <div className="flex items-center gap-1 px-2 py-1.5 text-[var(--muted-foreground)] text-xs font-medium">
              <Eye className="size-3.5" /> {post.view_count}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function ActionButton({
  icon, count, active, activeClass, onClick, label,
}: {
  icon: React.ReactNode; count?: number; active?: boolean; activeClass?: string; onClick?: () => void; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
        ${active ? activeClass : 'text-[var(--muted-foreground)]'} hover:bg-[var(--muted)] hover:text-[var(--foreground)]`}
      aria-label={label}
    >
      {icon}
      {count !== undefined && <span>{count}</span>}
    </button>
  )
}
