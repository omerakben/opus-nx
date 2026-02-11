import { createClient, SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClientType | null = null;

/**
 * Build a fresh Supabase client from env vars.
 */
function buildClient(): SupabaseClientType {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get the Supabase client instance.
 * Uses singleton pattern to ensure only one client exists.
 */
export function getSupabase(): SupabaseClientType {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = buildClient();
  return supabaseInstance;
}

/**
 * Reset the singleton client so the next getSupabase() call creates a fresh one.
 * Call this when a query fails with a connection-level error (e.g. ECONNRESET,
 * FetchError, socket hang up) to recover from stale connections in long-lived
 * serverless / edge environments.
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

/**
 * Execute a Supabase operation with automatic client recovery on connection errors.
 * If the operation fails with a connection-level error, the singleton client is
 * recreated and the operation is retried once.
 */
export async function withSupabaseRetry<T>(
  operation: (client: SupabaseClientType) => Promise<T>
): Promise<T> {
  try {
    return await operation(getSupabase());
  } catch (error) {
    if (isConnectionError(error)) {
      resetSupabaseClient();
      return await operation(getSupabase());
    }
    throw error;
  }
}

/**
 * Detect connection-level errors that warrant recreating the client.
 */
function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("socket hang up") ||
    msg.includes("fetch failed") ||
    msg.includes("network error") ||
    msg.includes("aborted") ||
    msg.includes("etimedout")
  );
}

/**
 * Create a new Supabase client with custom options
 * Use this when you need a client with different auth or for specific use cases
 */
export function createSupabaseClient(
  url: string,
  key: string,
  options?: Parameters<typeof createClient>[2]
): SupabaseClientType {
  return createClient(url, key, options);
}

export type { SupabaseClientType as SupabaseClient };
