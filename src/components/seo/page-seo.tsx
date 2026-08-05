import { useEffect } from 'react'

import { APP_NAME } from '@/constants/routes'

export interface PageSeoProps {
  title?: string
  description?: string
  keywords?: string | string[]
  ogTitle?: string
  ogDescription?: string
  ogType?: 'website' | 'article' | 'profile'
  ogImage?: string
  canonicalPath?: string
  noindex?: boolean
  schema?: Record<string, any>
}

const DEFAULT_DESC =
  'Run transparent, tamper-proof elections with anonymous ballots, real-time results, and enterprise-grade security. SecureVote is the standard for online voting.'

const DEFAULT_KEYWORDS =
  'online voting, election management, secure ballot, anonymous voting, live election results, SecureVote, voter verification'

export function PageSeo({
  title,
  description = DEFAULT_DESC,
  keywords = DEFAULT_KEYWORDS,
  ogTitle,
  ogDescription,
  ogType = 'website',
  ogImage = '/logo.png',
  canonicalPath,
  noindex = false,
  schema,
}: PageSeoProps) {
  useEffect(() => {
    // 1. Title Management
    const prevTitle = document.title
    const fullTitle = title ? `${title} | ${APP_NAME}` : `${APP_NAME} — Secure Online Election Management`
    document.title = fullTitle

    // Helper to ensure meta tags are cleanly overwritten/created
    const ensureMeta = (name: string, attr: 'name' | 'property', content: string) => {
      let el = document.querySelector(`meta[${attr}="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
      return el
    }

    // 2. Standard Meta Tags
    ensureMeta('description', 'name', description)
    
    const kwString = Array.isArray(keywords) ? keywords.join(', ') : keywords
    ensureMeta('keywords', 'name', kwString)

    // Robots indexing rules
    ensureMeta('robots', 'name', noindex ? 'noindex, nofollow' : 'index, follow')

    // 3. Open Graph
    ensureMeta('og:title', 'property', ogTitle || title || APP_NAME)
    ensureMeta('og:description', 'property', ogDescription || description)
    ensureMeta('og:type', 'property', ogType)
    ensureMeta('og:image', 'property', ogImage.startsWith('http') ? ogImage : `${window.location.origin}${ogImage}`)
    ensureMeta('og:url', 'property', window.location.href)

    // 4. Twitter Cards
    ensureMeta('twitter:card', 'name', 'summary_large_image')
    ensureMeta('twitter:title', 'name', ogTitle || title || APP_NAME)
    ensureMeta('twitter:description', 'name', ogDescription || description)
    ensureMeta('twitter:image', 'name', ogImage.startsWith('http') ? ogImage : `${window.location.origin}${ogImage}`)

    // 5. Canonical Link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    const finalCanonicalPath = canonicalPath || window.location.pathname
    canonical.href = `${window.location.origin}${finalCanonicalPath === '/' ? '' : finalCanonicalPath}`

    // 6. JSON-LD Structured Data
    let schemaScript = document.getElementById('ld-json-schema') as HTMLScriptElement | null
    if (!schemaScript) {
      schemaScript = document.createElement('script')
      schemaScript.id = 'ld-json-schema'
      schemaScript.type = 'application/ld+json'
      document.head.appendChild(schemaScript)
    }

    const defaultSchema = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': APP_NAME,
      'applicationCategory': 'BusinessApplication',
      'operatingSystem': 'Web',
      'description': description,
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD',
      },
    }

    const finalSchema = schema ? { ...defaultSchema, ...schema } : defaultSchema
    schemaScript.textContent = JSON.stringify(finalSchema)

    // Cleanup on unmount to reset and prevent duplicates on route changes
    return () => {
      document.title = prevTitle
      // Reset canonical to current page location when unmounting
      if (canonical) {
        canonical.href = window.location.origin
      }
    }
  }, [
    title,
    description,
    keywords,
    ogTitle,
    ogDescription,
    ogType,
    ogImage,
    canonicalPath,
    noindex,
    schema,
  ])

  return null
}
