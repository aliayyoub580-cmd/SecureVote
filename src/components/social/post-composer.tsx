import * as React from 'react'
import { useNavigate }  from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Image, FileText, Hash, AtSign, Smile, Globe, Lock, Users,
  ChevronDown, X, Loader2, Send, Save,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit  from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

import { SocialAvatar }  from './avatar'
import { useAuth }       from '@/contexts/auth-context'
import { socialPostsService, socialMediaService, socialDraftsService } from '@/services/social.service'
import { toast }         from '@/lib/toast'
import type { PostType, PostVisibility } from '@/types/social'

const EMOJI_SET = ['❤️','👍','🎉','🗳️','✅','🔥','💬','📢','🏆','📌']
const POST_TYPES: { value: PostType; label: string; icon: string }[] = [
  { value: 'text',                  label: 'Text',                 icon: '✏️' },
  { value: 'image',                 label: 'Image',                icon: '🖼️' },
  { value: 'multi_image',           label: 'Gallery',              icon: '📷' },
  { value: 'pdf',                   label: 'PDF',                  icon: '📄' },
  { value: 'election_announcement', label: 'Announcement',         icon: '📢' },
  { value: 'poll',                  label: 'Poll',                 icon: '📊' },
  { value: 'election_result',       label: 'Election Result',      icon: '🏆' },
  { value: 'candidate_highlight',   label: 'Candidate Highlight',  icon: '🎯' },
  { value: 'event',                 label: 'Event',                icon: '📅' },
  { value: 'public_notice',         label: 'Public Notice',        icon: '📌' },
]
const VISIBILITY_OPTIONS: { value: PostVisibility; label: string; Icon: React.FC<{className?: string}> }[] = [
  { value: 'public',    label: 'Public',       Icon: Globe  },
  { value: 'followers', label: 'Followers',    Icon: Users  },
  { value: 'private',   label: 'Only Me',      Icon: Lock   },
]

const MAX_CHARS = 5000

interface PostComposerProps {
  onSuccess?: (postId: string) => void
  onCancel?: () => void
  initialDraftId?: string
  editPostId?: string
}

export function PostComposer({ onSuccess, onCancel, initialDraftId, editPostId }: PostComposerProps) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [postType,    setPostType]    = React.useState<PostType>('text')
  const [title,       setTitle]       = React.useState('')
  const [visibility,  setVisibility]  = React.useState<PostVisibility>('public')
  const [hashtags,    setHashtags]    = React.useState<string[]>([])
  const [tagInput,    setTagInput]    = React.useState('')
  const [images,      setImages]      = React.useState<File[]>([])
  const [pdf,         setPdf]         = React.useState<File | null>(null)
  const [uploading,   setUploading]   = React.useState(false)
  const [publishing,  setPublishing]  = React.useState(false)
  const [showEmoji,   setShowEmoji]   = React.useState(false)
  const [showVisMenu, setShowVisMenu] = React.useState(false)
  const [draftId,     setDraftId]     = React.useState(initialDraftId ?? '')
  const [loadingEdit, setLoadingEdit] = React.useState(Boolean(editPostId))

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "What's on your mind? Use @ to mention, # for hashtags…" }),
    ],
    editorProps: {
      attributes: { class: 'min-h-[100px] focus:outline-none text-[#EDF7F6] text-sm leading-relaxed' },
    },
  })

  React.useEffect(() => {
    if (!editPostId) return
    let isMounted = true
    void (async () => {
      setLoadingEdit(true)
      try {
        const post = await socialPostsService.getById(editPostId)
        if (post && isMounted) {
          setTitle(post.title ?? '')
          setPostType(post.post_type)
          setVisibility(post.visibility)
          if (post.hashtags) setHashtags(post.hashtags)
          if (editor && (post.content_html || post.content)) {
            editor.commands.setContent(post.content_html || post.content || '')
          }
        }
      } catch (err) {
        toast.error('Failed to load post details for editing.')
      } finally {
        if (isMounted) setLoadingEdit(false)
      }
    })()
    return () => { isMounted = false }
  }, [editPostId, editor])

  const charCount = editor?.getText().length ?? 0
  const visConfig = VISIBILITY_OPTIONS.find(v => v.value === visibility) ?? VISIBILITY_OPTIONS[0]

  const addHashtag = (tag: string) => {
    const clean = tag.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
    if (clean && !hashtags.includes(clean)) setHashtags(h => [...h, clean])
    setTagInput('')
  }

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    setImages(prev => [...prev, ...files].slice(0, 4))
  }

  const publish = async (status: 'published' | 'draft' = 'published') => {
    if (!user) return
    const content     = editor?.getText() ?? ''
    const contentHtml = editor?.getHTML() ?? ''
    if (!content.trim() && !title.trim()) {
      toast.error('Write something before posting.')
      return
    }
    if (status === 'published') setPublishing(true)

    if (editPostId) {
      try {
        await socialPostsService.update(editPostId, {
          title: title.trim() || undefined,
          content,
          contentHtml,
          visibility,
        })
        toast.success('Post updated successfully!')
        onSuccess?.(editPostId)
        navigate(`/social/posts/${editPostId}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update post.')
      } finally {
        setPublishing(false)
      }
      return
    }

    try {
      const postId = await socialPostsService.create({
        authorId:    user.id,
        postType,
        title:       title.trim() || undefined,
        content,
        contentHtml,
        visibility,
        hashtags,
        status,
      })

      // Upload images
      if (images.length > 0) {
        setUploading(true)
        for (let i = 0; i < images.length; i++) {
          await socialMediaService.uploadPostImage(user.id, postId, images[i], i)
        }
        setUploading(false)
      }
      // Upload PDF
      if (pdf) {
        setUploading(true)
        await socialMediaService.uploadPostPdf(user.id, postId, pdf)
        setUploading(false)
      }

      if (status === 'draft') {
        toast.success('Draft saved.')
      } else {
        toast.success('Post published!')
        if (draftId) await socialDraftsService.deleteDraft(draftId)
        onSuccess?.(postId)
        navigate(`/social/posts/${postId}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish.')
    } finally {
      setPublishing(false)
      setUploading(false)
    }
  }

  const saveDraft = async () => {
    if (!user) return
    const content = editor?.getText() ?? ''
    try {
      if (draftId) {
        await socialDraftsService.updateDraft(draftId, { title, content, contentHtml: editor?.getHTML(), hashtags })
      } else {
        const id = await socialDraftsService.saveDraft(user.id, { postType, title, content, contentHtml: editor?.getHTML(), hashtags })
        setDraftId(id)
      }
      toast.success('Draft saved.')
    } catch { toast.error('Could not save draft.') }
  }

  if (!user || !profile) return null

  return (
    <div className="bg-[#0B3541] border border-[#0F4A5E] rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#0F4A5E]">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Post type selector */}
          <select
            value={postType}
            onChange={e => setPostType(e.target.value as PostType)}
            className="bg-[#031F28] border border-[#0F4A5E] text-[#EDF7F6] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2EE6B8]/50"
          >
            {POST_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>

          {/* Visibility */}
          <div className="relative">
            <button onClick={() => setShowVisMenu(v => !v)} className="flex items-center gap-1.5 bg-[#031F28] border border-[#0F4A5E] text-[#EDF7F6] text-xs rounded-lg px-2.5 py-1.5 hover:border-[#2EE6B8]/50 transition-colors">
              <visConfig.Icon className="size-3" /> {visConfig.label} <ChevronDown className="size-3" />
            </button>
            <AnimatePresence>
              {showVisMenu && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-8 left-0 z-50 bg-[#0B3541] border border-[#0F4A5E] rounded-xl shadow-xl overflow-hidden">
                  {VISIBILITY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => { setVisibility(opt.value); setShowVisMenu(false) }}
                      className={`flex items-center gap-2 w-full px-4 py-2.5 text-xs text-left transition-colors ${visibility === opt.value ? 'text-[#2EE6B8] bg-[#2EE6B8]/10' : 'text-[#EDF7F6] hover:bg-[#0F4A5E]'}`}>
                      <opt.Icon className="size-3" /> {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E] transition-colors"
            title="Close composer"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex gap-3">
          <SocialAvatar src={profile.avatar_path} name={profile.full_name} size="md" verified={profile.is_verified} />
          <div className="flex-1 min-w-0 space-y-3">
            {/* Title */}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full bg-transparent text-[#EDF7F6] font-semibold text-base placeholder:text-[#7FA3AB]/60 focus:outline-none border-b border-[#0F4A5E] pb-2"
            />

            {/* Rich editor */}
            <div
              className="min-h-[100px] cursor-text"
              onDrop={handleImageDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => editor?.commands.focus()}
            >
              <EditorContent editor={editor} />
            </div>

            {/* Hashtag builder */}
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-[#2EE6B8]/10 text-[#2EE6B8] text-xs rounded-full border border-[#2EE6B8]/20">
                    #{t}
                    <button onClick={() => setHashtags(h => h.filter(x => x !== t))}><X className="size-2.5" /></button>
                  </span>
                ))}
              </div>
            )}

            {/* Image previews */}
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((f, i) => (
                  <div key={i} className="relative size-20 rounded-lg overflow-hidden bg-[#031F28]">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))} className="absolute top-1 right-1 size-5 bg-black/60 rounded-full flex items-center justify-center text-white">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* PDF preview */}
            {pdf && (
              <div className="flex items-center gap-2 p-2 bg-[#031F28] border border-[#0F4A5E] rounded-lg">
                <FileText className="size-4 text-rose-400" />
                <span className="text-xs text-[#EDF7F6] truncate flex-1">{pdf.name}</span>
                <button onClick={() => setPdf(null)}><X className="size-3.5 text-[#7FA3AB]" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#0F4A5E]">
          <div className="flex items-center gap-1">
            {/* Image upload */}
            <label className="p-2 rounded-lg text-[#7FA3AB] hover:text-[#2EE6B8] hover:bg-[#0F4A5E] transition-colors cursor-pointer" title="Add images">
              <Image className="size-4" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                const files = Array.from(e.target.files ?? [])
                setImages(prev => [...prev, ...files].slice(0, 4))
                e.target.value = ''
              }} />
            </label>
            {/* PDF upload */}
            <label className="p-2 rounded-lg text-[#7FA3AB] hover:text-[#2EE6B8] hover:bg-[#0F4A5E] transition-colors cursor-pointer" title="Attach PDF">
              <FileText className="size-4" />
              <input type="file" accept="application/pdf" className="hidden" onChange={e => {
                setPdf(e.target.files?.[0] ?? null)
                e.target.value = ''
              }} />
            </label>
            {/* Hashtag */}
            <div className="relative flex items-center">
              <button onClick={() => { const t = window.prompt('Enter hashtag (no #):'); if (t) addHashtag(t) }} className="p-2 rounded-lg text-[#7FA3AB] hover:text-[#2EE6B8] hover:bg-[#0F4A5E] transition-colors" title="Add hashtag">
                <Hash className="size-4" />
              </button>
            </div>
            {/* Emoji */}
            <div className="relative">
              <button onClick={() => setShowEmoji(v => !v)} className="p-2 rounded-lg text-[#7FA3AB] hover:text-[#2EE6B8] hover:bg-[#0F4A5E] transition-colors">
                <Smile className="size-4" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-8 left-0 z-50 bg-[#0B3541] border border-[#0F4A5E] rounded-xl p-2 flex flex-wrap gap-1 w-48 shadow-xl">
                  {EMOJI_SET.map(e => (
                    <button key={e} onClick={() => { editor?.commands.insertContent(e); setShowEmoji(false) }} className="text-lg hover:scale-125 transition-transform p-1">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono ${charCount > MAX_CHARS * 0.9 ? 'text-amber-400' : 'text-[#7FA3AB]'}`}>
              {charCount}/{MAX_CHARS}
            </span>
            <button onClick={saveDraft} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F4A5E] hover:bg-[#0F4A5E]/80 text-[#EDF7F6] rounded-lg text-xs font-medium transition-colors">
              <Save className="size-3.5" /> Draft
            </button>
            <button
              onClick={() => void publish('published')}
              disabled={publishing || uploading || charCount > MAX_CHARS || loadingEdit}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2EE6B8] hover:bg-[#2EE6B8]/90 text-[#031F28] rounded-lg text-xs font-bold disabled:opacity-40 transition-colors shadow-[0_0_12px_rgba(46,230,184,0.25)]"
            >
              {(publishing || uploading || loadingEdit) ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              {editPostId ? 'Update Post' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
