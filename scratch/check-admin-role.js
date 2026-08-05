import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qiwjfxlpxrevadflbsxr.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const adminUser = users.users.find(u => u.email === 'admin@gmail.com');
  console.log('Auth user:', adminUser?.id, adminUser?.email);

  if (adminUser) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', adminUser.id).maybeSingle();
    console.log('Profiles row:', profile);
  }
}

main().catch(console.error);
