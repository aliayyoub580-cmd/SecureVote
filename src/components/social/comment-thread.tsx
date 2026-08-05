import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Heart, Reply, Trash2, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { SocialAvatar }           from './avatar'
import { RoleBadge }              from './role-badge'
import { useSocialComments }      from '@/hooks/use-social-comments'
import { socialCommentsService }  from '@/services/social.service'
import { useAuth }                from '@/contexts/auth-context'
import type { SocialComment }     from '@/types/social'

interface CommentThreadProps { postId: string; locked?: boolean }

export function CommentThread({ postId, locked }: CommentThreadProps) {
  const { user, profile } = useAuth()
  const { comments, loading, addComment, deleteComment, toggleLike } = useSocialComments(postId, user?.id)
  const [text,     setText]     = React.useState('')
  const [replyTo,  setReplyTo]  = React.useState<string | null>(null)
  const [replyTxt, setReplyTxt] = React.useState('')
  const [submitting, setSub]    = React.useState(false)

  const submit = async (content: string, parentId?: string) => {
    if (!content.trim() || !user) return
    setSub(true)
    try {
      await addComment(content, parentId)
      if (parentId) { setReplyTxt(''); setReplyTo(null) }
      else setText('')
    } finally { setSub(false) }
  }

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1,2].map(i => <div key={i} className="h-14 bg-[#0F4A5E]/30 rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Composer */}
      {!locked && user && (
        <div className="flex gap-3">
          <SocialAvatar src={profile?.avatar_path} name={profile?.full_name} size="sm" />
          <div className="flex-1">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Write a comment…"
              rows={2}
              className="w-full bg-[#031F28] border border-[#0F4A5E] rounded-xl px-3 py-2.5 text-sm text-[#EDF7F6] placeholder:text-[#7FA3AB] resize-none focus:outline-none focus:border-[#2EE6B8]/50 transition-colors"
            />
            <div className="flex justify-end mt-1.5">
              <button
                onClick={() => void submit(text)}
                disabled={submitting || !text.trim()}
                className="px-4 py-1.5 bg-[#2EE6B8] text-[#031F28] rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-[#2EE6B8]/90 transition-colors"
              >
                {submitting ? '…' : 'Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
      {locked && <p className="text-xs text-[#7FA3AB] italic py-2">Comments are locked for this post.</p>}

      {/* Thread */}
      <AnimatePresence initial={false}>
        {comments.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            postId={postId}
            userId={user?.id}
            adminId={profile?.role === 'super_admin' ? user?.id : undefined}
            onDelete={deleteComment}
            onLike={toggleLike}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            replyTxt={replyTxt}
            setReplyTxt={setReplyTxt}
            onSubmitReply={submit}
            submitting={submitting}
          />
        ))}
      </AnimatePresence>
      {comments.length === 0 && !locked && (
        <p className="text-xs text-[#7FA3AB] text-center py-4">No comments yet. Be the first!</p>
      )}
    </div>
  )
}

function CommentItem({
  comment, postId, userId, adminId, onDelete, onLike,
  replyTo, setReplyTo, replyTxt, setReplyTxt, onSubmitReply, submitting,
}: {
  comment: SocialComment; postId: string; userId?: string; adminId?: string
  onDelete: (id: string) => void; onLike: (id: string) => void
  replyTo: string | null; setReplyTo: (id: string | null) => void
  replyTxt: string; setReplyTxt: (v: string) => void
  onSubmitReply: (txt: string, parentId: string) => void; submitting: boolean
}) {
  const [replies,      setReplies]      = React.useState<SocialComment[]>([])
  const [showReplies,  setShowReplies]  = React.useState(false)
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
      exit={{    opacity: 0, x: -8 }}
      className="flex gap-3"
    >
      <SocialAvatar src={author?.avatar_path} name={author?.full_name ?? author?.username} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-[#031F28] border border-[#0F4A5E] rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-xs text-[#EDF7F6]">{author?.full_name ?? author?.username}</span>
            {author?.role && <RoleBadge role={author.role} />}
            <span className="text-[10px] text-[#7FA3AB]">{timeAgo}</span>
            {comment.edited_at && <span className="text-[10px] text-[#7FA3AB] italic">edited</span>}
          </div>
          <p className="text-sm text-[#EDF7F6]/90 leading-relaxed">{comment.content}</p>
        </div>
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <button onClick={() => onLike(comment.id)} className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${comment.user_liked ? 'text-rose-400' : 'text-[#7FA3AB] hover:text-rose-400'}`}>
            <Heart className={`size-3 ${comment.user_liked ? 'fill-rose-400' : ''}`} /> {comment.like_count || ''}
          </button>
          {userId && (
            <button onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} className="flex items-center gap-1 text-[10px] font-medium text-[#7FA3AB] hover:text-[#2EE6B8] transition-colors">
              <Reply className="size-3" /> Reply
            </button>
          )}
          {comment.reply_count > 0 && !showReplies && (
            <button onClick={loadReplies} className="flex items-center gap-1 text-[10px] font-medium text-[#2EE6B8] hover:text-[#2EE6B8]/70">
              <ChevronDown className="size-3" /> {comment.reply_count} repl{comment.reply_count === 1 ? 'y' : 'ies'}
            </button>
          )}
          {(isOwner || adminId) && (
            <button onClick={() => onDelete(comment.id)} className="flex items-center gap-1 text-[10px] font-medium text-[#7FA3AB] hover:text-rose-400 transition-colors ml-auto">
              <Trash2 className="size-3" />
            </button>
          )}
        </div>

        {/* Inline reply composer */}
        {replyTo === comment.id && userId && (
          <div className="mt-2 flex gap-2">
            <textarea
              value={replyTxt}
              onChange={e => setReplyTxt(e.target.value)}
              placeholder={`Replying to @${author?.username}…`}
              rows={2}
              className="flex-1 bg-[#031F28] border border-[#2EE6B8]/30 rounded-xl px-3 py-2 text-xs text-[#EDF7F6] placeholder:text-[#7FA3AB] resize-none focus:outline-none"
            />
            <button onClick={() => onSubmitReply(replyTxt, comment.id)} disabled={submitting || !replyTxt.trim()} className="self-end px-3 py-1.5 bg-[#2EE6B8] text-[#031F28] rounded-lg text-xs font-bold disabled:opacity-40">
              Post
            </button>
          </div>
        )}

        {/* Nested replies */}
        {showReplies && replies.length > 0 && (
          <div className="mt-3 ml-3 space-y-3 border-l-2 border-[#0F4A5E] pl-3">
            {replies.map(r => (
              <CommentItem key={r.id} comment={r} postId={postId} userId={userId} adminId={adminId}
                onDelete={onDelete} onLike={onLike}
                replyTo={replyTo} setReplyTo={setReplyTo}
                replyTxt={replyTxt} setReplyTxt={setReplyTxt}
                onSubmitReply={onSubmitReply} submitting={submitting}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
