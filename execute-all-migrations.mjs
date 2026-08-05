import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://qiwjfxlpxrevadflbsxr.supabase.co";
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_ROLE_KEY";

// Create admin client with service role key (full access)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeMigrations() {
  const migrationsDir = path.join(__dirname, "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && f.match(/^\d+_/))
    .sort();

  console.log(`\n🚀 Starting migration execution...`);
  console.log(`📊 Total migrations: ${files.length}\n`);

  let successCount = 0;
  let failCount = 0;
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    const migrationNum = String(i + 1).padStart(2, " ");
    process.stdout.write(`[${migrationNum}/${files.length}] ${file}...`);

    try {
      // Use Supabase admin API to execute SQL
      // The service role key has full access to execute any SQL
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            apikey: SERVICE_ROLE_KEY,
            "X-Client-Info": "migration-executor",
          },
          body: JSON.stringify({ sql }),
        }
      );

      if (response.ok) {
        console.log(" ✅");
        successCount++;
        results.push({file, status: "success"});
      } else {
        const errorData = await response.json();
        console.log(` ❌ (${response.status})`);
        failCount++;
        results.push({file, status: "failed", error: errorData.message});
      }
    } catch (error) {
      console.log(` ❌ (${error.message})`);
      failCount++;
      results.push({file, status: "error", error: error.message});
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Migration Results:`);
  console.log(`   ✅ Success: ${successCount}/${files.length}`);
  console.log(`   ❌ Failed:  ${failCount}/${files.length}`);
  console.log(`${'='.repeat(60)}\n`);

  if (failCount > 0) {
    console.log("Failed migrations:");
    results
      .filter((r) => r.status !== "success")
      .forEach((r) => {
        console.log(`  - ${r.file}: ${r.error}`);
      });
  }

  if (successCount === files.length) {
    console.log("🎉 All migrations executed successfully!");
  } else {
    console.log(
      `⚠️  Some migrations failed. Check the errors above.`
    );
  }
}

// Run migrations
executeMigrations().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
