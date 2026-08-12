import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PostComposer } from '@/components/social/post-composer'

export function SocialEditPostPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) return null

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-32 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[#7FA3AB] hover:text-[#2EE6B8] text-sm font-medium transition-colors">
        <ArrowLeft className="size-4" /> Back
      </button>
      <h1 className="text-xl font-black text-[#EDF7F6]">Edit Post</h1>
      <PostComposer
        editPostId={id}
        onSuccess={() => navigate(`/social/posts/${id}`)}
      />
    </div>
  )
}
