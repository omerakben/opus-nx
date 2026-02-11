import { getInsightCountsByType, getAverageInsightConfidence } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") ?? undefined;

    const [counts, averageConfidence] = await Promise.all([
      getInsightCountsByType(sessionId),
      getAverageInsightConfidence(sessionId),
    ]);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return jsonSuccess({
      total,
      byType: counts,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
    }, { correlationId });
  } catch (error) {
    console.error("[API] Insights stats failed:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "INSIGHTS_STATS_FAILED",
      message: "Failed to get insight stats",
      correlationId,
    });
  }
}
