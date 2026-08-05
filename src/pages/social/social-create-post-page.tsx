import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PostComposer } from '@/components/social/post-composer'

export function SocialCreatePostPage() {
  const [params]    = useSearchParams()
  const navigate    = useNavigate()
  const draftId     = params.get('draft') ?? undefined

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-32 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[#7FA3AB] hover:text-[#2EE6B8] text-sm font-medium transition-colors">
        <ArrowLeft className="size-4" /> Back
      </button>
      <h1 className="text-xl font-black text-[#EDF7F6]">Create Post</h1>
      <PostComposer
        initialDraftId={draftId}
        onSuccess={(id) => navigate(`/social/posts/${id}`)}
      />
    </div>
  )
}
