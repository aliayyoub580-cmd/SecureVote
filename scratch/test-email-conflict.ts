import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cucqyjfngzghqkajinrb.supabase.co'
const supabaseAnonKey = 'sb_publishable_NnnA5U6oI3XXSbuqYC-g6w_JplPh1nv'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runTest() {
  const testEmail = 'fatimono4@gmail.com'
  const testPassword = 'Password123!'

  console.log(`[1] Native Sign Up for: ${testEmail}`)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: 'Haram Fatima',
        phone: '+923067890123',
        organization: '',
        account_type: 'voter'
      }
    }
  })

  if (signUpError) {
    console.error('Sign up error object:', signUpError)
    console.error('Sign up error message:', signUpError.message)
    console.error('Sign up error status:', signUpError.status)
    return
  }
  console.log('Sign up result:', signUpData)
}

runTest()
