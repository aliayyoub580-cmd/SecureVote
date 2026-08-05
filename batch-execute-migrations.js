#!/usr/bin/env node

/**
 * Migration Batch Executor - Opens all migration files for easy copy-paste execution
 * Usage: node batch-execute-migrations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chunksDir = path.join(__dirname, 'migration-chunks');

async function batchExecute() {
  console.log(`\n${'='.repeat(70)}`);
  console.log('🚀 ELECTION MANAGEMENT SYSTEM - BATCH MIGRATION EXECUTOR');
  console.log(`${'='.repeat(70)}\n`);

  // Get all chunks
  const chunks = fs
    .readdirSync(chunksDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📊 Total Migrations: ${chunks.length}`);
  console.log(`📍 Location: ${chunksDir}\n`);

  // Read all chunks with their content
  const migrations = chunks.map((filename, idx) => {
    const filepath = path.join(chunksDir, filename);
    const content = fs.readFileSync(filepath, 'utf-8');
    return {
      num: idx + 1,
      filename,
      size: (content.length / 1024).toFixed(2),
      content,
      lines: content.split('\n').length,
    };
  });

  // Display summary
  console.log('📋 MIGRATION SUMMARY\n');
  console.log(
    'No. | Filename              | Size    | Lines'
  );
  console.log('-'.repeat(70));
  migrations.forEach(m => {
    console.log(
      `${String(m.num).padStart(3, ' ')} | ${m.filename.padEnd(20)} | ${m.size.padStart(7)} KB | ${String(m.lines).padStart(5)}`
    );
  });

  const totalSize = migrations.reduce((sum, m) => sum + parseFloat(m.size), 0);
  console.log('-'.repeat(70));
  console.log(`     | TOTAL                | ${totalSize.toFixed(2).padStart(7)} KB |\n`);

  // Instructions
  console.log(`${'='.repeat(70)}`);
  console.log('📝 EXECUTION INSTRUCTIONS');
  console.log(`${'='.repeat(70)}\n`);

  console.log('STEP 1: Open Supabase SQL Editor');
  console.log('        URL: https://supabase.com/dashboard/project/qiwjfxlpxrevadflbsxr/sql\n');

  console.log('STEP 2: For each migration below, copy the SQL and execute it:\n');

  migrations.slice(0, 5).forEach(m => {
    console.log(`   [${String(m.num).padStart(2, ' ')}] ${m.filename}`);
    console.log(`       File: migration-chunks/${m.filename}`);
    console.log(`       Size: ${m.size} KB`);
    console.log('       Action: Copy → Paste → Run\n');
  });

  console.log('   ... (and so on for the remaining migrations)\n');

  console.log(`${'='.repeat(70)}`);
  console.log('🎯 QUICK REFERENCE\n');

  // Group by size
  const small = migrations.filter(m => parseFloat(m.size) < 1);
  const medium = migrations.filter(m => parseFloat(m.size) >= 1 && parseFloat(m.size) < 10);
  const large = migrations.filter(m => parseFloat(m.size) >= 10);

  console.log(`⚡ Quick (< 1 KB):   ${small.map(m => m.num).join(', ')}`);
  console.log(`📦 Medium (1-10 KB): ${medium.map(m => m.num).join(', ')}`);
  console.log(`🏋️  Large (>10 KB):  ${large.map(m => m.num).join(', ')}\n`);

  console.log(`${'='.repeat(70)}`);
  console.log('✅ COMPLETION CHECKLIST\n');

  console.log('After executing all migrations:\n');
  console.log('☐ All 24 migrations executed successfully');
  console.log('☐ No SQL errors in any migration');
  console.log('☐ Database tables visible in Supabase Table Editor');
  console.log('☐ Refresh browser at http://localhost:5173');
  console.log('☐ App can fetch data without errors');
  console.log('☐ Authentication works');
  console.log('☐ Elections can be created and browsed\n');

  console.log(`${'='.repeat(70)}`);
  console.log('💾 FILES AVAILABLE\n');
  console.log('Documentation:');
  console.log('  • MIGRATION_GUIDE.md - Full migration guide with all details');
  console.log('  • consolidated-migrations.sql - All migrations in one file\n');

  console.log('Migration Chunks:');
  console.log(`  • migration-chunks/ - 24 individual SQL files ready to execute\n`);

  console.log('Execution Scripts:');
  console.log('  • prepare-migrations.mjs - Display migration summary');
  console.log('  • split-migrations.mjs - Split consolidated into chunks');
  console.log('  • batch-execute-migrations.js - This file\n');

  console.log(`${'='.repeat(70)}\n`);

  console.log('🚀 Ready to migrate! Open SQL Editor and start with chunk-01.sql\n');
}

// Run
batchExecute().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
