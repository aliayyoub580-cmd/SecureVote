import { useEffect } from 'react'

import { APP_NAME } from '@/constants/routes'

const DESC =
  'Run transparent elections with anonymous ballots, live results, and enterprise-grade security. SecureVote is the modern election management platform for organizations worldwide.'

export function LandingSeo() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = `${APP_NAME} — Secure Online Election Management`

    const ensureMeta = (name: string, attr: 'name' | 'property', content: string) => {
      let el = document.querySelector(`meta[${attr}="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    ensureMeta('description', 'name', DESC)
    ensureMeta('og:title', 'property', `${APP_NAME} — Secure Online Elections`)
    ensureMeta('og:description', 'property', DESC)
    ensureMeta('og:type', 'property', 'website')
    ensureMeta('twitter:card', 'name', 'summary_large_image')

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = typeof window !== 'undefined' ? `${window.location.origin}/` : '/'

    let script = document.getElementById('ld-json-org') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'ld-json-org'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: APP_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: DESC,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    })

    return () => {
      document.title = prevTitle
    }
  }, [])

  return null
}
