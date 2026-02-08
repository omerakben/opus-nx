import { POST as streamPost } from "../../thinking/stream/route";
import { getCorrelationId, jsonError } from "@/lib/api-response";
import { isValidUuid } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/stream/:sessionId
 * Compatibility alias that forwards to POST /api/thinking/stream.
 * Requires `query` in search params since GET has no request body.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const correlationId = getCorrelationId(request);
  const { sessionId } = await params;

  // FIX: Validate UUID format before forwarding to stream route.
  // This prevents malformed session IDs from reaching the database layer.
  if (!isValidUuid(sessionId)) {
    return jsonError({
      status: 400,
      code: "INVALID_UUID_FORMAT",
      message: "Invalid session ID format. Expected a valid UUID.",
      correlationId,
      recoverable: true,
    });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query");
  const effortRaw = url.searchParams.get("effort");
  const compactionRaw = url.searchParams.get("compactionEnabled");

  if (!query?.trim()) {
    return jsonError({
      status: 400,
      code: "QUERY_REQUIRED",
      message: "Provide ?query=... when using GET /api/stream/:sessionId",
      correlationId,
      recoverable: true,
    });
  }

  const effort = effortRaw && ["low", "medium", "high", "max"].includes(effortRaw)
    ? effortRaw
    : "high";
  const compactionEnabled = compactionRaw === "true";
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");

  const forwarded = new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      sessionId,
      effort,
      compactionEnabled,
    }),
  });

  return streamPost(forwarded);
}
