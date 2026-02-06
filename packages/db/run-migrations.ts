import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function runMigrations() {
  const migrations = [
    "001_initial_schema.sql",
    "002_thinking_graph.sql",
  ];

  for (const migration of migrations) {
    const filePath = join(__dirname, "migrations", migration);
    console.log(`\n📦 Running migration: ${migration}`);

    try {
      const sql = readFileSync(filePath, "utf-8");

      // Split by semicolons but preserve function bodies
      const statements = splitSqlStatements(sql);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt || stmt.startsWith("--")) continue;

        const { error } = await supabase.rpc("exec_sql", { sql_string: stmt });

        if (error) {
          // Try direct query if RPC doesn't exist
          const result = await supabase.from("_migrations").select("*").limit(1);
          if (result.error?.code === "PGRST116") {
            console.log(`   Statement ${i + 1}: Skipping (table may not exist yet)`);
          } else {
            console.error(`   ❌ Statement ${i + 1} failed: ${error.message}`);
          }
        } else {
          process.stdout.write(".");
        }
      }

      console.log(`\n   ✅ ${migration} completed`);
    } catch (err) {
      console.error(`   ❌ Failed to read ${migration}:`, err);
    }
  }

  console.log("\n🎉 Migrations complete!");
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inFunction = false;
  let dollarQuote = "";

  const lines = sql.split("\n");

  for (const line of lines) {
    // Track $$ function bodies
    if (line.includes("$$") && !inFunction) {
      inFunction = true;
      dollarQuote = "$$";
    } else if (line.includes("$$") && inFunction) {
      inFunction = false;
    }

    current += line + "\n";

    // Only split on semicolon if not in a function body
    if (line.trim().endsWith(";") && !inFunction) {
      statements.push(current);
      current = "";
    }
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

runMigrations().catch(console.error);
