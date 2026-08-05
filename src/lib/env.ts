export type PublicEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
  turnstileSiteKey: string | undefined
  frontendUrl: string
  isProduction: boolean
  strictEnv: boolean
}

let cached: PublicEnv | null = null

function isLikelyHttpUrl(s: string): boolean {
  return /^https?:\/\/.+\..+/i.test(s)
}

/** Validates public (Vite) env. Safe to call multiple times. */
export function getPublicEnv(): PublicEnv {
  if (cached) return cached

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  const turnstileRaw = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()
  
  const isValidTurnstileKey =
    turnstileRaw.length > 5 &&
    !['undefined', 'null', 'false', 'none', 'your_site_key', 'your_turnstile_site_key'].includes(
      turnstileRaw.toLowerCase()
    ) &&
    (turnstileRaw.startsWith('0x') || turnstileRaw.startsWith('1x') || turnstileRaw.length >= 20)

  const turnstileSiteKey = isValidTurnstileKey ? turnstileRaw : undefined

  const frontendUrl = String(
    import.meta.env.VITE_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).trim()
  const strictEnv = import.meta.env.VITE_STRICT_ENV === 'true'
  const isProduction = import.meta.env.PROD

  if (isProduction && strictEnv) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Production misconfiguration: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or disable VITE_STRICT_ENV.',
      )
    }
    if (!isLikelyHttpUrl(supabaseUrl)) {
      throw new Error('VITE_SUPABASE_URL must be a valid http(s) URL when VITE_STRICT_ENV is true.')
    }
  }

  cached = { supabaseUrl, supabaseAnonKey, turnstileSiteKey, frontendUrl, isProduction, strictEnv }
  return cached
}
