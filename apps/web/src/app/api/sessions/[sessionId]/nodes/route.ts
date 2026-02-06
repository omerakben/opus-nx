import { NextResponse } from "next/server";
import { getSessionThinkingNodes, getEdgesFromNode } from "@/lib/db";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/sessions/:sessionId/nodes
 * Get all thinking nodes and edges for a session
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    // Get all thinking nodes for the session
    const nodes = await getSessionThinkingNodes(sessionId, { limit: 100 });

    // Get edges for each node
    const allEdges = await Promise.all(
      nodes.map((node) => getEdgesFromNode(node.id))
    );

    // Flatten and deduplicate edges
    const edgeMap = new Map<string, typeof allEdges[0][0]>();
    for (const edges of allEdges) {
      for (const edge of edges) {
        edgeMap.set(edge.id, edge);
      }
    }

    const edges = Array.from(edgeMap.values());

    // Serialize dates
    const serializedNodes = nodes.map((node) => ({
      ...node,
      createdAt: node.createdAt.toISOString(),
    }));

    const serializedEdges = edges.map((edge) => ({
      ...edge,
      createdAt: edge.createdAt.toISOString(),
    }));

    return NextResponse.json({
      nodes: serializedNodes,
      edges: serializedEdges,
    });
  } catch (error) {
    console.error("[API] Failed to get session nodes:", error);
    return NextResponse.json(
      { error: { message: "Failed to get session nodes" } },
      { status: 500 }
    );
  }
}
