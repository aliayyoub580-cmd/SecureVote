import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase config')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runCheck() {
  console.log('--- ELECTIONS ---')
  const { data: elections, error: eErr } = await supabase.from('elections').select('id, title, status')
  console.log(eErr ? 'Error: ' + eErr.message : elections)

  console.log('\n--- VOTES ---')
  const { data: votes, error: vErr } = await supabase.from('votes').select('*')
  console.log(vErr ? 'Error: ' + vErr.message : votes)

  console.log('\n--- VOTER PUBLIC IDS ---')
  const { data: pubIds, error: pErr } = await supabase.from('voter_public_ids').select('*')
  console.log(pErr ? 'Error: ' + pErr.message : pubIds)

  if (elections && elections.length > 0) {
    for (const ele of elections) {
      console.log(`\n--- RPC: get_election_vote_ledger for "${ele.title}" (${ele.id}) ---`)
      const { data: ledger, error: rpcErr } = await supabase.rpc('get_election_vote_ledger', { p_election_id: ele.id })
      console.log(rpcErr ? 'Error: ' + rpcErr.message : ledger)
    }
  }
}

runCheck()
