import type { Session, User } from '@supabase/supabase-js'
import * as React from 'react'

import { supabase } from '@/lib/supabase/client'
import { auditService } from '@/services/audit.service'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  sessionValidated: boolean
}

type AuthContextValue = AuthState & {
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  isEmailVerified: boolean
  isCreatorApplicationPending: boolean
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

function getFallbackProfile(user: User): Profile {
  let role: 'super_admin' | 'election_creator' | 'voter' = 'voter'
  if (user.email?.toLowerCase() === 'admin@gmail.com') {
    role = 'super_admin'
  } else if (user.user_metadata?.account_type === 'request_creator') {
    role = 'election_creator'
  }

  return {
    id: user.id,
    full_name: (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'User',
    email: user.email || null,
    role,
    created_at: user.created_at,
    updated_at: new Date().toISOString(),
    phone: null,
    organization: null,
    creator_application_status: role === 'election_creator' ? 'approved' : 'none',
    creator_application_rejection_reason: null,
  }
}

async function fetchProfile(user: User): Promise<Profile> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (error || !data) {
      return getFallbackProfile(user)
    }
    return data
  } catch {
    return getFallbackProfile(user)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    sessionValidated: false,
  })

  // 1. Session listener with hard timeout to prevent stuck loading
  React.useEffect(() => {
    let mounted = true

    // Safety timer: ensures loading is ALWAYS set to false within 1.5s
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setState((s) => ({ ...s, loading: false, sessionValidated: true }))
      }
    }, 1500)

    // Check initial session
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      clearTimeout(safetyTimer)
      const user = session?.user ?? null
      setState((s) => ({
        ...s,
        session,
        user,
        loading: false,
        sessionValidated: true,
      }))
    }).catch(() => {
      if (!mounted) return
      clearTimeout(safetyTimer)
      setState((s) => ({ ...s, loading: false, sessionValidated: true }))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      clearTimeout(safetyTimer)
      const user = session?.user ?? null
      setState((s) => ({
        ...s,
        session,
        user,
        loading: false,
        sessionValidated: true,
      }))
    })

    return () => {
      mounted = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  // 2. Fetch profile whenever user ID changes (decoupled from auth locks)
  React.useEffect(() => {
    let mounted = true
    const user = state.user

    if (!user) {
      setState((s) => ({ ...s, profile: null }))
      return
    }

    // Set fallback profile immediately so role guards are never blocked
    setState((s) => ({ ...s, profile: s.profile ?? getFallbackProfile(user) }))

    void (async () => {
      const profile = await fetchProfile(user)
      if (mounted) {
        setState((s) => ({ ...s, profile }))
      }
    })()

    return () => {
      mounted = false
    }
  }, [state.user?.id])

  const refreshProfile = React.useCallback(async () => {
    try {
      const user = state.user
      if (!user) {
        setState((s) => ({ ...s, profile: null }))
        return
      }
      const profile = await fetchProfile(user)
      setState((s) => ({ ...s, profile }))
    } catch {
      // Offline / network failure
    }
  }, [state.user])

  const signOut = React.useCallback(async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      if (u.user?.id) {
        await auditService.log('auth.logout', 'session', null, { method: 'client' }, { enrichClient: true })
      }
    } catch {
      /* still sign out */
    }
    await supabase.auth.signOut()
    localStorage.clear()
    sessionStorage.clear()
    window.location.replace('/login')
  }, [])

  const isEmailVerified = Boolean(state.user?.email_confirmed_at)
  const isCreatorApplicationPending = state.profile?.creator_application_status === 'pending'

  const value = React.useMemo(
    () => ({
      ...state,
      refreshProfile,
      signOut,
      isEmailVerified,
      isCreatorApplicationPending,
    }),
    [state, refreshProfile, signOut, isEmailVerified, isCreatorApplicationPending],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
