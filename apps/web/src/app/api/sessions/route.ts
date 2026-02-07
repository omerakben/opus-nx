import { NextResponse } from "next/server";
import { getActiveSessions, createSession, getFirstNodePerSessions } from "@/lib/db";

/**
 * GET /api/sessions
 * Retrieve all active sessions with display names from first query.
 * Uses a single batch query for first nodes to avoid N+1.
 */
export async function GET() {
  try {
    const sessions = await getActiveSessions();

    // Batch-fetch the first (earliest) node per session in a single query
    const sessionIds = sessions.map((s) => s.id);
    let firstNodeMap = new Map<string, { inputQuery: string | null }>();
    try {
      firstNodeMap = await getFirstNodePerSessions(sessionIds);
    } catch {
      // Non-critical — display names are optional
    }

    const sessionsWithNames = sessions.map((session) => {
      const firstNode = firstNodeMap.get(session.id);
      const displayName = firstNode?.inputQuery ?? null;
      // Use currentPlan metadata for demo flag if set by seed route
      const plan = session.currentPlan as Record<string, unknown> | undefined;
      return {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        displayName: displayName ?? (plan?.displayName as string | undefined) ?? null,
        isDemo: plan?.isDemo === true,
      };
    });

    return NextResponse.json(sessionsWithNames);
  } catch (error) {
    console.error("[API] Failed to get sessions:", error);
    return NextResponse.json(
      { error: { message: "Failed to get sessions" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions
 * Create a new session
 */
export async function POST() {
  try {
    const session = await createSession();

    return NextResponse.json({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to create session:", error);
    return NextResponse.json(
      { error: { message: "Failed to create session" } },
      { status: 500 }
    );
  }
}
