import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

// Connection string for Supabase PostgreSQL database
// Password special characters: @ -> %40
const connectionString = 'postgresql://Atif.123%4012@db.qiwjfxlpxrevadflbsxr.supabase.co:5432/postgres';

async function applyMigrations() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected to Supabase database\n');

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
        await client.query(sql);
        console.log(`✓ ${file} applied successfully\n`);
        successful++;
      } catch (error) {
        console.error(`✗ ${file} failed:`, error.message, '\n');
        failed++;
        // Continue with next migration even if one fails
      }
    }
    
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║     Migration Summary                  ║`);
    console.log(`╠════════════════════════════════════════╣`);
    console.log(`║  Successful:  ${String(successful).padEnd(29)}║`);
    console.log(`║  Failed:      ${String(failed).padEnd(29)}║`);
    console.log(`║  Total:       ${String(successful + failed).padEnd(29)}║`);
    console.log(`╚════════════════════════════════════════╝`);
  } catch (error) {
    console.error('✗ Database connection error:', error.message);
  } finally {
    await client.end();
  }
}

applyMigrations();
