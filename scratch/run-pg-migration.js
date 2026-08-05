import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = 'postgresql://postgres.qiwjfxlpxrevadflbsxr:Atif.123%4012@db.qiwjfxlpxrevadflbsxr.supabase.co:5432/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connecting to Supabase PostgreSQL database...');
  await client.connect();
  console.log('Connected!');

  const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '026_auth_otp_and_verification.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('Executing 026_auth_otp_and_verification.sql...');
  await client.query(sql);
  console.log('✅ Migration 026 executed successfully on PostgreSQL!');

  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
