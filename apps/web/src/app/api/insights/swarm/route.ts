import { createMetacognitiveInsight, type InsightType } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

/**
 * POST /api/insights/swarm
 * Bridge route: persists swarm metacognition insights to the metacognitive_insights table
 * so the Insights panel can display them after a browser refresh.
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const body = await request.json();
    const { sessionId, insightType, insight, confidence, agents } = body as {
      sessionId?: string;
      insightType?: InsightType;
      insight?: string;
      confidence?: number;
      agents?: string[];
    };

    if (!insight || !insightType) {
      return jsonError({
        status: 400,
        code: "MISSING_FIELDS",
        message: "insight and insightType are required",
        correlationId,
        recoverable: true,
      });
    }

    const created = await createMetacognitiveInsight({
      sessionId: sessionId ?? null,
      thinkingNodesAnalyzed: [],
      insightType,
      insight,
      confidence: confidence ?? 0.75,
      metadata: { source: "swarm_v2", agents: agents ?? [] },
    });

    return jsonSuccess({ id: created.id }, { correlationId, status: 201 });
  } catch (error) {
    console.error("[API] Failed to bridge swarm insight:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SWARM_INSIGHT_BRIDGE_FAILED",
      message: "Failed to persist swarm insight",
      correlationId,
    });
  }
}
