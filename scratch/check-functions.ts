import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cucqyjfngzghqkajinrb.supabase.co'
const supabaseAnonKey = 'sb_publishable_NnnA5U6oI3XXSbuqYC-g6w_JplPh1nv'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runTest() {
  console.log('Querying pg_proc for register_user_manually...')
  
  // Let's use a standard postgres query via a dynamic query RPC if any, 
  // or see if we can get system catalog information from pg_proc.
  const { data, error } = await supabase
    .from('pg_proc')
    .select('prosrc')
    .eq('proname', 'register_user_manually')
    
  console.log('Direct select result:', { data, error })
}

runTest()
