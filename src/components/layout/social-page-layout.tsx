/**
 * SocialPageLayout
 * Top-level shell for all /social/* routes.
 *
 * Guests      → slim branded navbar (Sign In / Join Now) + SocialLayout content
 * Logged-in   → full DashboardLayout shell (sidebar + topbar) + SocialLayout content
 *
 * This component is used as the parent <Route element={<SocialPageLayout />}> wrapper
 * and renders <Outlet /> through the layout chain.
 */
import { Outlet, Link } from 'react-router-dom'
import { Moon, Sun }    from 'lucide-react'
import { useState }     from 'react'

import { useAuth }          from '@/contexts/auth-context'
import { useTheme }         from '@/contexts/theme-context'
import { useMediaQuery }    from '@/hooks/use-media-query'
import { APP_NAME, ROUTES } from '@/constants/routes'
import { AppSidebar }       from '@/components/layout/app-sidebar'
import { AppTopbar }        from '@/components/layout/app-topbar'
import { Button }           from '@/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from 'lucide-react'

// ─── Slim navbar for guests ───────────────────────────────────────────────────
function GuestSocialNavbar() {
  const { resolved, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur-xl shrink-0">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-14">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-black tracking-tighter hover:opacity-80 transition-opacity"
        >
          <div className="size-7 rounded-lg overflow-hidden">
            <img src="/logo.png" alt={APP_NAME} className="size-full object-contain" />
          </div>
          <span className="text-base text-[var(--foreground)]">
            Secure<span className="text-[var(--accent-primary)]">Vote</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            className="size-8 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Toggle theme"
          >
            {resolved === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <Link
            to={ROUTES.login}
            className="px-4 py-1.5 rounded-xl text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            Sign In
          </Link>
          <Link
            to={ROUTES.register}
            className="px-4 py-1.5 rounded-xl text-sm font-bold bg-[var(--accent-primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-all shadow-sm"
          >
            Join Now
          </Link>
        </div>
      </div>
    </header>
  )
}

// ─── Full authenticated shell (mirrors DashboardLayout without nested Outlet) ─
function AuthSocialShell() {
  const [collapsed,   setCollapsed]   = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return (
    <div className="flex h-dvh bg-[var(--background)] text-[var(--foreground)] overflow-hidden relative">
      <div className="ambient-layer" />

      {/* Desktop sidebar */}
      {isDesktop && (
        <aside
          className="relative h-full transition-all duration-300 border-r border-[var(--border)]"
          style={{ width: collapsed ? '80px' : '260px' }}
        >
          <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {!isDesktop && mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden"
            >
              <AppSidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <main className="flex flex-1 flex-col overflow-hidden relative z-10">
        {/* Topbar */}
        <header className="shrink-0 h-16 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center px-4 lg:px-6 gap-3">
          {!isDesktop && (
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="ghost" size="icon"
                onClick={() => setMobileOpen(true)}
                className="size-9 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]"
              >
                <Menu className="size-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="size-6 rounded overflow-hidden">
                  <img src="/logo.png" alt="SecureVote" className="size-full object-contain" />
                </div>
                <span className="text-sm font-bold text-[var(--foreground)]">SecureVote</span>
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <AppTopbar />
          </div>
        </header>

        {/* Scrollable content — Outlet renders SocialLayout → page */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

import { LandingNavbar } from '@/components/landing/landing-navbar'

// ─── Guest shell ──────────────────────────────────────────────────────────────
function GuestSocialShell() {
  const [search, setSearch] = useState('')

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <LandingNavbar search={search} onSearchChange={setSearch} />
      <div className="flex-1 pt-24 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function SocialPageLayout() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex-1 flex items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return <GuestSocialShell />
}
