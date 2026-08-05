import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://qiwjfxlpxrevadflbsxr.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

async function executeSql(sql) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function applyMigrations() {
  const migrationsDir = './supabase/migrations';
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Found ${files.length} migration files\n`);

  let successful = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`Applying ${file}...`);
    try {
      await executeSql(sql);
      console.log(`✓ ${file} applied successfully\n`);
      successful++;
    } catch (error) {
      console.error(`✗ ${file} failed:`, error.message, '\n');
      failed++;
    }
  }
  
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║     Migration Summary                  ║`);
  console.log(`╠════════════════════════════════════════╣`);
  console.log(`║  Successful:  ${String(successful).padEnd(29)}║`);
  console.log(`║  Failed:      ${String(failed).padEnd(29)}║`);
  console.log(`║  Total:       ${String(successful + failed).padEnd(29)}║`);
  console.log(`╚════════════════════════════════════════╝`);
}

applyMigrations().catch(console.error);
