import * as React from 'react'
import { Link }   from 'react-router-dom'
import { Search, TrendingUp, Hash, User } from 'lucide-react'
import { motion } from 'framer-motion'

import { SocialAvatar } from '@/components/social/avatar'
import { RoleBadge }    from '@/components/social/role-badge'
import { PostCard }     from '@/components/social/post-card'
import { socialSearchService } from '@/services/social.service'
import type { SocialProfile, SocialPost } from '@/types/social'

type SearchType = 'all' | 'users' | 'posts' | 'hashtags'

export function SocialSearchPage() {
  const [query,     setQuery]     = React.useState('')
  const [type,      setType]      = React.useState<SearchType>('all')
  const [results,   setResults]   = React.useState<{ users: SocialProfile[]; posts: SocialPost[]; hashtags: {tag:string;post_count:number}[] } | null>(null)
  const [trending,  setTrending]  = React.useState<{tag:string;post_count:number}[]>([])
  const [searching, setSearching] = React.useState(false)

  React.useEffect(() => {
    void socialSearchService.getTrendingHashtags().then(setTrending)
  }, [])

  React.useEffect(() => {
    if (!query.trim()) { setResults(null); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await socialSearchService.search(query, type)
        setResults(data)
      } finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [query, type])

  const TABS: { value: SearchType; label: string }[] = [
    { value: 'all',      label: 'All'      },
    { value: 'users',    label: 'People'   },
    { value: 'posts',    label: 'Posts'    },
    { value: 'hashtags', label: 'Hashtags' },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-32 space-y-5">
      <div className="flex items-center gap-2">
        <Search className="size-5 text-[#2EE6B8]" />
        <h1 className="text-xl font-black text-[#EDF7F6]">Search</h1>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[#7FA3AB]" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search people, posts, #hashtags…"
          className="w-full bg-[#0B3541] border border-[#0F4A5E] rounded-xl pl-10 pr-4 py-3 text-sm text-[#EDF7F6] placeholder:text-[#7FA3AB] focus:outline-none focus:border-[#2EE6B8]/50 transition-colors"
        />
        {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2 size-4 border-2 border-[#2EE6B8] border-t-transparent rounded-full animate-spin" />}
      </div>

      {/* Type tabs */}
      {query.trim() && (
        <div className="flex gap-1 bg-[#0B3541] border border-[#0F4A5E] rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${type === t.value ? 'bg-[#2EE6B8] text-[#031F28]' : 'text-[#7FA3AB] hover:text-[#EDF7F6]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Trending hashtags (when no query) */}
      {!query.trim() && trending.length > 0 && (
        <div className="bg-[#0B3541] border border-[#0F4A5E] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-[#F5A15C]" />
            <h2 className="text-sm font-bold text-[#EDF7F6]">Trending Hashtags</h2>
          </div>
          <div className="space-y-2">
            {trending.map((h, i) => (
              <Link key={h.tag} to={`/social/hashtag/${h.tag}`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#0F4A5E] transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#7FA3AB] w-6">#{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-[#EDF7F6] group-hover:text-[#2EE6B8] transition-colors">#{h.tag}</p>
                    <p className="text-xs text-[#7FA3AB]">{h.post_count} posts</p>
                  </div>
                </div>
                <Hash className="size-3.5 text-[#7FA3AB] group-hover:text-[#2EE6B8] transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          {/* People */}
          {results.users.length > 0 && (
            <div className="bg-[#0B3541] border border-[#0F4A5E] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="size-4 text-[#2EE6B8]" />
                <h2 className="text-sm font-bold text-[#EDF7F6]">People</h2>
              </div>
              <div className="space-y-3">
                {results.users.map(u => (
                  <Link key={u.id} to={`/social/profile/${u.username}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#0F4A5E] transition-colors">
                    <SocialAvatar src={u.avatar_path} name={u.full_name} size="sm" verified={u.is_verified} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#EDF7F6] truncate">{u.full_name ?? u.username}</span>
                        <RoleBadge role={u.role} />
                      </div>
                      <p className="text-xs text-[#7FA3AB]">@{u.username} · {u.follower_count} followers</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {results.hashtags.length > 0 && (
            <div className="bg-[#0B3541] border border-[#0F4A5E] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="size-4 text-[#F5A15C]" />
                <h2 className="text-sm font-bold text-[#EDF7F6]">Hashtags</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {results.hashtags.map(h => (
                  <Link key={h.tag} to={`/social/hashtag/${h.tag}`} className="px-3 py-1.5 bg-[#0F4A5E] hover:bg-[#2EE6B8]/10 hover:border-[#2EE6B8]/30 border border-[#0F4A5E] text-[#EDF7F6] text-xs font-medium rounded-full transition-all">
                    #{h.tag} <span className="text-[#7FA3AB] ml-1">{h.post_count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Posts */}
          {results.posts.length > 0 && (
            <div className="space-y-4">
              {results.posts.map((p: any) => (
                <PostCard key={p.id} post={p} compact />
              ))}
            </div>
          )}

          {results.users.length === 0 && results.posts.length === 0 && results.hashtags.length === 0 && (
            <p className="text-center text-[#7FA3AB] py-12">No results for "{query}"</p>
          )}
        </motion.div>
      )}
    </div>
  )
}
