import {
  getThinkingNode,
  getDecisionPoints,
  getEdgesFromNode,
  getEdgesToNode,
} from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { isValidUuid } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reasoning/:id
 * Retrieve a single reasoning node with decision points and related edges.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const correlationId = getCorrelationId(request);

  try {
    const { id } = await params;

    // FIX: Validate UUID format before database query to prevent
    // malformed IDs from reaching the database layer.
    // This protects against SQL injection and provides better error messages.
    if (!isValidUuid(id)) {
      return jsonError({
        status: 400,
        code: "INVALID_UUID_FORMAT",
        message: "Invalid reasoning node ID format. Expected a valid UUID.",
        correlationId,
        recoverable: true,
      });
    }

    const node = await getThinkingNode(id);

    if (!node) {
      return jsonError({
        status: 404,
        code: "REASONING_NODE_NOT_FOUND",
        message: "Reasoning node not found",
        correlationId,
        recoverable: true,
      });
    }

    const [decisionPoints, outgoingEdges, incomingEdges] = await Promise.all([
      getDecisionPoints(id),
      getEdgesFromNode(id),
      getEdgesToNode(id),
    ]);

    return jsonSuccess(
      {
        node: {
          ...node,
          createdAt: node.createdAt.toISOString(),
        },
        decisionPoints: decisionPoints.map((point) => ({
          ...point,
          createdAt: point.createdAt.toISOString(),
        })),
        related: {
          incomingEdges: incomingEdges.map((edge) => ({
            ...edge,
            createdAt: edge.createdAt.toISOString(),
          })),
          outgoingEdges: outgoingEdges.map((edge) => ({
            ...edge,
            createdAt: edge.createdAt.toISOString(),
          })),
        },
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Failed to fetch reasoning node:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "REASONING_NODE_FETCH_FAILED",
      message: "Failed to fetch reasoning node",
      correlationId,
    });
  }
}
