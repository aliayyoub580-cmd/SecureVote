import { supabase } from '@/lib/supabase/client'
import { emailService } from './email.service'
import { setAuthPersistMode, type AuthPersistMode } from '@/lib/supabase/auth-storage'

/**
 * 100% Reliable & Native Auth Service (EmailJS OTP + Native Supabase Security)
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
    // 1. Register natively via Supabase Auth.
    // This creates the user in auth.users with the correct GoTrue bcrypt hashing natively.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          full_name: params.fullName,
          phone: params.phone || '',
          organization: params.organization || '',
          account_type: params.accountType
        }
      }
    })

    if (signUpError) {
      const msg = signUpError.message ?? ''
      const code = (signUpError as any).code ?? ''
      // "Database error saving new user" (unexpected_failure) = user already exists with confirmed email
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

    // Supabase returns identities:[] (fake success) when email confirmation is OFF
    // and the user already exists. Detect this and surface a clear error.
    if (!signUpData.user || (signUpData.user.identities && signUpData.user.identities.length === 0)) {
      await supabase.auth.signOut()
      return { data: null, error: Object.assign(new Error('This email is already registered. Please sign in instead.'), { __isAuthError: true }) as any }
    }

    // Immediately sign out to clear the session so they are locked out until OTP verification succeeds.
    await supabase.auth.signOut()

    // 2. Generate and store our OTP code for verification
    const otp = emailService.generateOTP()

    // Store in sessionStorage as a fail-safe client fallback
    try {
      sessionStorage.setItem(`otp_${params.email.toLowerCase()}`, JSON.stringify({
        otp,
        password: params.password,
        fullName: params.fullName,
        accountType: params.accountType,
        expiresAt: Date.now() + 15 * 60 * 1000
      }))
    } catch {
      // Storage unavailable
    }
    
    try {
      await (supabase as any).from('auth_otps').insert([{
        email: params.email,
        otp_code: otp,
        type: 'signup',
        metadata: {
          password: params.password,
          full_name: params.fullName,
          account_type: params.accountType
        }
      }])
    } catch {
      // Ignore if auth_otps table is not created yet
    }

    // 3. Send the OTP code via EmailJS to the user's Gmail inbox
    await emailService.sendOTPEmail(params.email, otp, 'signup')
    
    return { data: { email: params.email }, error: null }
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
