-- ============================================================================
-- NEWS MIGRATION - AUTOMATED DAILY NEWS SYSTEM
-- Enables automatic fetching, storing 10 daily news cards, and daily purge.
-- ============================================================================

-- Create news_articles table
CREATE TABLE IF NOT EXISTS public.news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    url TEXT NOT NULL UNIQUE,
    url_to_image TEXT,
    published_at TIMESTAMPTZ,
    source_name TEXT DEFAULT 'Global News',
    category TEXT DEFAULT 'general',
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to news articles
DROP POLICY IF EXISTS "Allow public read access to news_articles" ON public.news_articles;
CREATE POLICY "Allow public read access to news_articles" 
    ON public.news_articles FOR SELECT 
    USING (true);

-- Allow authenticated users / service role to insert news
DROP POLICY IF EXISTS "Allow insertion into news_articles" ON public.news_articles;
CREATE POLICY "Allow insertion into news_articles" 
    ON public.news_articles FOR INSERT 
    WITH CHECK (true);

-- Allow authenticated users / service role to delete news (for daily purge)
DROP POLICY IF EXISTS "Allow deletion of news_articles" ON public.news_articles;
CREATE POLICY "Allow deletion of news_articles" 
    ON public.news_articles FOR DELETE 
    USING (true);

-- Create indexes for quick daily filtering and sorting
CREATE INDEX IF NOT EXISTS idx_news_articles_fetched_at ON public.news_articles (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON public.news_articles (published_at DESC);

-- Helper function to purge previous day's news articles
CREATE OR REPLACE FUNCTION public.purge_previous_day_news()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.news_articles
    WHERE fetched_at < CURRENT_DATE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
