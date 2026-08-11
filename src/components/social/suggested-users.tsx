import * as React from 'react'
import { Sparkles, UserPlus, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { socialInteractionsService } from '@/services/social.service'
import { AuthGuardModal, useAuthGuard } from './auth-guard-modal'
import { toast } from '@/lib/toast'

interface SuggestedUser {
  id: string
  username: string
  full_name: string
  avatar_path?: string
  role?: string
  is_following?: boolean
}

export function SuggestedUsers() {
  const { user } = useAuth()
  const { guard, modalOpen, modalAction, closeModal } = useAuthGuard(user?.id)
  const [users, setUsers] = React.useState<SuggestedUser[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadSuggested() {
      try {
        setLoading(true)
        let q = supabase
          .from('profiles')
          .select('id, username, full_name, avatar_path, role')
          .limit(5)

        if (user?.id) {
          q = q.neq('id', user.id)
        }

        const { data, error } = await q
        if (error || !data) return

        let followedSet = new Set<string>()
        if (user?.id && data.length > 0) {
          const targetIds = data.map(u => u.id)
          const { data: followsData } = await supabase
            .from('follows')
            .select('followee_id')
            .eq('follower_id', user.id)
            .in('followee_id', targetIds)

          if (followsData) {
            followedSet = new Set(followsData.map(f => f.followee_id))
          }
        }

        setUsers(
          data.map(u => ({
            ...u,
            is_following: followedSet.has(u.id),
          }))
        )
      } catch (err) {
        console.error('Error loading suggested users:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadSuggested()
  }, [user?.id])

  const handleFollowToggle = (targetId: string, currentStatus?: boolean) => {
    guard('follow this user', async () => {
      setUsers(prev =>
        prev.map(u => (u.id === targetId ? { ...u, is_following: !currentStatus } : u))
      )
      try {
        await socialInteractionsService.toggleFollow(user!.id, targetId)
        toast.success(currentStatus ? 'Unfollowed user' : 'Following user')
      } catch {
        setUsers(prev =>
          prev.map(u => (u.id === targetId ? { ...u, is_following: currentStatus } : u))
        )
        toast.error('Action failed')
      }
    })
  }

  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3 animate-pulse">
        <div className="flex justify-between items-center mb-2">
          <div className="h-4 bg-[var(--muted)] rounded w-32" />
          <div className="size-4 bg-[var(--muted)] rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 bg-[var(--muted)] rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[var(--muted)] rounded w-24" />
                <div className="h-2 bg-[var(--muted)] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (users.length === 0) return null

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
      <AuthGuardModal open={modalOpen} action={modalAction} onClose={closeModal} />
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
        <h3 className="text-sm font-bold text-[var(--foreground)] tracking-tight flex items-center gap-2">
          Suggested Users
        </h3>
        <Sparkles className="size-4 text-[var(--accent-primary)]" />
      </div>

      {/* User list */}
      <div className="divide-y divide-[var(--border)]">
        {users.map(u => {
          const initials = (u.full_name || u.username || 'U')
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase()

          return (
            <div key={u.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group">
              <Link to={`/social/profile/${u.username}`} className="flex items-center gap-3 min-w-0 flex-1">
                <div className="size-10 rounded-full bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)] font-bold text-xs shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-xs">
                  {u.avatar_path ? (
                    <img src={u.avatar_path} alt={u.full_name} className="size-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-[var(--foreground)] truncate group-hover:text-[var(--accent-primary)] transition-colors leading-tight">
                    {u.full_name || u.username}
                  </h4>
                  <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">@{u.username}</p>
                </div>
              </Link>

              {user?.id !== u.id && (
                <button
                  type="button"
                  onClick={() => handleFollowToggle(u.id, u.is_following)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                    u.is_following
                      ? 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-rose-500 hover:bg-rose-500/10'
                      : 'bg-[var(--accent-primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-xs'
                  }`}
                >
                  {u.is_following ? (
                    <>
                      <UserCheck className="size-3.5" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
