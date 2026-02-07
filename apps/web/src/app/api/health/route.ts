import { getSupabase } from "@opus-nx/db";

/**
 * GET /api/health
 * Health check endpoint — verifies database connectivity and API key presence.
 */
export async function GET() {
  const checks: Record<string, string> = {};

  // Check database connectivity
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("sessions").select("id").limit(1);
    checks.database = error ? "degraded" : "connected";
  } catch {
    checks.database = "disconnected";
  }

  // Check required env vars (existence only, not values)
  checks.anthropicKey = process.env.ANTHROPIC_API_KEY ? "configured" : "missing";
  checks.supabaseUrl = process.env.SUPABASE_URL ? "configured" : "missing";
  checks.authSecret = process.env.AUTH_SECRET ? "configured" : "missing";

  const isHealthy =
    checks.database === "connected" &&
    checks.anthropicKey === "configured" &&
    checks.supabaseUrl === "configured" &&
    checks.authSecret === "configured";

  return Response.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
