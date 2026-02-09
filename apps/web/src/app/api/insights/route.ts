import { getSessionInsights, getRecentInsights, type InsightType } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

/**
 * GET /api/insights
 * Get metacognitive insights for a session or recent insights
 */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    let insights;

    const types = searchParams.get("types")?.split(",").filter(Boolean) as InsightType[] | undefined;
    const minConfidence = searchParams.has("minConfidence") ? parseFloat(searchParams.get("minConfidence")!) : undefined;

    if (sessionId) {
      insights = await getSessionInsights(sessionId, { limit, types, minConfidence });
    } else {
      insights = await getRecentInsights({ limit, types });
    }

    const serializedInsights = insights.map((insight) => ({
      ...insight,
      createdAt: insight.createdAt.toISOString(),
    }));

    return jsonSuccess(serializedInsights, { correlationId });
  } catch (error) {
    console.error("[API] Failed to get insights:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "INSIGHTS_FETCH_FAILED",
      message: "Failed to get insights",
      correlationId,
    });
  }
}

/**
 * POST /api/insights
 * Trigger metacognitive analysis for a session.
 * Uses MetacognitionEngine to analyze thinking nodes and extract
 * patterns, biases, and improvement hypotheses.
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonError({
        status: 400,
        code: "INVALID_JSON",
        message: "Invalid JSON in request body",
        correlationId,
        recoverable: true,
      });
    }

    const { sessionId, nodeLimit, focusAreas } = body as {
      sessionId?: string;
      nodeLimit?: number;
      focusAreas?: string[];
    };

    if (!sessionId) {
      return jsonError({
        status: 400,
        code: "SESSION_ID_REQUIRED",
        message: "sessionId is required",
        correlationId,
        recoverable: true,
      });
    }

    const { MetacognitionEngine } = await import("@opus-nx/core");
    const engine = new MetacognitionEngine();

    type FocusArea = "bias_detection" | "decision_quality" | "reasoning_patterns" | "confidence_calibration" | "alternative_exploration";
    const defaultAreas: FocusArea[] = [
      "reasoning_patterns",
      "bias_detection",
      "confidence_calibration",
      "alternative_exploration",
    ];

    const result = await engine.analyze({
      sessionId,
      nodeLimit: typeof nodeLimit === "number" ? nodeLimit : 20,
      analysisScope: "session",
      focusAreas: Array.isArray(focusAreas)
        ? (focusAreas as FocusArea[])
        : defaultAreas,
    });

    const serializedInsights = result.insights.map((insight) => ({
      ...insight,
      createdAt: insight.createdAt.toISOString(),
    }));

    return jsonSuccess(
      {
        insights: serializedInsights,
        nodesAnalyzed: result.nodesAnalyzed ?? 0,
        summary: result.summary ?? null,
        errors: result.errors ?? [],
        hallucinationCount: result.hallucinationCount ?? 0,
        invalidNodeRefs: result.invalidNodeRefs ?? [],
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Failed to run metacognitive analysis:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "INSIGHTS_ANALYSIS_FAILED",
      message: error instanceof Error ? error.message : "Analysis failed",
      correlationId,
    });
  }
}
