#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse consolidated migrations and split by file
const consolidatedPath = path.join(__dirname, 'supabase', 'consolidated-migrations.sql');
const content = fs.readFileSync(consolidatedPath, 'utf-8');

// Split by migration markers
const migrations = content.split(/-- ===== \d+_/);
const firstPart = migrations[0]; // Comments and initial setup

// Process each migration
const processed = migrations.slice(1).map((migration, index) => {
  const lines = migration.split('\n');
  const fileName = lines[0].trim().replace('.sql =====', '').trim();
  const sql = lines.slice(1).join('\n').trim();
  
  return {
    name: fileName,
    index: index + 1,
    sql: sql,
  };
});

console.log(`\n📊 Split ${processed.length} migrations from consolidated file\n`);

// Write each migration to a separate chunk file
const chunksDir = path.join(__dirname, 'migration-chunks');
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

processed.forEach((mig) => {
  const chunkPath = path.join(chunksDir, `chunk-${String(mig.index).padStart(2, '0')}.sql`);
  fs.writeFileSync(chunkPath, mig.sql);
  console.log(`✅ Created chunk-${String(mig.index).padStart(2, '0')}.sql (${mig.sql.length} bytes)`);
});

console.log(`\n💾 All chunks written to ${chunksDir}\n`);
console.log('📝 Next steps:\n');
console.log('   1. Run: npm run migrate:chunks');
console.log('   2. Or manually execute each chunk-XX.sql in Supabase SQL Editor\n');
