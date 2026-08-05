import { createClient } from '@supabase/supabase-js'

import { getPublicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

import { supabaseAuthStorage } from '@/lib/supabase/auth-storage'

const { supabaseUrl, supabaseAnonKey } = getPublicEnv()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Configure .env for full functionality.',
  )
}

export const supabase = createClient<Database>(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: supabaseAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
