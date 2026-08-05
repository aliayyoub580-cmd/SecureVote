import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cucqyjfngzghqkajinrb.supabase.co'
const supabaseAnonKey = 'sb_publishable_NnnA5U6oI3XXSbuqYC-g6w_JplPh1nv'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runTest() {
  const testEmail = `conflict_user_${Date.now()}@example.com`
  const testPassword = 'Password123!'
  const testName = 'Test Conflict'

  console.log(`[1] Registering manually: ${testEmail}`)
  const { data: signUpData, error: signUpError } = await supabase.rpc('register_user_manually', {
    p_email: testEmail,
    p_password: testPassword,
    p_full_name: testName,
    p_phone: null,
    p_organization: null,
    p_account_type: 'voter'
  })

  if (signUpError) {
    console.error('Manual Sign up error:', signUpError)
    return
  }
  console.log('Manual Sign up result:', signUpData)

  console.log(`[2] Native Sign Up with SAME email: ${testEmail}`)
  const { data: nativeData, error: nativeError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testName,
        phone: '',
        organization: '',
        account_type: 'voter'
      }
    }
  })

  if (nativeError) {
    console.error('Native Sign up error object:', nativeError)
    return
  }
  console.log('Native Sign up result:', nativeData)
}

runTest()
