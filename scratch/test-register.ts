import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cucqyjfngzghqkajinrb.supabase.co'
const supabaseAnonKey = 'sb_publishable_NnnA5U6oI3XXSbuqYC-g6w_JplPh1nv'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testDirectInsert() {
  const email = 'faimch04@gmail.com'
  const fakeId = '00000000-0000-0000-0000-000000000000'
  
  console.log(`\nAttempting manual direct insert of email "${email}" into public.profiles...`)
  
  const { data, error } = await supabase
    .from('profiles')
    .insert([{
      id: fakeId,
      full_name: 'Test Haram',
      email: email,
      role: 'voter'
    }])
    .select()

  if (error) {
    console.log('❌ INSERT FAILED WITH ERROR:')
    console.log(JSON.stringify(error, null, 2))
  } else {
    console.log('🎉 INSERT SUCCEEDED!')
    console.log(JSON.stringify(data, null, 2))
    
    // Immediately delete the fake row
    console.log('\nCleaning up fake profile row...')
    const { error: delErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', fakeId)
      
    if (delErr) console.error('Failed to cleanup:', delErr.message)
    else console.log('Cleaned up successfully!')
  }
}

testDirectInsert().catch(console.error)
