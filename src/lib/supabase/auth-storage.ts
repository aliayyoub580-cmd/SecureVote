/**
 * Delegates Supabase session persistence to localStorage or sessionStorage
 * based on "Remember me" (set via setAuthPersistMode before sign-in).
 */
const PERSIST_MODE_KEY = 'ems-auth-persist-mode'

export type AuthPersistMode = 'local' | 'session'

export function setAuthPersistMode(mode: AuthPersistMode) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PERSIST_MODE_KEY, mode)
}

export function getAuthPersistMode(): AuthPersistMode {
  if (typeof window === 'undefined') return 'local'
  return localStorage.getItem(PERSIST_MODE_KEY) === 'session' ? 'session' : 'local'
}

function target(): Storage {
  return getAuthPersistMode() === 'session' ? sessionStorage : localStorage
}

/** Supabase-compatible synchronous storage adapter */
export const supabaseAuthStorage = {
  getItem(key: string) {
    return target().getItem(key)
  },
  setItem(key: string, value: string) {
    target().setItem(key, value)
  },
  removeItem(key: string) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}
