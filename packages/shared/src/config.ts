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
 */
export const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  VOYAGE_API_KEY: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  return EnvSchema.parse(process.env);
}
