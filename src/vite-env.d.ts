/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** When `true`, users without `email_confirmed_at` are redirected to `/auth/verify-email`. */
  readonly VITE_REQUIRE_EMAIL_VERIFICATION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
