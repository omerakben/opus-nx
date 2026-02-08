import { getSessionThinkingNodes, getEdgesForNodes } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { isValidUuid } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/sessions/:sessionId/nodes
 * Get all thinking nodes and edges for a session
 */
export async function GET(request: Request, { params }: RouteParams) {
  const correlationId = getCorrelationId(request);

  try {
    const { sessionId } = await params;

    // FIX: Validate UUID format before database query to prevent
    // malformed IDs from reaching the database layer.
    // This protects against SQL injection and provides better error messages.
    if (!isValidUuid(sessionId)) {
      return jsonError({
        status: 400,
        code: "INVALID_UUID_FORMAT",
        message: "Invalid session ID format. Expected a valid UUID.",
        correlationId,
        recoverable: true,
      });
    }

    // Get all thinking nodes for the session.
    const nodes = await getSessionThinkingNodes(sessionId, { limit: 100 });

    // Get all edges in a single batch query instead of N+1 per-node queries.
    const nodeIds = nodes.map((node) => node.id);
    const edges = await getEdgesForNodes(nodeIds);

    const serializedNodes = nodes.map((node) => ({
      ...node,
      createdAt: node.createdAt.toISOString(),
    }));

    const serializedEdges = edges.map((edge) => ({
      ...edge,
      createdAt: edge.createdAt.toISOString(),
    }));

    return jsonSuccess(
      {
        nodes: serializedNodes,
        edges: serializedEdges,
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Failed to get session nodes:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SESSION_NODES_FETCH_FAILED",
      message: "Failed to get session nodes",
      correlationId,
    });
  }
}
