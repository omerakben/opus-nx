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

/**
 * POST /api/insights
 * Trigger metacognitive analysis for a session.
 * Uses MetacognitionEngine to analyze thinking nodes and extract
 * patterns, biases, and improvement hypotheses.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: { message: "sessionId is required" } },
        { status: 400 }
      );
    }

    // Dynamically import MetacognitionEngine to avoid loading heavy deps on GET
    const { MetacognitionEngine } = await import("@opus-nx/core");

    const engine = new MetacognitionEngine();

    const result = await engine.analyze({
      sessionId,
      nodeLimit: 20,
      analysisScope: "session",
      focusAreas: [
        "reasoning_patterns",
        "bias_detection",
        "confidence_calibration",
        "alternative_exploration",
      ],
    });

    // Serialize dates in insights
    const serializedInsights = result.insights.map((insight) => ({
      ...insight,
      createdAt: insight.createdAt.toISOString(),
    }));

    return NextResponse.json(serializedInsights);
  } catch (error) {
    console.error("[API] Failed to run metacognitive analysis:", error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Analysis failed" } },
      { status: 500 }
    );
  }
}
