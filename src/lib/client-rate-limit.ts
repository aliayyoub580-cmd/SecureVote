const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 12

type Bucket = { windowStart: number; count: number }

function read(key: string): Bucket {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return { windowStart: Date.now(), count: 0 }
    return JSON.parse(raw) as Bucket
  } catch {
    return { windowStart: Date.now(), count: 0 }
  }
}

function write(key: string, b: Bucket) {
  sessionStorage.setItem(key, JSON.stringify(b))
}

/**
 * Lightweight client-side throttle for auth actions (not a substitute for server / WAF rate limits).
 */
export function assertClientAuthRateLimit(scope: 'login' | 'register'): void {
  const key = `ems:auth-rl:${scope}`
  const now = Date.now()
  let b = read(key)
  if (now - b.windowStart > WINDOW_MS) {
    b = { windowStart: now, count: 0 }
  }
  if (b.count >= MAX_ATTEMPTS) {
    throw new Error('Too many attempts. Please wait a few minutes and try again.')
  }
  b.count += 1
  write(key, b)
}

export function resetClientAuthRateLimit(scope: 'login' | 'register') {
  sessionStorage.removeItem(`ems:auth-rl:${scope}`)
}
