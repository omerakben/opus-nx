import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

function listSqlFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function fail(message: string): never {
  console.error(`[migration-drift] ${message}`);
  process.exit(1);
}

const root = process.cwd();
const canonicalDir = join(root, "supabase", "migrations");
const mirrorDir = join(root, "packages", "db", "migrations");

const canonicalFiles = listSqlFiles(canonicalDir);
const mirrorFiles = listSqlFiles(mirrorDir);

const canonicalSet = new Set(canonicalFiles);
const mirrorSet = new Set(mirrorFiles);

const missingInMirror = canonicalFiles.filter((f) => !mirrorSet.has(f));
const extraInMirror = mirrorFiles.filter((f) => !canonicalSet.has(f));

if (missingInMirror.length > 0 || extraInMirror.length > 0) {
  fail(
    [
      "Migration file list drift detected.",
      missingInMirror.length > 0 ? `Missing in mirror (${relative(root, mirrorDir)}): ${missingInMirror.join(", ")}` : "",
      extraInMirror.length > 0 ? `Extra in mirror (${relative(root, mirrorDir)}): ${extraInMirror.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" ")
  );
}

for (const file of canonicalFiles) {
  const canonicalPath = join(canonicalDir, file);
  const mirrorPath = join(mirrorDir, file);

  const canonicalContent = readFileSync(canonicalPath, "utf-8").replace(/\r\n/g, "\n").trim();
  const mirrorContent = readFileSync(mirrorPath, "utf-8").replace(/\r\n/g, "\n").trim();

  if (canonicalContent !== mirrorContent) {
    fail(
      `Content drift detected for ${file} between ${relative(root, canonicalPath)} and ${relative(root, mirrorPath)}.`
    );
  }
}

console.log("[migration-drift] OK - mirror matches canonical migrations.");
