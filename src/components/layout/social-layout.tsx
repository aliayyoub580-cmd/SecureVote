import { Outlet, Link } from 'react-router-dom'
import { socialSearchService } from '@/services/social.service'
import * as React from 'react'
import { TrendingUp, Hash, Flame } from 'lucide-react'
import { SuggestedUsers } from '@/components/social/suggested-users'
import { SocialSecondaryNav } from '@/components/social/social-secondary-nav'

import { useAuth } from '@/contexts/auth-context'

export function SocialLayout() {
  const { user } = useAuth()
  const [trending, setTrending] = React.useState<{tag:string;post_count:number}[]>([])

  React.useEffect(() => {
    void socialSearchService.getTrendingHashtags().then(d => setTrending(d.slice(0, 3)))
  }, [])

  return (
    <div className="w-full min-h-full bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-4 pt-4 pb-12">
        {/* Secondary Social Navigation Bar */}
        <SocialSecondaryNav />

        <div className="flex gap-6">
          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>

          {/* Right Sidebar — Top 3 Hashtags & Suggested Users */}
          <aside className="hidden xl:flex flex-col gap-5 w-72 flex-shrink-0 sticky top-20 self-start">
            {/* Top 3 Hashtags */}
            {trending.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <Flame className="size-4 text-[var(--accent-secondary)]" />
                    <h3 className="text-sm font-bold text-[var(--foreground)] tracking-tight">Top 3 Hashtags</h3>
                  </div>
                  <TrendingUp className="size-4 text-[var(--accent-primary)]" />
                </div>
                <div className="space-y-1.5">
                  {trending.map((h, index) => (
                    <Link
                      key={h.tag}
                      to={`/social/hashtag/${h.tag}`}
                      className="flex items-center justify-between group hover:bg-[var(--muted)]/60 rounded-xl p-2.5 transition-colors border border-transparent hover:border-[var(--border)]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] text-[10px] font-black flex items-center justify-center shrink-0">
                          #{index + 1}
                        </span>
                        <div className="flex items-center gap-1 min-w-0">
                          <Hash className="size-3.5 text-[var(--accent-secondary)] shrink-0" />
                          <span className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                            {h.tag}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] text-[10px] font-bold shrink-0">
                        {h.post_count} {h.post_count === 1 ? 'post' : 'posts'}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Users to Follow */}
            <SuggestedUsers />
          </aside>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[var(--card)]/95 backdrop-blur-xl border-t border-[var(--border)] px-4 py-2 flex justify-around z-40 shadow-lg">
        <MobileNavItem to="/social" icon="🏠" label="Feed" />
        <MobileNavItem to="/social/search" icon="🔍" label="Search" />
        {user ? (
          <>
            <MobileNavItem to="/social/create" icon="✏️" label="Post" highlight />
            <MobileNavItem to="/social/notifications" icon="🔔" label="Alerts" />
            <MobileNavItem to="/social/bookmarks" icon="🔖" label="Saved" />
          </>
        ) : (
          <>
            <MobileNavItem to="/social/trending" icon="🔥" label="Trending" />
            <MobileNavItem to="/social/news" icon="📰" label="News" />
            <MobileNavItem to="/login" icon="🔑" label="Sign In" highlight />
          </>
        )}
      </nav>
    </div>
  )
}

function MobileNavItem({ to, icon, label, highlight }: { to: string; icon: string; label: string; highlight?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all text-xs font-medium ${
        highlight
          ? 'bg-[var(--accent-primary)] text-[var(--primary-foreground)] font-bold'
          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

