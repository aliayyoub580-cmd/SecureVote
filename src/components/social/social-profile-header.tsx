/**
 * SocialProfileHeader — shown at the top of the Social Feed for logged-in users.
 * Displays the current user's cover image, avatar, name, username, bio,
 * follower/following/post counts, and Edit Profile + Create Post buttons.
 * All data comes from the live Supabase profile — nothing is hardcoded.
 */
import * as React from 'react'
import { Link }   from 'react-router-dom'
import { MapPin, Link as LinkIcon, Settings, Plus, UserCheck } from 'lucide-react'

import { SocialAvatar } from './avatar'
import { RoleBadge }    from './role-badge'
import { supabase }     from '@/lib/supabase/client'
import { useAuth }      from '@/contexts/auth-context'
import type { SocialProfile } from '@/types/social'

interface SocialProfileHeaderProps {
  onCreatePost: () => void
}

export function SocialProfileHeader({ onCreatePost }: SocialProfileHeaderProps) {
  const { user, profile: authProfile } = useAuth()
  const [social, setSocial] = React.useState<SocialProfile | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!user) { setLoading(false); return }
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,username,full_name,bio,website,location,avatar_path,banner_path,role,is_verified,is_suspended,post_count,follower_count,following_count,created_at')
        .eq('id', user.id)
        .maybeSingle()
      setSocial(data as SocialProfile | null)
      setLoading(false)
    })()
  }, [user])

  if (!user) return null

  // While loading, show a compact skeleton
  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden animate-pulse mb-6">
        <div className="h-28 bg-[var(--muted)]" />
        <div className="px-5 pb-4 pt-10 space-y-2">
          <div className="h-4 bg-[var(--muted)] rounded w-40" />
          <div className="h-3 bg-[var(--muted)] rounded w-28" />
        </div>
      </div>
    )
  }

  const name       = social?.full_name ?? authProfile?.full_name ?? 'User'
  const username   = (social as any)?.username ?? user.email?.split('@')[0] ?? 'user'
  const bio        = social?.bio
  const location   = social?.location
  const website    = social?.website
  const avatar     = social?.avatar_path ?? (authProfile as any)?.avatar_path
  const banner     = social?.banner_path
  const role       = social?.role ?? authProfile?.role ?? 'voter'
  const verified   = social?.is_verified ?? false
  const followers  = social?.follower_count  ?? 0
  const following  = social?.following_count ?? 0
  const postCount  = social?.post_count      ?? 0

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden mb-6 shadow-sm">
      {/* Banner */}
      <div className="relative h-28 sm:h-36 bg-gradient-to-r from-[var(--accent-primary)]/20 via-[var(--accent-primary)]/10 to-[var(--card)] overflow-hidden">
        {banner ? (
          <img src={banner} alt="cover" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          // Decorative pattern when no banner
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 left-8 size-20 rounded-full bg-[var(--accent-primary)] blur-2xl" />
            <div className="absolute bottom-2 right-16 size-16 rounded-full bg-[var(--accent-secondary)] blur-2xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)]/60 via-transparent" />
      </div>

      {/* Body */}
      <div className="relative px-4 sm:px-5 pb-4">
        {/* Avatar — overlaps banner */}
        <div className="flex items-end justify-between -mt-8 sm:-mt-10 mb-3">
          <div className="ring-4 ring-[var(--card)] rounded-full inline-block">
            <SocialAvatar src={avatar} name={name} size="xl" verified={verified} />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-2">
            <Link
              to="/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--muted)] border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] hover:border-[var(--accent-primary)]/40 hover:text-[var(--accent-primary)] transition-all"
            >
              <Settings className="size-3.5" />
              <span className="hidden sm:inline">Edit Profile</span>
            </Link>
            <button
              type="button"
              onClick={onCreatePost}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--primary-foreground)] text-xs font-bold hover:opacity-90 transition-all shadow-sm"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Create Post</span>
            </button>
          </div>
        </div>

        {/* Name + role */}
        <div className="flex items-center flex-wrap gap-2 mb-0.5">
          <h2 className="text-base font-black text-[var(--foreground)] tracking-tight">{name}</h2>
          <RoleBadge role={role as any} />
          {verified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-[10px] font-bold border border-[var(--accent-primary)]/20">
              <UserCheck className="size-2.5" /> Verified
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mb-2">@{username}</p>

        {bio && (
          <p className="text-xs sm:text-sm text-[var(--foreground)]/80 leading-relaxed mb-3 max-w-lg">{bio}</p>
        )}

        {/* Location / website */}
        {(location || website) && (
          <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)] mb-3">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />{location}
              </span>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
              >
                <LinkIcon className="size-3" />{website}
              </a>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs">
          <Link to={`/social/profile/${username}/following`} className="hover:text-[var(--accent-primary)] transition-colors">
            <span className="font-bold text-[var(--foreground)] text-sm">{following}</span>
            <span className="text-[var(--muted-foreground)] ml-1">Following</span>
          </Link>
          <Link to={`/social/profile/${username}/followers`} className="hover:text-[var(--accent-primary)] transition-colors">
            <span className="font-bold text-[var(--foreground)] text-sm">{followers}</span>
            <span className="text-[var(--muted-foreground)] ml-1">Followers</span>
          </Link>
          <span>
            <span className="font-bold text-[var(--foreground)] text-sm">{postCount}</span>
            <span className="text-[var(--muted-foreground)] ml-1">Posts</span>
          </span>
        </div>
      </div>
    </div>
  )
}
