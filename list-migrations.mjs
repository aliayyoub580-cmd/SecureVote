import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all individual migration files sorted
const migrationsDir = path.join(__dirname, "supabase", "migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && f.match(/^\d+_/))
  .sort();

console.log(`\n📋 Found ${files.length} migration files\n`);
console.log("Migration Files:");
files.forEach((f, i) => {
  const size = fs.statSync(path.join(migrationsDir, f)).size;
  console.log(`  ${String(i + 1).padStart(2, " ")}. ${f.padEnd(50, " ")} (${size} bytes)`);
});

console.log(`\n💾 Total migrations to execute: ${files.length}\n`);
console.log("📝 To manually execute migrations in Supabase SQL Editor:");
console.log("   1. Go to SQL Editor in Supabase dashboard");
console.log("   2. For each migration below, copy the file contents and paste into the editor");
console.log("   3. Click 'Run' and confirm it succeeds before moving to the next\n");

// Calculate total size
let totalSize = 0;
files.forEach((f) => {
  totalSize += fs.statSync(path.join(migrationsDir, f)).size;
});

console.log(`📊 Total SQL to execute: ${(totalSize / 1024).toFixed(2)} KB\n`);

// Show first few lines of consolidated migrations
const consolidatedPath = path.join(__dirname, "supabase", "consolidated-migrations.sql");
if (fs.existsSync(consolidatedPath)) {
  const content = fs.readFileSync(consolidatedPath, "utf-8");
  const lines = content.split("\n");
  console.log("🔗 Consolidated migrations file exists and contains:");
  console.log(`   Total size: ${(content.length / 1024).toFixed(2)} KB`);
  console.log(`   Total lines: ${lines.length}\n`);
}

console.log("✨ All migration files are ready for execution!\n");
