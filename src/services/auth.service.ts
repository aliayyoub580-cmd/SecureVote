import { supabase } from '@/lib/supabase/client'
import { emailService } from './email.service'
import { setAuthPersistMode, type AuthPersistMode } from '@/lib/supabase/auth-storage'

/**
 * Authentication Service (Direct Registration & Auto-Login without Confirmation/OTP locks)
 */
export const authService = {
  async signUp(params: {
    email: string
    password: string
    fullName: string
    phone?: string
    organization?: string
    accountType: 'voter' | 'request_creator'
  }) {
    const email = params.email.trim().toLowerCase()
    let userId: string | null = null
    let createdUser: any = null
    let apiSuccess = false

    // 1. Call serverless registration endpoint (/api/register).
    // This runs in Node.js with admin rights, creating the user pre-confirmed (email_confirm: true),
    // bypassing Supabase email rate limits, removing secret key from the browser, and eliminating OTP.
    try {
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: params.password,
          fullName: params.fullName,
          phone: params.phone,
          organization: params.organization,
          accountType: params.accountType,
        }),
      })

      const result = await resp.json().catch(() => ({}))
      if (resp.ok && result.success) {
        apiSuccess = true
        createdUser = result.user
        userId = result.user?.id ?? null
      } else if (result.error) {
        return {
          data: null,
          error: Object.assign(new Error(result.error), { __isAuthError: true }) as any,
        }
      }
    } catch {
      // Network or environment fallback
    }

    if (!apiSuccess) {
      // Fallback: register via standard Supabase auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName,
            phone: params.phone || '',
            organization: params.organization || '',
            account_type: params.accountType,
          },
        },
      })

      if (signUpError) {
        const msg = signUpError.message ?? ''
        const code = (signUpError as any).code ?? ''
        if (
          code === 'unexpected_failure' ||
          msg.toLowerCase().includes('database error saving new user') ||
          msg.toLowerCase().includes('already registered') ||
          msg.toLowerCase().includes('already exists')
        ) {
          return {
            data: null,
            error: Object.assign(
              new Error('This email is already registered. Please sign in or use "Forgot Password" to reset your password.'),
              { __isAuthError: true }
            ) as any,
          }
        }
        return { data: null, error: signUpError }
      }

      if (!signUpData.user || (signUpData.user.identities && signUpData.user.identities.length === 0)) {
        return {
          data: null,
          error: Object.assign(new Error('This email is already registered. Please sign in instead.'), { __isAuthError: true }) as any,
        }
      }

      createdUser = signUpData.user
      userId = signUpData.user.id
    }

    // 2. Ensure public.profiles record is correctly populated
    if (userId) {
      try {
        const role = params.accountType === 'request_creator' ? 'election_creator' : 'voter'
        const creatorStatus = params.accountType === 'request_creator' ? 'pending' : 'none'
        await supabase.from('profiles').upsert(
          {
            id: userId,
            email,
            full_name: params.fullName,
            phone: params.phone?.trim() || null,
            organization: params.organization?.trim() || null,
            role,
            creator_application_status: creatorStatus,
          },
          { onConflict: 'id' },
        )
      } catch (err) {
        console.warn('Profile upsert notice:', err)
      }
    }

    // 3. Immediately log the user in so they have an active session without OTP or verification steps
    const { data: signInData, error: signInError } = await authService.signIn(email, params.password, true)

    return {
      data: {
        email,
        user: signInData?.user || createdUser,
        session: signInData?.session || null,
      },
      error: signInError && !signInData?.session ? signInError : null,
    }
  },

  async requestPasswordReset(email: string) {
    const otp = emailService.generateOTP()
    
    await (supabase as any).from('auth_otps').insert([{
      email,
      otp_code: otp,
      type: 'reset'
    }])

    await emailService.sendOTPEmail(email, otp, 'reset')
    
    return { data: { email }, error: null }
  },

  async signIn(email: string, password: string, rememberMe: boolean) {
    const mode: AuthPersistMode = rememberMe ? 'local' : 'session'
    setAuthPersistMode(mode)
    return supabase.auth.signInWithPassword({ email, password })
  },

  async updatePassword(newPassword: string) {
    return (supabase as any).rpc('reset_password_with_token', {
      p_token: 'manual-reset', 
      p_new_password: newPassword
    })
  },

  async signOut() {
    return supabase.auth.signOut()
  },

  async getUser() {
    return supabase.auth.getUser()
  }
}
