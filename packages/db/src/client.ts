import { createClient, SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClientType | null = null;

/**
 * Get the Supabase client instance
 * Uses singleton pattern to ensure only one client exists
 */
export function getSupabase(): SupabaseClientType {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
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
