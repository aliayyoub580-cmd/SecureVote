import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://qiwjfxlpxrevadflbsxr.supabase.co";
const SERVICE_ROLE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_ROLE_KEY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function splitSQL(sqlContent) {
  // Split by double semicolon (end of statement block)
  // Handle PostgreSQL do blocks, functions, etc.
  const statements = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let inBlock = false;

  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const nextChar = i + 1 < sqlContent.length ? sqlContent[i + 1] : "";

    // Handle string literals
    if ((char === '"' || char === "'") && (i === 0 || sqlContent[i - 1] !== "\\")) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
    }

    // Handle $$ delimiters
    if (char === "$" && nextChar === "$" && !inString) {
      inBlock = !inBlock;
      current += "$$";
      i++; // Skip next $
      continue;
    }

    current += char;

    // Check for statement end (semicolon followed by newline or comment)
    if (char === ";" && !inString && !inBlock) {
      const trimmed = current.trim();
      if (trimmed && trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = "";
    }
  }

  // Add any remaining content
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function executeMigrations() {
  try {
    const migrationsDir = path.join(__dirname, "supabase", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`\n📋 Found ${files.length} migration files:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log("\n▶️  Starting migrations execution...\n");

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      try {
        console.log(
          `[${i + 1}/${files.length}] Executing ${file}...`
        );

        // Use the admin API to execute raw SQL
        const { data, error } = await supabase.rpc("exec_sql", {
          sql: sql,
        });

        if (error) {
          console.error(`  ❌ Error: ${error.message}`);
          failCount++;
        } else {
          console.log(`  ✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.error(
          `  ❌ Exception: ${err.message}`
        );
        failCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📈 Total: ${files.length}\n`);

    if (failCount === 0) {
      console.log("🎉 All migrations completed successfully!");
    } else {
      console.log(
        `⚠️  ${failCount} migrations failed. Check logs above for details.`
      );
    }
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

executeMigrations();
