import {
  Bell,
  LayoutGrid,
  Settings,
  Users,
  Vote,
  Shield,
  FileSignature,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  User,
  PlusSquare,
  ClipboardList,
  Activity,
  History,
  Rss,
  Home,
  Search,
  TrendingUp,
  Bookmark,
  FileEdit,
  Plus,
  Globe,
  Newspaper,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
}

const socialSubItems = [
  { label: 'My Posts (Portal)', icon: Home, path: ROUTES.social },
  { label: 'Community Feed', icon: Globe, path: ROUTES.communityFeed },
  { label: 'Daily News', icon: Newspaper, path: ROUTES.socialNews },
  { label: 'Search', icon: Search, path: ROUTES.socialSearch },
  { label: 'Trending', icon: TrendingUp, path: ROUTES.socialTrending },
  { label: 'Bookmarks', icon: Bookmark, path: ROUTES.socialBookmarks },
  { label: 'Drafts', icon: FileEdit, path: ROUTES.socialDrafts },
  { label: 'Following', icon: Users, path: ROUTES.socialFollowing },
  { label: 'Notifications', icon: Bell, path: ROUTES.socialNotifications },
  { label: 'Create Post', icon: Plus, path: ROUTES.socialCreate },
]

export function AppSidebar({ collapsed, onToggle, onNavigate }: AppSidebarProps) {
  const { profile, user, signOut } = useAuth()
  const location = useLocation()

  const isSocialRoute = location.pathname.startsWith('/social')
  const [socialOpen, setSocialOpen] = useState(() => isSocialRoute)

  useEffect(() => {
    if (isSocialRoute) {
      setSocialOpen(true)
    }
  }, [isSocialRoute])

  const isSuperAdmin = profile?.role === 'super_admin'
  const isCreator = profile?.role === 'election_creator'

  const navItems = isSuperAdmin ? [
    { label: 'Dashboard', icon: LayoutGrid, path: ROUTES.admin },
    { label: 'Election Applications', icon: FileSignature, path: ROUTES.adminCreators },
    { label: 'Elections', icon: Vote, path: ROUTES.adminElections },
    { label: 'Users', icon: Users, path: ROUTES.adminUsers },
    { label: 'Activity & Security', icon: Shield, path: ROUTES.adminAudit },
    { label: 'Social Feed', icon: Rss, isDropdown: true },
    { label: 'Content Moderation', icon: Shield, path: ROUTES.adminSocialModeration },
    { label: 'Notifications', icon: Bell, path: ROUTES.notifications },
    { label: 'Settings', icon: Settings, path: ROUTES.settings },
  ] : isCreator ? [
    { label: 'Dashboard', icon: LayoutGrid, path: ROUTES.creatorDashboard },
    { label: 'Elections', icon: ClipboardList, path: ROUTES.electionsManage },
    { label: 'Create Election', icon: PlusSquare, path: ROUTES.electionNew },
    { label: 'Results & Analytics', icon: Activity, path: ROUTES.creatorAnalytics || '/analytics' },
    { label: 'Social Feed', icon: Rss, isDropdown: true },
    { label: 'Notifications', icon: Bell, path: ROUTES.notifications },
    { label: 'Settings', icon: Settings, path: ROUTES.settings },
  ] : [
    { label: 'Dashboard', icon: LayoutGrid, path: ROUTES.dashboard },
    { label: 'Browse Elections', icon: Vote, path: ROUTES.elections },
    { label: 'My Votes', icon: History, path: ROUTES.myVotes },
    { label: 'Social Feed', icon: Rss, isDropdown: true },
    { label: 'Notifications', icon: Bell, path: ROUTES.notifications },
    { label: 'Settings', icon: Settings, path: ROUTES.settings },
  ]

  return (
    <div className="flex h-full flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] text-[var(--text-muted)] overflow-hidden relative">
      <div className={cn("flex h-20 items-center relative z-10 border-b border-[var(--border)]", collapsed ? "justify-center" : "px-6 justify-between")}>
        <Link to={ROUTES.dashboard} className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}>
          <div className="size-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo.png" alt="SecureVote" className="size-full object-contain" />
          </div>
          {!collapsed && <span className="text-xl font-bold tracking-tight text-[var(--text-heading)]">Secure<span className="text-[var(--accent-primary)]">Vote</span></span>}
        </Link>
        {!collapsed && onToggle && (
          <Button variant="ghost" size="icon" className="size-8 text-[var(--text-muted)] hover:text-[var(--text-heading)]" onClick={onToggle}>
             <ChevronLeft className="size-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto no-scrollbar relative z-10">
        {collapsed && onToggle && (
          <div className="flex justify-center mb-4">
            <Button variant="ghost" size="icon" className="size-8 text-[var(--text-muted)] hover:text-[var(--text-heading)]" onClick={onToggle}>
               <ChevronRight className="size-5" />
            </Button>
          </div>
        )}
        {navItems.map((item) => {
          if (item.isDropdown) {
            // Render Social Feed Dropdown
            if (collapsed) {
              return (
                <DropdownMenu key="social-feed-dropdown">
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "sidebar-item justify-center px-0 w-full cursor-pointer",
                        isSocialRoute && "sidebar-item-active"
                      )}
                      title="Social Feed"
                    >
                      <Rss className={cn("size-5 shrink-0", isSocialRoute ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]")} strokeWidth={isSocialRoute ? 2.5 : 2} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-52 rounded-xl bg-[var(--card)] border border-[var(--border)] p-1.5 shadow-xl text-[var(--foreground)] z-50">
                    <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Social Feed
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[var(--border)] my-1" />
                    {socialSubItems.map((sub) => {
                      const isSubActive = location.pathname === sub.path
                      const SubIcon = sub.icon
                      return (
                        <DropdownMenuItem key={sub.path} asChild>
                          <Link
                            to={sub.path}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors",
                              isSubActive
                                ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-semibold"
                                : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                            )}
                          >
                            <SubIcon className="size-4 shrink-0" />
                            <span>{sub.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }

            return (
              <div key="social-feed-collapsible" className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setSocialOpen((prev) => !prev)}
                  className={cn(
                    "sidebar-item w-full justify-between cursor-pointer",
                    isSocialRoute && "sidebar-item-active"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Rss className={cn("size-5 shrink-0", isSocialRoute ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]")} strokeWidth={isSocialRoute ? 2.5 : 2} />
                    <span className="truncate tracking-tight font-medium">Social Feed</span>
                  </div>
                  <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200 text-[var(--text-muted)]", socialOpen && "rotate-180")} />
                </button>

                {socialOpen && (
                  <div className="ml-4 pl-3 border-l border-[var(--border)] mt-1 space-y-1">
                    {socialSubItems.map((sub) => {
                      const isSubActive = location.pathname === sub.path
                      const SubIcon = sub.icon
                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                            isSubActive
                              ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-semibold"
                              : "text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-white/[0.04]"
                          )}
                        >
                          <SubIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = location.pathname === item.path
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path!}
              onClick={onNavigate}
              className={cn(
                "sidebar-item",
                isActive && "sidebar-item-active",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn("size-5 shrink-0", isActive ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]")} strokeWidth={isActive ? 2.5 : 2} />
              {!collapsed && <span className="truncate tracking-tight">{item.label}</span>}
            </Link>
          )
        })}
      </div>

      <div className="p-4 relative z-10 border-t border-[var(--border)]">
        {user ? (
          <div className={cn("flex items-center rounded-xl hover:bg-white/[0.04] transition-colors group cursor-pointer", collapsed ? "justify-center p-2" : "p-3 gap-3")} onClick={() => void signOut()} title={collapsed ? "Log Out" : undefined}>
            <div className="size-10 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
               {profile?.full_name ? <span className="text-sm font-semibold text-[var(--foreground)]">{profile.full_name[0]}</span> : <User className="size-4 text-[var(--muted-foreground)]" />}
            </div>
            {!collapsed && (
              <>
                <div className="flex flex-1 flex-col truncate">
                  <span className="text-sm font-medium text-[var(--foreground)] truncate leading-none">{profile?.full_name || 'User'}</span>
                  <span className="text-xs text-[var(--muted-foreground)] mt-1 capitalize">{profile?.role?.replace('_', ' ')}</span>
                </div>
                <Button variant="ghost" size="icon" className="size-8 rounded-lg text-[var(--muted-foreground)] hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <LogOut className="size-4" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button asChild variant="outline" className={cn("w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)]", collapsed ? "p-0" : "")}>
            <Link to={ROUTES.login} className="flex items-center justify-center gap-2">
              <User className="size-4" />
              {!collapsed && <span>Sign In</span>}
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
