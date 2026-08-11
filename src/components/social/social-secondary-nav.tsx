import { NavLink, Link } from 'react-router-dom'
import { Home, Compass, Users, Search, Bookmark, User, Newspaper, Bell, Plus, LogIn } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { useSocialNotifications } from '@/hooks/use-social-notifications'
import { cn } from '@/lib/utils'

const ALL_NAV_ITEMS = [
  { to: ROUTES.social, label: 'Community Feed', icon: Home, end: true, authRequired: false },
  { to: ROUTES.socialTrending, label: 'Trending', icon: Compass, authRequired: false },
  { to: ROUTES.socialFollowing, label: 'Following', icon: Users, authRequired: true },
  { to: ROUTES.socialSearch, label: 'Search', icon: Search, authRequired: false },
  { to: ROUTES.socialBookmarks, label: 'Bookmarks', icon: Bookmark, authRequired: true },
  { to: '/social/my-posts', label: 'My Posts', icon: User, authRequired: true },
  { to: ROUTES.socialNews, label: 'Daily News', icon: Newspaper, authRequired: false },
]

export function SocialSecondaryNav() {
  const { user } = useAuth()
  const { unreadCount } = useSocialNotifications(user?.id)

  const navItems = user
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter(item => !item.authRequired)

  return (
    <div className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-2 shadow-sm mb-6">
      <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5 px-1">
        <div className="flex items-center gap-1.5 min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                    isActive
                      ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 shadow-xs font-bold"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50"
                  )
                }
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}

          {/* Notifications — logged in users only */}
          {user && (
            <NavLink
              to={ROUTES.socialNotifications}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap relative",
                  isActive
                    ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 shadow-xs font-bold"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50"
                )
              }
            >
              <div className="relative flex items-center justify-center">
                <Bell className="size-3.5 shrink-0" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-2 bg-[var(--accent-primary)] rounded-full animate-pulse" />
                )}
              </div>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[var(--accent-primary)] text-[var(--primary-foreground)] text-[10px] font-black">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          )}
        </div>

        {/* CTA Button */}
        {user ? (
          <div className="pl-2 border-l border-[var(--border)] shrink-0">
            <NavLink
              to={ROUTES.socialCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--primary-foreground)] font-bold text-xs hover:opacity-90 transition-all shadow-xs shrink-0"
            >
              <Plus className="size-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Create Post</span>
            </NavLink>
          </div>
        ) : (
          <div className="pl-2 border-l border-[var(--border)] shrink-0">
            <Link
              to={ROUTES.login}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--primary-foreground)] font-bold text-xs hover:opacity-90 transition-all shadow-xs shrink-0"
            >
              <LogIn className="size-3.5" />
              <span className="hidden sm:inline">Sign In to Post</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
