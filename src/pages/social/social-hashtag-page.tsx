import * as React from 'react'
import { useParams }   from 'react-router-dom'
import { Hash }        from 'lucide-react'
import { PostCard }    from '@/components/social/post-card'
import { socialSearchService } from '@/services/social.service'
import type { SocialPost }     from '@/types/social'

export function SocialHashtagPage() {
  const { tag }              = useParams<{ tag: string }>()
  const [posts,   setPosts]  = React.useState<SocialPost[]>([])
  const [loading, setLoading]= React.useState(true)
  const [cursor,  setCursor] = React.useState<string | undefined>()
  const [hasMore, setHasMore]= React.useState(true)

  const load = React.useCallback(async (reset = false) => {
    if (!tag) return
    setLoading(true)
    const data = await socialSearchService.getPostsByHashtag(tag, reset ? undefined : cursor)
    setPosts(prev => reset ? data : [...prev, ...data])
    if (data.length > 0) setCursor(data[data.length - 1].published_at)
    setHasMore(data.length === 20)
    setLoading(false)
  }, [tag, cursor])

  React.useEffect(() => { void load(true) }, [tag])

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-32 space-y-5">
      <div className="flex items-center gap-2">
        <Hash className="size-5 text-[#F5A15C]" />
        <h1 className="text-xl font-black text-[#EDF7F6]">#{tag}</h1>
        <span className="text-xs text-[#7FA3AB] ml-auto">{posts.length} posts</span>
      </div>

      <div className="space-y-4">
        {loading && posts.length === 0
          ? Array.from({length: 3}).map((_, i) => <div key={i} className="h-32 bg-[#0B3541] border border-[#0F4A5E] rounded-2xl animate-pulse" />)
          : posts.map(p => <PostCard key={p.id} post={p} />)
        }
        {!loading && posts.length === 0 && (
          <p className="text-center text-[#7FA3AB] py-12">No posts tagged #{tag} yet.</p>
        )}
        {hasMore && posts.length > 0 && (
          <button onClick={() => load(false)} disabled={loading} className="w-full py-3 text-sm text-[#7FA3AB] hover:text-[#2EE6B8] border border-[#0F4A5E] rounded-xl transition-all">
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}
