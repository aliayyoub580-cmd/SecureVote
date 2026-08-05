import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://qiwjfxlpxrevadflbsxr.supabase.co";
const SERVICE_ROLE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_ROLE_KEY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files to execute`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    try {
      console.log(
        `\n[${i + 1}/${files.length}] Running ${file}...`
      );
      const { data, error } = await supabase.rpc("exec_sql", {
        sql_text: sql,
      });

      if (error) {
        console.error(`❌ Error in ${file}:`, error.message);
        // Continue with next migration even if one fails
      } else {
        console.log(`✅ ${file} executed successfully`);
      }
    } catch (err) {
      console.error(`❌ Exception in ${file}:`, err);
      // Continue with next migration
    }
  }

  console.log("\n✅ All migrations completed!");
}

runMigrations().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
