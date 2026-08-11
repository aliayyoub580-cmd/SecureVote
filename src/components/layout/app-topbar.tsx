import { Bell, LogOut, Moon, Sun, Settings, User, Globe, Rss, ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ROUTES, APP_NAME } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { NotificationPopover } from './notification-popover'

export function AppTopbar() {
  const { profile, user } = useAuth()
  const { resolved, setTheme } = useTheme()
  const location = useLocation()

  return (
    <div className="flex h-full w-full items-center justify-end lg:justify-between">
      {/* 1. Left: Welcome Message — desktop only */}
      <div className="hidden lg:flex flex-col min-w-0">
        <h2 className="text-base lg:text-lg font-semibold text-[var(--foreground)] tracking-tight leading-none truncate">
          {user ? `Welcome back, ${profile?.full_name?.split(' ')[0] || 'User'}` : `Welcome to ${APP_NAME}`}
        </h2>
        <span className="text-xs font-medium text-[var(--muted-foreground)] mt-1 capitalize hidden sm:block">
          {user ? profile?.role?.replace('_', ' ') : 'Cryptographic Voting Node'}
        </span>
      </div>

      {/* 2. Right: Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Visit Public Site Button */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="hidden sm:flex h-9 px-3 gap-2 rounded-xl border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-bold shadow-sm transition-all"
        >
          <Link to={ROUTES.landing}>
            <Globe className="size-3.5 text-[var(--accent-primary)] shrink-0" />
            <span>Visit Site</span>
            <ExternalLink className="size-3 text-[var(--muted-foreground)] opacity-70" />
          </Link>
        </Button>


        {/* Theme Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--card)] border border-[var(--border)]">
           <Button 
             variant="ghost" 
             size="icon" 
             className={cn(
               "size-8 rounded-md transition-all",
               resolved === 'light' 
                 ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" 
                 : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
             )}
             onClick={() => setTheme('light')}
             aria-label="Light theme"
           >
             <Sun className="size-4" />
           </Button>
           <Button 
             variant="ghost" 
             size="icon" 
             className={cn(
               "size-8 rounded-md transition-all",
               resolved === 'dark' 
                 ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" 
                 : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
             )}
             onClick={() => setTheme('dark')}
             aria-label="Dark theme"
           >
             <Moon className="size-4" />
           </Button>
        </div>

        {user ? (
          <>
            <NotificationPopover />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 p-0 rounded-full hover:bg-transparent overflow-hidden">
                  <div className="size-full bg-[var(--primary)] flex items-center justify-center text-white font-medium text-sm">
                    {profile?.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] shadow-xl">
                <DropdownMenuLabel className="font-medium text-[var(--foreground)] text-xs">Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--border)]" />
                <DropdownMenuItem asChild className="focus:bg-[var(--muted)] focus:text-[var(--foreground)] rounded-lg cursor-pointer">
                  <Link to={ROUTES.landing} className="flex items-center gap-2">
                    <Globe className="size-4 text-[var(--accent-primary)]" />
                    <span>Visit Public Site</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-[var(--muted)] focus:text-[var(--foreground)] rounded-lg cursor-pointer">
                  <Link to={ROUTES.social} className="flex items-center gap-2">
                    <Rss className="size-4 text-emerald-400" />
                    <span>Community Social Feed</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--border)]" />
                <DropdownMenuItem asChild className="focus:bg-[var(--muted)] focus:text-[var(--foreground)] rounded-lg cursor-pointer">
                  <Link to={ROUTES.settings}>Settings & Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--border)]" />
                <DropdownMenuItem className="text-rose-500 focus:bg-rose-500/10 focus:text-rose-500 rounded-lg cursor-pointer" onClick={() => void supabase.auth.signOut()}>
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button asChild variant="outline" className="h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-wider border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)]">
            <Link to={ROUTES.login}>Sign In</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
