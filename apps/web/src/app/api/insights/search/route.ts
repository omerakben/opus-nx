import { searchInsights } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const sessionId = searchParams.get("sessionId") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    if (!query) {
      return jsonError({
        status: 400,
        code: "QUERY_REQUIRED",
        message: "Search query (q) is required",
        correlationId,
        recoverable: true,
      });
    }

    const insights = await searchInsights(query, { limit, sessionId });

    const serialized = insights.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    }));

    return jsonSuccess(serialized, { correlationId });
  } catch (error) {
    console.error("[API] Insights search failed:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "INSIGHTS_SEARCH_FAILED",
      message: "Search failed",
      correlationId,
    });
  }
}
