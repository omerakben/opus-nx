import { NextResponse } from "next/server";
import { getActiveSessions, createSession, getSessionThinkingNodes } from "@/lib/db";

/**
 * GET /api/sessions
 * Retrieve all active sessions with display names from first query
 */
export async function GET() {
  try {
    const sessions = await getActiveSessions();

    // Fetch first node's input_query for each session to derive display name
    const sessionsWithNames = await Promise.all(
      sessions.map(async (session) => {
        let displayName: string | null = null;
        try {
          const nodes = await getSessionThinkingNodes(session.id, { limit: 1 });
          if (nodes.length > 0 && nodes[0].inputQuery) {
            displayName = nodes[0].inputQuery;
          }
        } catch {
          // Ignore — display name is optional
        }
        return {
          ...session,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
          displayName,
        };
      })
    );

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
