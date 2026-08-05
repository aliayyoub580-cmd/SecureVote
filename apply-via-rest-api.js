import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://qiwjfxlpxrevadflbsxr.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

async function executeSql(sqlText) {
  // Split by semicolon to execute multiple statements
  const statements = sqlText
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + ';');

  for (const sql of statements) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        // Some errors are expected, continue anyway
        const text = await response.text();
        if (!text.includes('already exists') && !text.includes('duplicate')) {
          console.log(`  ⚠  ${response.status}: ${text.substring(0, 100)}`);
        }
      }
    } catch (error) {
      console.log(`  ⚠  Error: ${error.message}`);
    }
  }
}

async function applyMigrations() {
  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
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
      console.log(`✓ Sent to database\n`);
      successful++;
    } catch (error) {
      console.error(`✗ Error:`, error.message, '\n');
      failed++;
    }
  }
  
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║     Migration Summary                  ║`);
  console.log(`╠════════════════════════════════════════╣`);
  console.log(`║  Processed:   ${String(successful).padEnd(29)}║`);
  console.log(`║  Errors:      ${String(failed).padEnd(29)}║`);
  console.log(`║  Total:       ${String(successful + failed).padEnd(29)}║`);
  console.log(`╚════════════════════════════════════════╝`);
  console.log(`\nCheck your Supabase database at:`);
  console.log(`${SUPABASE_URL}/project/qiwjfxlpxrevadflbsxr`);
}

applyMigrations().catch(console.error);
