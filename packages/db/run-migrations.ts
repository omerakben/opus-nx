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
    "003_node_type.sql",
  ];

  const failures: string[] = [];

  for (const migration of migrations) {
    const filePath = join(__dirname, "migrations", migration);
    console.log(`\nRunning migration: ${migration}`);

    try {
      const sql = readFileSync(filePath, "utf-8");
      const statements = splitSqlStatements(sql);

      let executed = 0;
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt || stmt.startsWith("--")) continue;

        const { error } = await supabase.rpc("exec_sql", { sql_string: stmt });

        if (error) {
          throw new Error(`Statement ${i + 1} failed in ${migration}: ${error.message}`);
        }

        executed++;
        process.stdout.write(".");
      }

      console.log(`\n   OK ${migration} (${executed} statements)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n   FAILED ${migration}: ${message}`);
      failures.push(`${migration}: ${message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Migration run failed with ${failures.length} failure(s):\n- ${failures.join("\n- ")}`);
  }

  console.log("\nAll migrations completed successfully.");
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inFunction = false;

  const lines = sql.split("\n");

  for (const line of lines) {
    if (line.includes("$$") && !inFunction) {
      inFunction = true;
    } else if (line.includes("$$") && inFunction) {
      inFunction = false;
    }

    current += line + "\n";

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

runMigrations().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
