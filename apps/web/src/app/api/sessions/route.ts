import { getActiveSessions, createSession, getFirstNodePerSessions } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

/**
 * GET /api/sessions
 * Retrieve all active sessions with display names from first query.
 * Uses a single batch query for first nodes to avoid N+1.
 */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const sessions = await getActiveSessions();

    // Batch-fetch the first (earliest) node per session in a single query.
    const sessionIds = sessions.map((s) => s.id);
    let firstNodeMap: Awaited<ReturnType<typeof getFirstNodePerSessions>> = new Map();
    let displayNameStatus: "ok" | "degraded" = "ok";

    try {
      firstNodeMap = await getFirstNodePerSessions(sessionIds);
    } catch (error) {
      displayNameStatus = "degraded";
      console.warn("[API] Failed to enrich sessions with first nodes", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const sessionsWithNames = sessions.map((session) => {
      const firstNode = firstNodeMap.get(session.id);
      // Prefer inputQuery (set by Node.js thinking engine).
      // Fall back to response text (swarm nodes have query text there).
      // Truncate long content to a reasonable display name length.
      const rawName =
        firstNode?.inputQuery ??
        firstNode?.response ??
        firstNode?.reasoning ??
        null;
      const displayName = rawName ? rawName.slice(0, 120) : null;
      const plan = session.currentPlan as Record<string, unknown> | undefined;

      return {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        displayName: displayName ?? (plan?.displayName as string | undefined) ?? null,
        isDemo: plan?.isDemo === true,
        displayNameStatus,
      };
    });

    return jsonSuccess(sessionsWithNames, { correlationId });
  } catch (error) {
    console.error("[API] Failed to get sessions:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SESSIONS_FETCH_FAILED",
      message: "Failed to get sessions",
      correlationId,
    });
  }
}

/**
 * POST /api/sessions
 * Create a new session
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await createSession();

    return jsonSuccess(
      {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Failed to create session:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SESSION_CREATE_FAILED",
      message: "Failed to create session",
      correlationId,
    });
  }
}
