import { readFileSync, existsSync, watch } from "fs";
import { parse } from "yaml";
import { z } from "zod";

/**
 * Load and parse a YAML configuration file with Zod validation
 */
export function loadConfig<T extends z.ZodTypeAny>(
  path: string,
  schema: T
): z.infer<T> {
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }

  const content = readFileSync(path, "utf-8");
  const parsed = parse(content);
  return schema.parse(parsed);
}

/**
 * Watch a config file for changes and reload
 */
export function watchConfig<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  onReload: (config: z.infer<T>) => void
): () => void {
  const watcher = watch(path, () => {
    try {
      const config = loadConfig(path, schema);
      onReload(config);
    } catch (error) {
      console.error(`Failed to reload config ${path}:`, error);
    }
  });

  return () => watcher.close();
}

/**
 * Environment configuration
 *
 * We intentionally split env validation into:
 * - public/runtime-safe variables used for booting public routes
 * - workspace variables required for authenticated reasoning features
 */
export const PublicRuntimeEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  NEXT_PHASE: z.string().optional(),
  DEMO_MODE: z.enum(["true", "false"]).optional(),
});

export type PublicRuntimeEnv = z.infer<typeof PublicRuntimeEnvSchema>;

export function loadPublicRuntimeEnv(
  env: NodeJS.ProcessEnv = process.env
): PublicRuntimeEnv {
  return PublicRuntimeEnvSchema.parse(env);
}

export const WorkspaceEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  VOYAGE_API_KEY: z.string().min(1).optional(),
  TAVILY_API_KEY: z.string().min(1).optional(),
});

export type WorkspaceEnv = z.infer<typeof WorkspaceEnvSchema>;

export function loadWorkspaceEnv(
  env: NodeJS.ProcessEnv = process.env
): WorkspaceEnv {
  return WorkspaceEnvSchema.parse(env);
}

export function getWorkspaceEnvIssues(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const parsed = WorkspaceEnvSchema.safeParse(env);
  if (parsed.success) {
    return [];
  }

  return parsed.error.issues.map((issue) => {
    const key = issue.path[0] ?? "env";
    return `${String(key)}: ${issue.message}`;
  });
}

// Backward compatibility aliases for existing imports
export const EnvSchema = WorkspaceEnvSchema;
export type Env = WorkspaceEnv;
export const loadEnv = loadWorkspaceEnv;
