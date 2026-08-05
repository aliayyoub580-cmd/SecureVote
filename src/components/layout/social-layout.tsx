import { Outlet, Link } from 'react-router-dom'
import { socialSearchService } from '@/services/social.service'
import * as React from 'react'
import { TrendingUp, Hash, Flame } from 'lucide-react'
import { SuggestedUsers } from '@/components/social/suggested-users'
import { SocialHeader } from '@/components/layout/social-header'

export function SocialLayout() {
  const [trending, setTrending] = React.useState<{tag:string;post_count:number}[]>([])

  React.useEffect(() => {
    void socialSearchService.getTrendingHashtags().then(d => setTrending(d.slice(0, 3)))
  }, [])

  return (
    <div className="min-h-full bg-[#031F28] text-[#EDF7F6]">
      {/* Top Header Bar */}
      <SocialHeader />

      <div className="mx-auto max-w-6xl flex gap-6 px-4 pt-6 pb-12">
        {/* Main content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

        {/* Right sidebar — Top 3 Hashtags & Suggested Users */}
        <aside className="hidden xl:flex flex-col gap-5 w-72 flex-shrink-0 sticky top-20 self-start">
          {/* Top 3 Hashtags */}
          {trending.length > 0 && (
            <div className="bg-[#0B3541] border border-[#0F4A5E] rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#0F4A5E]/60">
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-[#F5A15C]" />
                  <h3 className="text-sm font-bold text-[#EDF7F6] tracking-tight">Top 3 Hashtags</h3>
                </div>
                <TrendingUp className="size-4 text-[#2EE6B8]" />
              </div>
              <div className="space-y-1.5">
                {trending.map((h, index) => (
                  <Link
                    key={h.tag}
                    to={`/social/hashtag/${h.tag}`}
                    className="flex items-center justify-between group hover:bg-[#0F4A5E]/70 rounded-xl p-2.5 transition-colors border border-transparent hover:border-[#0F4A5E]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-5 rounded-full bg-[#0F4A5E] text-[#2EE6B8] text-[10px] font-black flex items-center justify-center shrink-0">
                        #{index + 1}
                      </span>
                      <div className="flex items-center gap-1 min-w-0">
                        <Hash className="size-3.5 text-[#F5A15C] shrink-0" />
                        <span className="text-sm font-bold text-[#EDF7F6] group-hover:text-[#2EE6B8] transition-colors truncate">
                          {h.tag}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#0F4A5E] text-[#7FA3AB] text-[10px] font-bold shrink-0">
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

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#0B3541]/95 backdrop-blur-xl border-t border-[#0F4A5E] px-4 py-2 flex justify-around z-40">
        <MobileNavItem to="/social"              icon="🏠" label="Feed"     />
        <MobileNavItem to="/social/search"       icon="🔍" label="Search"   />
        <MobileNavItem to="/social/create"       icon="✏️" label="Post"     highlight />
        <MobileNavItem to="/social/notifications"icon="🔔" label="Alerts"   />
        <MobileNavItem to="/social/bookmarks"    icon="🔖" label="Saved"    />
      </nav>
    </div>
  )
}

function MobileNavItem({ to, icon, label, highlight }: { to: string; icon: string; label: string; highlight?: boolean }) {
  return (
    <Link to={to} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all text-xs font-medium ${highlight ? 'bg-[#2EE6B8] text-[#031F28] font-bold' : 'text-[#7FA3AB] hover:text-[#EDF7F6]'}`}>
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
