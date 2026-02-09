import { searchReasoningNodes } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

/**
 * GET /api/reasoning/search?sessionId=xxx&q=xxx
 * Search reasoning nodes by text content.
 */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const query = searchParams.get("q");

    if (!sessionId || !query) {
      return jsonError({
        status: 400,
        code: "MISSING_PARAMS",
        message: "sessionId and q are required",
        correlationId,
        recoverable: true,
      });
    }

    const results = await searchReasoningNodes(query, { sessionId });

    return jsonSuccess({ results }, { correlationId });
  } catch (error) {
    console.error("[API] Reasoning search failed:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SEARCH_FAILED",
      message: "Failed to search reasoning nodes",
      correlationId,
    });
  }
}
