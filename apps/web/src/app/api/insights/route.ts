import { NextResponse } from "next/server";
import { getSessionInsights, getRecentInsights } from "@/lib/db";

/**
 * GET /api/insights
 * Get metacognitive insights for a session or recent insights
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    let insights;

    if (sessionId) {
      insights = await getSessionInsights(sessionId, { limit });
    } else {
      insights = await getRecentInsights({ limit });
    }

    // Serialize dates
    const serializedInsights = insights.map((insight) => ({
      ...insight,
      createdAt: insight.createdAt.toISOString(),
    }));

    return NextResponse.json(serializedInsights);
  } catch (error) {
    console.error("[API] Failed to get insights:", error);
    return NextResponse.json(
      { error: { message: "Failed to get insights" } },
      { status: 500 }
    );
  }
}
