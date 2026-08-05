import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://qiwjfxlpxrevadflbsxr.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

async function executeSqlChunk(sqlText) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ sql: sqlText })
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, status: response.status, text };
  }
  return { ok: true };
}

async function main() {
  const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '026_auth_otp_and_verification.sql');
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log('Applying Migration 026 to Supabase...');
  const res = await executeSqlChunk(sql);
  
  if (res.ok) {
    console.log('✅ Migration 026 applied successfully via exec_sql!');
  } else {
    console.log(`rpc exec_sql returned ${res.status}: ${res.text}`);
    console.log('Trying REST table creation fallback...');

    // Execute via REST endpoints if exec_sql RPC is not installed
    const sqlStatements = [
      // 1. Create table auth_otps
      `create table if not exists public.auth_otps (
        id uuid primary key default gen_random_uuid(),
        email text not null,
        otp_code text not null,
        type text not null default 'signup',
        metadata jsonb default '{}'::jsonb,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null default (now() + interval '15 minutes')
      );`,
      `alter table public.auth_otps enable row level security;`,
      `drop policy if exists "auth_otps_insert_policy" on public.auth_otps;`,
      `create policy "auth_otps_insert_policy" on public.auth_otps for insert to anon, authenticated with check (true);`,
      `drop policy if exists "auth_otps_select_policy" on public.auth_otps;`,
      `create policy "auth_otps_select_policy" on public.auth_otps for select to anon, authenticated using (true);`,
      `drop policy if exists "auth_otps_delete_policy" on public.auth_otps;`,
      `create policy "auth_otps_delete_policy" on public.auth_otps for delete to anon, authenticated using (true);`
    ];

    for (const stmt of sqlStatements) {
      const r = await executeSqlChunk(stmt);
      console.log(`Executed statement: ${stmt.substring(0, 50)}... Status: ${r.ok ? 'OK' : r.text}`);
    }
  }
}

main().catch(console.error);
