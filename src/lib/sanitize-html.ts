import DOMPurify from 'dompurify'

/** Sanitize rich HTML (e.g. TipTap) before injecting into the DOM (XSS mitigation). */
export function sanitizeElectionHtml(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  })
}
