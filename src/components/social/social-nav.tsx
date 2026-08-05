import { NavLink }  from 'react-router-dom'
import { Home, Search, Bell, Bookmark, FileEdit, Plus, Users, TrendingUp } from 'lucide-react'
import { useAuth }   from '@/contexts/auth-context'
import { useSocialNotifications } from '@/hooks/use-social-notifications'

const NAV = [
  { to: '/social',            Icon: Home,       label: 'Feed'       },
  { to: '/social/search',     Icon: Search,     label: 'Search'     },
  { to: '/social/trending',   Icon: TrendingUp, label: 'Trending'   },
  { to: '/social/bookmarks',  Icon: Bookmark,   label: 'Bookmarks'  },
  { to: '/social/drafts',     Icon: FileEdit,   label: 'Drafts'     },
  { to: '/social/following',  Icon: Users,      label: 'Following'  },
]

export function SocialNav() {
  const { user } = useAuth()
  const { unreadCount } = useSocialNotifications(user?.id)

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/social'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
            ${isActive
              ? 'bg-[#2EE6B8]/10 text-[#2EE6B8] border border-[#2EE6B8]/20'
              : 'text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E]'
            }`
          }
        >
          <Icon className="size-4 flex-shrink-0" />
          <span>{label}</span>
        </NavLink>
      ))}

      {/* Notifications */}
      <NavLink
        to="/social/notifications"
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
          ${isActive
            ? 'bg-[#2EE6B8]/10 text-[#2EE6B8] border border-[#2EE6B8]/20'
            : 'text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E]'
          }`
        }
      >
        <div className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 size-3.5 bg-[#2EE6B8] rounded-full text-[8px] font-bold text-[#031F28] flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-auto px-1.5 py-0.5 bg-[#2EE6B8] text-[#031F28] text-[9px] font-bold rounded-full">{unreadCount}</span>
        )}
      </NavLink>

      {/* Create post CTA */}
      <NavLink
        to="/social/create"
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all bg-[#2EE6B8] text-[#031F28] hover:bg-[#2EE6B8]/90 shadow-[0_0_12px_rgba(46,230,184,0.2)] mt-2"
      >
        <Plus className="size-4" />
        <span>Create Post</span>
      </NavLink>
    </nav>
  )
}
