/** Best-effort client context for transparency (IP is approximate; may be blocked by ad blockers). */
let ipCache: { ip: string | null; at: number } | null = null
const IP_CACHE_MS = 120_000

function summarizeUserAgent(ua: string): string {
  if (!ua) return 'Unknown'
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) return 'Mobile / tablet'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS|Macintosh/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Desktop / other'
}

export async function getClientAuditContext(): Promise<{ ip: string | null; userAgent: string; deviceLabel: string }> {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const deviceLabel = summarizeUserAgent(userAgent)
  const now = Date.now()
  if (ipCache && now - ipCache.at < IP_CACHE_MS) {
    return { ip: ipCache.ip, userAgent, deviceLabel }
  }
  let ip: string | null = null
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
    if (res.ok) {
      const j = (await res.json()) as { ip?: string }
      ip = typeof j.ip === 'string' ? j.ip : null
    }
  } catch {
    /* ignore */
  }
  ipCache = { ip, at: now }
  return { ip, userAgent, deviceLabel }
}
