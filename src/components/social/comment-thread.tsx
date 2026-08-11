import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Heart, Reply, Trash2, ChevronDown, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { SocialAvatar }           from './avatar'
import { RoleBadge }              from './role-badge'
import { AuthGuardModal, useAuthGuard } from './auth-guard-modal'
import { useSocialComments }      from '@/hooks/use-social-comments'
import { socialCommentsService }  from '@/services/social.service'
import { useAuth }                from '@/contexts/auth-context'
import type { SocialComment }     from '@/types/social'

interface CommentThreadProps { postId: string; locked?: boolean }

export function CommentThread({ postId, locked }: CommentThreadProps) {
  const { user, profile } = useAuth()
  const { guard, modalOpen, modalAction, closeModal } = useAuthGuard(user?.id)
  const { comments, loading, addComment, deleteComment, toggleLike } = useSocialComments(postId, user?.id)
  const [text,       setText]    = React.useState('')
  const [replyTo,   setReplyTo]  = React.useState<string | null>(null)
  const [replyTxt,  setReplyTxt] = React.useState('')
  const [submitting, setSub]     = React.useState(false)

  const submit = (content: string, parentId?: string) => {
    guard('comment on this post', async () => {
      if (!content.trim()) return
      setSub(true)
      try {
        await addComment(content, parentId)
        if (parentId) { setReplyTxt(''); setReplyTo(null) }
        else setText('')
      } finally { setSub(false) }
    })
  }

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1, 2].map(i => <div key={i} className="h-14 bg-[var(--muted)]/40 rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Auth guard modal */}
      <AuthGuardModal open={modalOpen} action={modalAction} onClose={closeModal} />

      {/* Composer — always visible; guarded on submit */}
      {!locked && (
        user ? (
          /* Logged-in composer */
          <div className="flex gap-3">
            <SocialAvatar src={(profile as any)?.avatar_path} name={profile?.full_name} size="sm" />
            <div className="flex-1">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
              />
              <div className="flex justify-end mt-1.5">
                <button
                  onClick={() => submit(text)}
                  disabled={submitting || !text.trim()}
                  className="px-4 py-1.5 bg-[var(--accent-primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-all"
                >
                  {submitting ? '…' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Guest sign-in prompt */
          <div className="flex items-center gap-3 p-3 bg-[var(--muted)]/30 border border-[var(--border)] rounded-xl">
            <p className="flex-1 text-xs text-[var(--muted-foreground)]">
              Sign in to join the conversation.
            </p>
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--primary-foreground)] text-xs font-bold hover:opacity-90 transition-all flex-shrink-0"
            >
              <LogIn className="size-3.5" /> Sign In
            </Link>
          </div>
        )
      )}

      {locked && (
        <p className="text-xs text-[var(--muted-foreground)] italic py-2 text-center">
          Comments are locked for this post.
        </p>
      )}

      {/* Thread — always visible to guests and logged-in users */}
      <AnimatePresence initial={false}>
        {comments.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            postId={postId}
            userId={user?.id}
            adminId={profile?.role === 'super_admin' ? user?.id : undefined}
            onDelete={deleteComment}
            onLike={(id) => {
              guard('like this comment', () => toggleLike(id))
            }}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            replyTxt={replyTxt}
            setReplyTxt={setReplyTxt}
            onSubmitReply={(txt, parentId) => submit(txt, parentId)}
            submitting={submitting}
            onGuardedReply={(commentId) => {
              guard('reply to this comment', () => {
                setReplyTo(replyTo === commentId ? null : commentId)
              })
            }}
          />
        ))}
      </AnimatePresence>

      {comments.length === 0 && !locked && (
        <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
          No comments yet. Be the first!
        </p>
      )}
    </div>
  )
}

function CommentItem({
  comment, postId, userId, adminId, onDelete, onLike,
  replyTo, setReplyTo, replyTxt, setReplyTxt, onSubmitReply, submitting, onGuardedReply,
}: {
  comment: SocialComment; postId: string; userId?: string; adminId?: string
  onDelete: (id: string) => void
  onLike: (id: string) => void
  replyTo: string | null; setReplyTo: (id: string | null) => void
  replyTxt: string; setReplyTxt: (v: string) => void
  onSubmitReply: (txt: string, parentId: string) => void
  submitting: boolean
  onGuardedReply: (commentId: string) => void
}) {
  const [replies,     setReplies]     = React.useState<SocialComment[]>([])
  const [showReplies, setShowReplies] = React.useState(false)
  const isOwner = userId === comment.author_id
  const author  = comment.profiles
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })

  const loadReplies = async () => {
    const data = await socialCommentsService.getReplies(comment.id)
    setReplies(data)
    setShowReplies(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="flex gap-3"
    >
      <SocialAvatar
        src={author?.avatar_path}
        name={author?.full_name ?? author?.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-xs text-[var(--foreground)]">
              {author?.full_name ?? author?.username}
            </span>
            {author?.role && <RoleBadge role={author.role} />}
            <span className="text-[10px] text-[var(--muted-foreground)]">{timeAgo}</span>
            {comment.edited_at && (
              <span className="text-[10px] text-[var(--muted-foreground)] italic">edited</span>
            )}
          </div>
          <p className="text-sm text-[var(--foreground)]/90 leading-relaxed">{comment.content}</p>
        </div>

        {/* Action row — visible to everyone */}
        <div className="flex items-center gap-2 mt-1.5 px-1">
          {/* Like — guarded via parent's onLike which calls guard() */}
          <button
            onClick={() => onLike(comment.id)}
            className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${
              comment.user_liked
                ? 'text-rose-500'
                : 'text-[var(--muted-foreground)] hover:text-rose-500'
            }`}
          >
            <Heart className={`size-3 ${comment.user_liked ? 'fill-rose-500' : ''}`} />
            {comment.like_count > 0 && <span>{comment.like_count}</span>}
          </button>

          {/* Reply — guarded */}
          <button
            onClick={() => onGuardedReply(comment.id)}
            className="flex items-center gap-1 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <Reply className="size-3" /> Reply
          </button>

          {/* Show replies */}
          {comment.reply_count > 0 && !showReplies && (
            <button
              onClick={loadReplies}
              className="flex items-center gap-1 text-[10px] font-medium text-[var(--accent-primary)] hover:opacity-70 transition-opacity"
            >
              <ChevronDown className="size-3" />
              {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
            </button>
          )}

          {/* Delete — only owner or admin */}
          {(isOwner || adminId) && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-rose-500 transition-colors ml-auto"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>

        {/* Inline reply composer — only shown when user is logged in and clicked Reply */}
        {replyTo === comment.id && userId && (
          <div className="mt-2 flex gap-2">
            <textarea
              value={replyTxt}
              onChange={e => setReplyTxt(e.target.value)}
              placeholder={`Replying to @${author?.username}…`}
              rows={2}
              className="flex-1 bg-[var(--background)] border border-[var(--accent-primary)]/30 rounded-xl px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none"
            />
            <button
              onClick={() => onSubmitReply(replyTxt, comment.id)}
              disabled={submitting || !replyTxt.trim()}
              className="self-end px-3 py-1.5 bg-[var(--accent-primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-all"
            >
              Post
            </button>
          </div>
        )}

        {/* Nested replies */}
        {showReplies && replies.length > 0 && (
          <div className="mt-3 ml-3 space-y-3 border-l-2 border-[var(--border)] pl-3">
            {replies.map(r => (
              <CommentItem
                key={r.id}
                comment={r}
                postId={postId}
                userId={userId}
                adminId={adminId}
                onDelete={onDelete}
                onLike={onLike}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                replyTxt={replyTxt}
                setReplyTxt={setReplyTxt}
                onSubmitReply={onSubmitReply}
                submitting={submitting}
                onGuardedReply={onGuardedReply}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
