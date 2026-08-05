import { supabase } from '@/lib/supabase/client'

export interface NewsArticle {
  id: string
  title: string
  description?: string
  content?: string
  url: string
  url_to_image?: string
  published_at?: string
  source_name?: string
  category?: string
  fetched_at?: string
}

interface RawNewsAPIItem {
  title: string
  description?: string
  content?: string
  url: string
  urlToImage?: string
  publishedAt?: string
  source?: { name?: string }
}

const FREE_NEWS_API = 'https://saurav.tech/NewsAPI/top-headlines/category/general/us.json'

export const newsService = {
  /**
   * Fetches 10 daily news cards.
   * If today's 10 cards exist in Supabase, returns them.
   * On a new day, deletes previous day's cards and inserts 10 fresh cards from free API.
   */
  async getDailyNews(forceRefresh = false): Promise<NewsArticle[]> {
    try {
      const todayStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD

      if (!forceRefresh) {
        // 1. Check database for existing articles
        const { data: dbArticles, error } = await supabase
          .from('news_articles')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(10)

        if (!error && dbArticles && dbArticles.length > 0) {
          const firstFetched = dbArticles[0].fetched_at
            ? new Date(dbArticles[0].fetched_at).toISOString().split('T')[0]
            : null

          // If fetched today, return cached 10 news cards
          if (firstFetched === todayStr) {
            return dbArticles as NewsArticle[]
          }
        }
      }

      // 2. New day or force refresh -> purge previous news and fetch fresh 10 cards
      return await this.syncFreshDailyNews()
    } catch (err) {
      console.error('Error in getDailyNews:', err)
      // Fallback: try reading whatever is in DB
      const { data } = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10)

      return (data as NewsArticle[]) || []
    }
  },

  /**
   * Fetches fresh 10 news items from free public News API, purges old DB news, and saves 10 new cards.
   */
  async syncFreshDailyNews(): Promise<NewsArticle[]> {
    // A. Fetch from Free Public API (No API key needed)
    const res = await fetch(FREE_NEWS_API)
    if (!res.ok) throw new Error('Failed to fetch external news API')
    
    const json = await res.json()
    const rawArticles: RawNewsAPIItem[] = json.articles || []

    // B. Filter and take top 10 valid articles
    const valid10 = rawArticles
      .filter(item => item.title && item.url && !item.title.includes('[Removed]'))
      .slice(0, 10)

    if (valid10.length === 0) {
      throw new Error('No valid news articles found in response')
    }

    // C. Delete previous day's news cards from Supabase database
    await supabase.from('news_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // D. Map and Insert 10 fresh cards into Supabase
    const toInsert = valid10.map(item => ({
      title: item.title,
      description: item.description || '',
      content: item.content || '',
      url: item.url,
      url_to_image: item.urlToImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800&auto=format&fit=crop',
      published_at: item.publishedAt || new Date().toISOString(),
      source_name: item.source?.name || 'Global News Network',
      category: 'general',
      fetched_at: new Date().toISOString(),
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('news_articles')
      .insert(toInsert)
      .select('*')

    if (insertErr) {
      console.warn('DB Insert Warning (falling back to client items):', insertErr)
      return toInsert as unknown as NewsArticle[]
    }

    return (inserted as NewsArticle[]) || []
  },
}
