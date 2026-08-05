import { supabase } from '@/lib/supabase/client'

/**
 * SPA "middleware": validate the current session with the Supabase Auth server.
 * Use in route guards or before sensitive operations (not Edge middleware — Vite has no server hooks).
 */
export async function ensureAuthSession(): Promise<{ ok: boolean; userId: string | null }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) {
    return { ok: false, userId: null }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { ok: false, userId: null }
  }

  return { ok: true, userId: userData.user.id }
}

/**
 * Call after email recovery links with hash fragments so Supabase can parse tokens.
 */
export async function syncSessionFromUrl(): Promise<void> {
  await supabase.auth.getSession()
}
