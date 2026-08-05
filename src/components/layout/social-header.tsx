import * as React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, Home, Compass, Newspaper, Sun, Moon, LogIn, Plus, UserCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { ROUTES } from '@/constants/routes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase/client'

interface SocialHeaderProps {
  onOpenComposer?: () => void
}

export function SocialHeader({ onOpenComposer }: SocialHeaderProps) {
  const { user, profile } = useAuth()
  const { resolved, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = React.useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/social/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'US'

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B3541]/95 backdrop-blur-xl border-b border-[#0F4A5E] shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Links */}
        <div className="flex items-center gap-6 shrink-0">
          <Link to={ROUTES.communityFeed} className="flex items-center gap-3 group">
            <div className="size-9 rounded-xl bg-gradient-to-br from-[#2EE6B8] to-blue-500 flex items-center justify-center text-[#031F28] font-black text-sm shadow-[0_0_12px_rgba(46,230,184,0.3)] group-hover:scale-105 transition-transform">
              V
            </div>
            <div>
              <h1 className="text-base font-black text-[#EDF7F6] leading-none tracking-tight group-hover:text-[#2EE6B8] transition-colors">
                SecureVote Social
              </h1>
              <p className="text-[10px] font-medium text-[#7FA3AB] mt-0.5">Connect. Share. Grow.</p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5 ml-2">
            <Link
              to={ROUTES.communityFeed}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                location.pathname === ROUTES.communityFeed
                  ? 'bg-[#2EE6B8]/15 text-[#2EE6B8] border border-[#2EE6B8]/30'
                  : 'text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E]/60'
              }`}
            >
              <Home className="size-3.5" />
              <span>Home</span>
            </Link>
            <Link
              to={ROUTES.socialTrending}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                location.pathname === ROUTES.socialTrending
                  ? 'bg-[#2EE6B8]/15 text-[#2EE6B8] border border-[#2EE6B8]/30'
                  : 'text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E]/60'
              }`}
            >
              <Compass className="size-3.5" />
              <span>Explore</span>
            </Link>
            <Link
              to={ROUTES.socialNews}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                location.pathname === ROUTES.socialNews
                  ? 'bg-[#2EE6B8]/15 text-[#2EE6B8] border border-[#2EE6B8]/30'
                  : 'text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E]/60'
              }`}
            >
              <Newspaper className="size-3.5 text-[#2EE6B8]" />
              <span>News</span>
            </Link>
            <Link
              to={ROUTES.social}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                location.pathname === ROUTES.social
                  ? 'bg-[#2EE6B8]/15 text-[#2EE6B8] border border-[#2EE6B8]/30'
                  : 'text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E]/60'
              }`}
            >
              <UserCheck className="size-3.5" />
              <span>Portal Posts</span>
            </Link>
          </nav>
        </div>

        {/* Center: Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#7FA3AB]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search users or posts..."
              className="w-full h-9 rounded-xl bg-[#031F28] border border-[#0F4A5E] pl-10 pr-4 text-xs text-[#EDF7F6] placeholder:text-[#7FA3AB] focus:outline-none focus:border-[#2EE6B8] transition-all shadow-inner"
            />
          </div>
        </form>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenComposer && user && (
            <button
              onClick={onOpenComposer}
              className="px-3.5 py-1.5 rounded-xl bg-[#2EE6B8] text-[#031F28] font-bold text-xs hover:bg-[#2EE6B8]/90 shadow-[0_0_12px_rgba(46,230,184,0.25)] flex items-center gap-1.5 transition-all"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Create Post</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E] border border-[#0F4A5E] transition-colors"
            title="Toggle theme"
          >
            {resolved === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {/* User Auth Profile / Login */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="size-9 rounded-full bg-gradient-to-br from-[#2EE6B8] to-blue-500 p-0.5 focus:outline-none shrink-0 shadow-md">
                  <div className="size-full rounded-full bg-[#0B3541] flex items-center justify-center text-[#2EE6B8] font-bold text-xs">
                    {initials}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl bg-[#0B3541] border border-[#0F4A5E] text-[#EDF7F6] shadow-xl p-1">
                <DropdownMenuLabel className="text-xs font-bold text-[#7FA3AB]">
                  {profile?.full_name || 'User Account'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#0F4A5E]" />
                <DropdownMenuItem asChild className="focus:bg-[#0F4A5E] focus:text-[#EDF7F6] rounded-lg cursor-pointer text-xs">
                  <Link to={ROUTES.landing}>Visit Landing Site</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-[#0F4A5E] focus:text-[#EDF7F6] rounded-lg cursor-pointer text-xs">
                  <Link to={ROUTES.dashboard}>Return to Portal</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#0F4A5E]" />
                <DropdownMenuItem className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-400 rounded-lg cursor-pointer text-xs" onClick={() => void supabase.auth.signOut()}>
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to={ROUTES.login}
              className="px-4 py-1.5 rounded-xl bg-[#2EE6B8] text-[#031F28] font-bold text-xs hover:bg-[#2EE6B8]/90 flex items-center gap-1.5 transition-all"
            >
              <LogIn className="size-3.5" />
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
