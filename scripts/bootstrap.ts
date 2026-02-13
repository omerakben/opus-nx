import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type EnsureResult = {
  path: string;
  created: boolean;
  updated: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

const rootEnvPath = resolve(repoRoot, ".env");
const rootEnvExamplePath = resolve(repoRoot, ".env.example");
const agentsEnvPath = resolve(repoRoot, "agents", ".env");
const agentsEnvExamplePath = resolve(repoRoot, "agents", ".env.example");

function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

function normalizeFile(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function extractEnvValue(content: string, key: string): string | null {
  const pattern = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function isPlaceholderSecret(value: string | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "change-me" || normalized === "changeme";
}

function upsertEnvValue(content: string, key: string, value: string): string {
  const lines = content.split("\n");
  let found = false;

  const nextLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    nextLines.push(`${key}=${value}`);
  }

  return normalizeFile(nextLines.join("\n"));
}

function loadTemplate(templatePath: string): string {
  if (existsSync(templatePath)) {
    return normalizeFile(readText(templatePath));
  }
  return "";
}

function ensureFileFromTemplate(path: string, templatePath: string): EnsureResult {
  if (existsSync(path)) {
    return { path, created: false, updated: false };
  }

  const template = loadTemplate(templatePath);
  writeFileSync(path, template, "utf-8");
  return { path, created: true, updated: false };
}

function ensureAuthSecret(path: string, secret: string): EnsureResult {
  const content = normalizeFile(readText(path));
  const before = content;
  const after = upsertEnvValue(content, "AUTH_SECRET", secret);

  if (before === after) {
    return { path, created: false, updated: false };
  }

  writeFileSync(path, after, "utf-8");
  return { path, created: false, updated: true };
}

function printResult(label: string, result: EnsureResult): void {
  const status = result.created ? "created" : result.updated ? "updated" : "unchanged";
  console.log(`${label}: ${status} (${result.path})`);
}

function main(): void {
  const generatedSecret = randomBytes(32).toString("hex");

  const rootCreated = ensureFileFromTemplate(rootEnvPath, rootEnvExamplePath);
  const agentsCreated = ensureFileFromTemplate(agentsEnvPath, agentsEnvExamplePath);

  let rootContent = normalizeFile(readText(rootEnvPath));
  let rootSecret = extractEnvValue(rootContent, "AUTH_SECRET");

  if (isPlaceholderSecret(rootSecret)) {
    const rootUpdated = ensureAuthSecret(rootEnvPath, generatedSecret);
    rootContent = normalizeFile(readText(rootEnvPath));
    rootSecret = extractEnvValue(rootContent, "AUTH_SECRET");
    printResult(".env AUTH_SECRET", rootUpdated);
  }

  const resolvedSecret = rootSecret && !isPlaceholderSecret(rootSecret)
    ? rootSecret
    : generatedSecret;

  const agentsContent = normalizeFile(readText(agentsEnvPath));
  const agentsSecret = extractEnvValue(agentsContent, "AUTH_SECRET");
  if (agentsSecret !== resolvedSecret) {
    const agentsUpdated = ensureAuthSecret(agentsEnvPath, resolvedSecret);
    printResult("agents/.env AUTH_SECRET", agentsUpdated);
  }

  printResult(".env", rootCreated);
  printResult("agents/.env", agentsCreated);

  console.log("");
  console.log("Bootstrap complete.");
  console.log("Next steps:");
  console.log("1. Fill provider credentials in .env and agents/.env");
  console.log("2. Run `pnpm setup:verify`");
  console.log("3. Start the app with `pnpm dev`");
}

main();
