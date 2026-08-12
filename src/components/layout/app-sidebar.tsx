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
  LogOut,
  User,
  PlusSquare,
  ClipboardList,
  Activity,
  History,
  Rss,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
}

export function AppSidebar({ collapsed, onToggle, onNavigate }: AppSidebarProps) {
  const { profile, user, signOut } = useAuth()
  const location = useLocation()

  const isSuperAdmin = profile?.role === 'super_admin'
  const isCreator = profile?.role === 'election_creator'

  const navItems = isSuperAdmin ? [
    { label: 'Dashboard', icon: LayoutGrid, path: ROUTES.admin },
    { label: 'Election Applications', icon: FileSignature, path: ROUTES.adminCreators },
    { label: 'Elections', icon: Vote, path: ROUTES.adminElections },
    { label: 'Users', icon: Users, path: ROUTES.adminUsers },
    { label: 'Activity & Security', icon: Shield, path: ROUTES.adminAudit },
    { label: 'Social Feed | My Profile', icon: Rss, path: ROUTES.adminSocial },
    { label: 'Content Moderation', icon: Shield, path: ROUTES.adminSocialModeration },
    { label: 'Notifications', icon: Bell, path: ROUTES.notifications },
    { label: 'Settings', icon: Settings, path: ROUTES.settings },
  ] : isCreator ? [
    { label: 'Dashboard', icon: LayoutGrid, path: ROUTES.creatorDashboard },
    { label: 'Elections', icon: ClipboardList, path: ROUTES.electionsManage },
    { label: 'Create Election', icon: PlusSquare, path: ROUTES.electionNew },
    { label: 'Results & Analytics', icon: Activity, path: ROUTES.creatorAnalytics || '/analytics' },
    { label: 'Social Feed | My Profile', icon: Rss, path: ROUTES.creatorSocial },
    { label: 'Notifications', icon: Bell, path: ROUTES.notifications },
    { label: 'Settings', icon: Settings, path: ROUTES.settings },
  ] : [
    { label: 'Dashboard', icon: LayoutGrid, path: ROUTES.dashboard },
    { label: 'Browse Elections', icon: Vote, path: ROUTES.elections },
    { label: 'My Votes', icon: History, path: ROUTES.myVotes },
    { label: 'Social Feed | My Profile', icon: Rss, path: ROUTES.voterSocial },
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
          const isActive = location.pathname === item.path
          const Icon = item.icon
          return (
            <Link
              key={`${item.path}_${item.label}`}
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
