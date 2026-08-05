import * as React from 'react'
import { Bookmark } from 'lucide-react'
import { PostCard } from '@/components/social/post-card'
import { useAuth }  from '@/contexts/auth-context'
import { socialBookmarksService } from '@/services/social.service'
import type { SocialPost } from '@/types/social'

export function SocialBookmarksPage() {
  const { user }       = useAuth()
  const [posts,    setPosts]   = React.useState<SocialPost[]>([])
  const [loading,  setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!user) return
    void socialBookmarksService.getBookmarks(user.id).then(data => {
      setPosts(data)
      setLoading(false)
    })
  }, [user])

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-32 space-y-5">
      <div className="flex items-center gap-2">
        <Bookmark className="size-5 text-[#F5A15C]" />
        <h1 className="text-xl font-black text-[#EDF7F6]">Bookmarks</h1>
        <span className="text-xs text-[#7FA3AB] ml-auto">{posts.length} saved</span>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-[#0B3541] border border-[#0F4A5E] rounded-2xl animate-pulse" />
        ))
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-[#7FA3AB]">
          <Bookmark className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bookmarks yet.</p>
          <p className="text-xs mt-1">Save posts to read them later.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} onDelete={id => setPosts(p => p.filter(x => x.id !== id))} />
          ))}
        </div>
      )}
    </div>
  )
}
