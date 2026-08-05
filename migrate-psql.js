#!/usr/bin/env node

/**
 * Execute all SQL migrations from supabase/migrations directory
 * Connects directly to Supabase PostgreSQL via psql or programmatically
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const SUPABASE_DB_URL =
  "postgresql://postgres.qiwjfxlpxrevadflbsxr:Atif.123@12@db.qiwjfxlpxrevadflbsxr.supabase.co:5432/postgres";

const migrationsDir = path.join(__dirname, "supabase", "migrations");

async function executeMigrationsViaPsql() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`\n📋 Found ${files.length} migration files\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    console.log(`▶️  Executing ${file}...`);

    try {
      await runSqlViaPsql(sql);
      console.log(`✅ ${file} completed\n`);
      success++;
    } catch (err) {
      console.error(`❌ ${file} failed: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ${success} passed, ${failed} failed`);
}

function runSqlViaPsql(sql) {
  return new Promise((resolve, reject) => {
    const psql = spawn("psql", [SUPABASE_DB_URL], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let output = "";
    let errorOutput = "";

    psql.stdout.on("data", (data) => {
      output += data.toString();
    });

    psql.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    psql.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(errorOutput || `psql exited with code ${code}`));
      }
    });

    psql.stdin.write(sql);
    psql.stdin.end();
  });
}

// Main execution
executeMigrationsViaPsql().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
