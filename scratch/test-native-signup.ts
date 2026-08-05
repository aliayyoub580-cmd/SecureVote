import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cucqyjfngzghqkajinrb.supabase.co'
const supabaseAnonKey = 'sb_publishable_NnnA5U6oI3XXSbuqYC-g6w_JplPh1nv'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runTest() {
  const testEmail = `native_user_${Date.now()}@example.com`
  const testPassword = 'Password123!'

  console.log(`[1] Native Sign Up: ${testEmail}`)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: 'Native User',
        account_type: 'voter'
      }
    }
  })

  if (signUpError) {
    console.error('Native Sign Up error:', signUpError)
    return
  }
  console.log('Native Sign Up result:', signUpData)

  console.log('[2] Attempting to sign in with password directly...')
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  })

  if (signInError) {
    console.error('Sign in error:', signInError)
  } else {
    console.log('Sign in success! Session user ID:', signInData.user?.id)
  }
}

runTest()
