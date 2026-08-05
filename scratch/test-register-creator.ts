import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cucqyjfngzghqkajinrb.supabase.co'
const supabaseAnonKey = 'sb_publishable_NnnA5U6oI3XXSbuqYC-g6w_JplPh1nv'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runTest() {
  const testEmail = `creator_user_${Date.now()}@example.com`
  const testPassword = 'Password123!'
  const testName = 'Test Creator'

  console.log(`[1] Native Sign Up as Creator: ${testEmail}`)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testName,
        phone: '1234567890',
        organization: 'AWT',
        account_type: 'request_creator'
      }
    }
  })

  if (signUpError) {
    console.error('Sign up error:', signUpError)
    return
  }
  console.log('Sign up result:', signUpData)
}

runTest()
