import { NextResponse } from "next/server";
import { getActiveSessions, createSession } from "@/lib/db";

/**
 * GET /api/sessions
 * Retrieve all active sessions
 */
export async function GET() {
  try {
    const sessions = await getActiveSessions();

    // Transform dates to ISO strings for JSON serialization
    const serializedSessions = sessions.map((session) => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }));

    return NextResponse.json(serializedSessions);
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
