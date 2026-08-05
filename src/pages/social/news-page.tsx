import * as React from 'react'
import { motion } from 'framer-motion'
import { Newspaper, RefreshCw, ExternalLink, Share2, Clock, Globe, Sparkles, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { newsService, type NewsArticle } from '@/services/news.service'
import { toast } from '@/lib/toast'

export function NewsPage() {
  const [news, setNews] = React.useState<NewsArticle[]>([])
  const [loading, setLoading] = React.useState(true)
  const [syncing, setSyncing] = React.useState(false)

  const loadNews = React.useCallback(async (force = false) => {
    try {
      if (force) setSyncing(true)
      else setLoading(true)

      const items = await newsService.getDailyNews(force)
      setNews(items)

      if (force) {
        toast.success('Successfully synced 10 fresh daily news cards!')
      }
    } catch (err) {
      console.error('Error loading news:', err)
      toast.error('Failed to load news articles.')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  React.useEffect(() => {
    void loadNews(false)
  }, [loadNews])

  const handleShare = (url: string) => {
    void navigator.clipboard.writeText(url)
    toast.success('News link copied to clipboard!')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pt-4 pb-32">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0B3541] via-[#092B35] to-[#041920] border border-[#0F4A5E] rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 size-64 bg-gradient-to-br from-[#2EE6B8]/10 to-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#2EE6B8] uppercase tracking-widest bg-[#2EE6B8]/10 px-3 py-1 rounded-full border border-[#2EE6B8]/20 flex items-center gap-1.5">
                <Sparkles className="size-3" /> Automated Daily News Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#EDF7F6] tracking-tight flex items-center gap-2.5">
              <Newspaper className="size-7 text-[#2EE6B8]" />
              Daily Headlines & News
            </h1>
            <p className="text-xs sm:text-sm text-[#7FA3AB] max-w-xl">
              Automatically fetches 10 top news cards daily into our database. Older cards are purged automatically every 24 hours.
            </p>
          </div>

          {/* Sync Button */}
          <button
            onClick={() => void loadNews(true)}
            disabled={syncing || loading}
            className="px-4 py-2.5 rounded-xl bg-[#2EE6B8] text-[#031F28] font-bold text-xs hover:bg-[#2EE6B8]/90 shadow-[0_0_15px_rgba(46,230,184,0.25)] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing 10 Cards...' : 'Sync Fresh Daily News'}</span>
          </button>
        </div>

        {/* Status Bar */}
        <div className="mt-5 pt-4 border-t border-[#0F4A5E]/60 flex items-center justify-between flex-wrap gap-2 text-xs text-[#7FA3AB]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-[#2EE6B8]" />
            <span>Database Status: <strong>10 Active Cards Stored</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-[#F5A15C]" />
            <span>Auto-Purge Schedule: <strong>Daily 24h Rotation</strong></span>
          </div>
        </div>
      </div>

      {/* News Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#EDF7F6] tracking-tight flex items-center gap-2">
            <span>Today's 10 News Cards</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#0F4A5E] text-[#2EE6B8] text-xs font-black">
              {news.length}
            </span>
          </h2>
        </div>

        {loading && news.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#0B3541] border border-[#0F4A5E] rounded-2xl p-5 animate-pulse space-y-3">
                <div className="h-44 bg-[#0F4A5E] rounded-xl" />
                <div className="h-4 bg-[#0F4A5E] rounded w-3/4" />
                <div className="h-3 bg-[#0F4A5E] rounded w-full" />
                <div className="h-3 bg-[#0F4A5E] rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-16 text-[#7FA3AB] bg-[#0B3541]/40 rounded-2xl border border-[#0F4A5E]/50 p-8 space-y-3">
            <Globe className="size-12 mx-auto text-[#7FA3AB] opacity-40" />
            <p className="font-bold text-[#EDF7F6]">No news stored in database yet.</p>
            <button
              onClick={() => void loadNews(true)}
              className="px-4 py-2 rounded-xl bg-[#2EE6B8] text-[#031F28] font-bold text-xs"
            >
              Fetch 10 Daily Cards Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {news.map((item, index) => {
              const timeAgo = item.published_at
                ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true })
                : 'Recently'

              return (
                <motion.article
                  key={item.id || index}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  className="group bg-[#0B3541] border border-[#0F4A5E] rounded-2xl overflow-hidden hover:border-[#2EE6B8]/40 transition-all duration-300 hover:shadow-[0_0_24px_rgba(46,230,184,0.08)] flex flex-col"
                >
                  {/* Thumbnail Image */}
                  <div className="relative h-48 w-full overflow-hidden bg-[#031F28]">
                    <img
                      src={item.url_to_image || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800&auto=format&fit=crop'}
                      alt={item.title}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={e => {
                        ;(e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800&auto=format&fit=crop'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B3541] via-transparent to-black/20" />
                    
                    {/* Source Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B3541]/90 backdrop-blur-md border border-[#0F4A5E] text-[#EDF7F6] text-[10px] font-bold">
                      <Globe className="size-3 text-[#2EE6B8]" />
                      <span>{item.source_name || 'Global News'}</span>
                    </div>

                    {/* Card Index Badge */}
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-[#2EE6B8] text-[#031F28] text-[10px] font-black">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] text-[#7FA3AB]">
                        <Clock className="size-3" />
                        <span>{timeAgo}</span>
                      </div>

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#EDF7F6] text-base leading-snug hover:text-[#2EE6B8] transition-colors line-clamp-2 block"
                      >
                        {item.title}
                      </a>

                      {item.description && (
                        <p className="text-xs text-[#7FA3AB] leading-relaxed line-clamp-3">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Actions Footer */}
                    <div className="pt-3 border-t border-[#0F4A5E]/60 flex items-center justify-between">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F4A5E]/60 text-[#2EE6B8] hover:bg-[#2EE6B8] hover:text-[#031F28] font-bold text-xs transition-all"
                      >
                        <span>Read Full Article</span>
                        <ExternalLink className="size-3.5" />
                      </a>

                      <button
                        onClick={() => handleShare(item.url)}
                        className="p-2 rounded-xl text-[#7FA3AB] hover:text-[#EDF7F6] hover:bg-[#0F4A5E] transition-colors"
                        title="Share News Link"
                      >
                        <Share2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
