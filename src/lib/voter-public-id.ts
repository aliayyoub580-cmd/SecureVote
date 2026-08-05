/** Mask human-readable voter ID for safe display (never masks ballot tokens). */
export function maskVoterPublicId(publicId: string | null | undefined): string {
  if (!publicId || typeof publicId !== 'string') return '—'
  const t = publicId.trim()
  if (t.length <= 6) return '****'
  const head = t.slice(0, 5)
  const tail = t.slice(-2)
  return `${head}…${tail}`
}

/** Loose format check (server RPC is authoritative). */
export function isPlausibleVoterPublicIdFormat(code: string): boolean {
  const t = code.trim().toUpperCase()
  if (t.length < 10 || t.length > 48) return false
  if (!t.startsWith('POLL-')) return false
  return /^POLL-[A-Z]-[A-Z0-9]+$/.test(t)
}
