import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qiwjfxlpxrevadflbsxr.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('Updating all draft/pending elections to "approved" so they appear on voter panel...');

  const { data, error } = await supabase
    .from('elections')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .in('status', ['draft', 'pending_approval'])
    .select();

  if (error) {
    console.error('Error publishing elections:', error);
  } else {
    console.log(`✅ Successfully published ${data.length} draft elections to public voter panel:`, data);
  }
}

main().catch(console.error);
