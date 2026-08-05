import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://qiwjfxlpxrevadflbsxr.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

async function main() {
  console.log('Fixing RLS infinite recursion on public.profiles...');

  // 1. We can test executing raw SQL to fix the RLS policy on profiles
  // Using direct fetch with service role key to set policy on profiles
  const fixSql = `
    drop policy if exists "profiles_select_self" on public.profiles;
    drop policy if exists "profiles_select_all" on public.profiles;
    drop policy if exists "profiles_select" on public.profiles;

    create policy "profiles_select_all" on public.profiles for select using (true);
  `;

  console.log('SQL to apply:\n', fixSql);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ sql: fixSql })
  });

  console.log('Response status:', response.status);
  const text = await response.text();
  console.log('Response body:', text);
}

main().catch(console.error);
