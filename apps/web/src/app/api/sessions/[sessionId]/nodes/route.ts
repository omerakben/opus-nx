import { getSessionThinkingNodes, getEdgesFromNode } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

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

    // Get all thinking nodes for the session.
    const nodes = await getSessionThinkingNodes(sessionId, { limit: 100 });

    // Get edges for each node.
    const allEdges = await Promise.all(nodes.map((node) => getEdgesFromNode(node.id)));

    // Flatten and deduplicate edges.
    const edgeMap = new Map<string, typeof allEdges[0][0]>();
    for (const edges of allEdges) {
      for (const edge of edges) {
        edgeMap.set(edge.id, edge);
      }
    }

    const edges = Array.from(edgeMap.values());

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
