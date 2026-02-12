import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type MigrationMode = "local" | "linked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

function detectMigrationMode(): MigrationMode {
  const argMode = process.argv.find((arg) => arg.startsWith("--mode="));
  if (argMode) {
    const value = argMode.split("=")[1]?.trim().toLowerCase();
    if (value === "local" || value === "linked") {
      return value;
    }
  }

  const envMode = process.env.SUPABASE_MIGRATION_MODE?.trim().toLowerCase();
  if (envMode === "local" || envMode === "linked") {
    return envMode;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  if (
    supabaseUrl.includes("localhost") ||
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("host.docker.internal")
  ) {
    return "local";
  }

  return "linked";
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status}: ${command} ${args.join(" ")}`
    );
  }
}

function runMigrations(): void {
  const supabaseDir = resolve(repoRoot, "supabase");
  if (!existsSync(supabaseDir)) {
    throw new Error(`Supabase directory not found at ${supabaseDir}`);
  }

  const mode = detectMigrationMode();
  console.log(`[db:migrate] mode=${mode}`);

  if (mode === "local") {
    // Local/dev workflow: rebuild local DB from canonical migrations.
    run("pnpm", ["--filter", "@opus-nx/db", "exec", "supabase", "db", "reset", "--local"]);
    console.log("[db:migrate] local reset complete");
    return;
  }

  // Linked env workflow: push pending migrations to linked project.
  run("pnpm", ["--filter", "@opus-nx/db", "exec", "supabase", "db", "push"]);
  console.log("[db:migrate] linked push complete");
}

try {
  runMigrations();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
