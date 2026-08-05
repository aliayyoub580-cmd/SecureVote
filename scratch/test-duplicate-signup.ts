import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cucqyjfngzghqkajinrb.supabase.co'
const supabaseAnonKey = 'sb_publishable_NnnA5U6oI3XXSbuqYC-g6w_JplPh1nv'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runTest() {
  const duplicateEmail = `dup_user_1779018580@example.com` // This email was registered in a previous test run!
  const testPassword = 'Password123!'

  console.log(`[1] Native Sign Up with DUPLICATE email: ${duplicateEmail}`)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: duplicateEmail,
    password: testPassword,
    options: {
      data: {
        full_name: 'Duplicate User',
        phone: '',
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
