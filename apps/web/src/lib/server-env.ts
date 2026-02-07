import { loadEnv, type Env } from "@opus-nx/shared";

let cachedEnv: Env | null = null;

export function ensureServerEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = loadEnv();
  return cachedEnv;
}
