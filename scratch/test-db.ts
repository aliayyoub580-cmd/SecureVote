import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase config')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInsert() {
  // Test as a specific user if possible, but for now just check if insert works
  const { data, error } = await supabase.from('elections').insert({
    title: 'Test Election ' + Date.now(),
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    created_by: '00000000-0000-0000-0000-000000000000', // Dummy UUID, will fail FK check
    status: 'draft'
  }).select()

  console.log('Insert Result:', { data, error })
}

testInsert()
