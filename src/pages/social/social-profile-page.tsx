import * as React from 'react'
import { useParams, Link }   from 'react-router-dom'
import { MapPin, Link as LinkIcon, Calendar, UserPlus, UserMinus, Settings } from 'lucide-react'
import { format }            from 'date-fns'

import { PostCard }           from '@/components/social/post-card'
import { SocialAvatar }       from '@/components/social/avatar'
import { RoleBadge }          from '@/components/social/role-badge'
import { useAuth }            from '@/contexts/auth-context'
import {
  socialProfilesService, socialPostsService, socialInteractionsService,
} from '@/services/social.service'
import { toast } from '@/lib/toast'
import type { SocialProfile, SocialPost } from '@/types/social'

const TABS = ['Posts', 'Media', 'Likes', 'Bookmarks'] as const
type Tab = typeof TABS[number]

export function SocialProfilePage() {
  const { username }          = useParams<{ username: string }>()
  const { user }          = useAuth()
  const [profile,  setProfile]  = React.useState<SocialProfile | null>(null)
  const [posts,    setPosts]    = React.useState<SocialPost[]>([])
  const [tab,      setTab]      = React.useState<Tab>('Posts')
  const [loading,  setLoading]  = React.useState(true)
  const [following, setFollowing] = React.useState(false)

  const isOwn = user?.id === profile?.id

  React.useEffect(() => {
    if (!username) return
    void (async () => {
      setLoading(true)
      try {
        const [prof, userPosts] = await Promise.all([
          socialProfilesService.getByUsername(username, user?.id),
          socialPostsService.getByUsername(username),
        ])
        setProfile(prof)
        setPosts(userPosts)
        setFollowing(prof?.is_following ?? false)
      } finally { setLoading(false) }
    })()
  }, [username, user?.id])

  const handleFollow = async () => {
    if (!user || !profile) return
    const nowFollowing = await socialInteractionsService.toggleFollow(user.id, profile.id)
    setFollowing(nowFollowing)
    setProfile(p => p ? { ...p, follower_count: p.follower_count + (nowFollowing ? 1 : -1), is_following: nowFollowing } : p)
    toast.success(nowFollowing ? `Following @${username}` : `Unfollowed @${username}`)
  }

  if (loading) return (
    <div className="mx-auto max-w-2xl px-4 pt-6 animate-pulse space-y-4">
      <div className="h-40 bg-[#0B3541] rounded-2xl" />
      <div className="h-24 bg-[#0B3541] rounded-2xl" />
    </div>
  )

  if (!profile) return (
    <div className="text-center py-24 text-[#7FA3AB]">
      <p className="font-medium">User not found.</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32">
      {/* Banner */}
      <div className="relative h-40 bg-gradient-to-r from-[#031F28] to-[#0F4A5E] rounded-2xl overflow-hidden mb-0 border border-[#0F4A5E]">
        {profile.banner_path && (
          <img src={profile.banner_path} alt="banner" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#031F28]/80 via-transparent" />
      </div>

      {/* Profile card */}
      <div className="bg-[#0B3541] border border-[#0F4A5E] rounded-2xl p-5 -mt-6 relative z-10 mb-5">
        <div className="flex items-start justify-between mb-3">
          <div className="-mt-14">
            <div className="ring-4 ring-[#0B3541] rounded-full inline-block">
              <SocialAvatar src={profile.avatar_path} name={profile.full_name} size="xl" verified={profile.is_verified} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {isOwn ? (
              <Link to="/settings" className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0F4A5E] hover:bg-[#0F4A5E]/80 text-[#EDF7F6] rounded-lg text-xs font-medium transition-colors">
                <Settings className="size-3.5" /> Edit Profile
              </Link>
            ) : user ? (
              <button onClick={handleFollow} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                following
                  ? 'bg-[#0F4A5E] text-[#EDF7F6] hover:bg-rose-500/20 hover:text-rose-400'
                  : 'bg-[#2EE6B8] text-[#031F28] hover:bg-[#2EE6B8]/90 shadow-[0_0_10px_rgba(46,230,184,0.2)]'
              }`}>
                {following ? <><UserMinus className="size-3.5" /> Unfollow</> : <><UserPlus className="size-3.5" /> Follow</>}
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex items-center flex-wrap gap-2 mb-0.5">
            <h1 className="text-lg font-black text-[#EDF7F6]">{profile.full_name ?? profile.username}</h1>
            <RoleBadge role={profile.role} />
          </div>
          <p className="text-sm text-[#7FA3AB] mb-2">@{profile.username}</p>
          {profile.bio && <p className="text-sm text-[#EDF7F6]/80 mb-3 leading-relaxed">{profile.bio}</p>}

          <div className="flex flex-wrap gap-3 text-xs text-[#7FA3AB] mb-3">
            {profile.location  && <span className="flex items-center gap-1"><MapPin className="size-3" />{profile.location}</span>}
            {profile.website   && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#2EE6B8] hover:underline"><LinkIcon className="size-3" />{profile.website}</a>}
            {profile.joined_at && <span className="flex items-center gap-1"><Calendar className="size-3" />Joined {format(new Date(profile.joined_at), 'MMM yyyy')}</span>}
          </div>

          <div className="flex gap-4 text-sm">
            <Link to={`/social/profile/${profile.username}/following`} className="hover:text-[#2EE6B8] transition-colors">
              <span className="font-bold text-[#EDF7F6]">{profile.following_count}</span>
              <span className="text-[#7FA3AB] ml-1">Following</span>
            </Link>
            <Link to={`/social/profile/${profile.username}/followers`} className="hover:text-[#2EE6B8] transition-colors">
              <span className="font-bold text-[#EDF7F6]">{profile.follower_count}</span>
              <span className="text-[#7FA3AB] ml-1">Followers</span>
            </Link>
            <span>
              <span className="font-bold text-[#EDF7F6]">{profile.post_count}</span>
              <span className="text-[#7FA3AB] ml-1">Posts</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0B3541] border border-[#0F4A5E] rounded-xl p-1 mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-[#2EE6B8] text-[#031F28]' : 'text-[#7FA3AB] hover:text-[#EDF7F6]'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Posts list */}
      <div className="space-y-4">
        {tab === 'Posts' && posts.map(post => (
          <PostCard key={post.id} post={post} onDelete={id => setPosts(p => p.filter(x => x.id !== id))} />
        ))}
        {tab === 'Posts' && posts.length === 0 && (
          <p className="text-center text-[#7FA3AB] py-12 text-sm">No posts yet.</p>
        )}
        {tab !== 'Posts' && (
          <p className="text-center text-[#7FA3AB] py-12 text-sm">Coming soon.</p>
        )}
      </div>
    </div>
  )
}
