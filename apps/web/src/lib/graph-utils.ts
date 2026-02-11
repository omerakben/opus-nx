import type { Node, Edge } from "@xyflow/react";
import type { ThinkingNode, ReasoningEdge } from "@opus-nx/db";
import { EDGE_COLORS, type EdgeType } from "./colors";
import { parseTokenUsage, truncate } from "./utils";

// ============================================================
// Types
// ============================================================

export interface GraphNode extends Node {
  data: {
    id: string;
    reasoning: string;
    /** Model's final output/response */
    response: string | null;
    structuredReasoning: Record<string, unknown>;
    confidence: number;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      thinkingTokens: number;
    };
    inputQuery: string | null;
    createdAt: Date;
    isSelected: boolean;
    decisionCount?: number;
    /** Node type: thinking, compaction, fork_branch, human_annotation */
    nodeType?: string;
  };
}

export interface GraphEdge extends Edge {
  data: {
    edgeType: EdgeType;
    weight: number;
  };
}

// ============================================================
// Transform Functions
// ============================================================

/**
 * Transform database thinking nodes to React Flow nodes.
 */
export function transformNodesToGraph(
  nodes: ThinkingNode[],
  selectedNodeId?: string
): GraphNode[] {
  // Deduplicate nodes by ID (guards against DB or fetch-level duplicates)
  const seen = new Set<string>();
  const uniqueNodes = nodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  // Arrange nodes in a hierarchical layout based on parent relationships
  const nodeMap = new Map<string, ThinkingNode>();
  const childrenMap = new Map<string, string[]>();

  for (const node of uniqueNodes) {
    nodeMap.set(node.id, node);
    if (node.parentNodeId) {
      const siblings = childrenMap.get(node.parentNodeId) ?? [];
      siblings.push(node.id);
      childrenMap.set(node.parentNodeId, siblings);
    }
  }

  // Calculate positions using BFS
  const positions = calculateNodePositions(uniqueNodes, nodeMap, childrenMap);

  return uniqueNodes.map((node) => {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    const usage = parseTokenUsage(node.tokenUsage);

    // Use explicit nodeType from database, falling back to "thinking"
    const dbNode = node as ThinkingNode & { nodeType?: string };
    const nodeType = dbNode.nodeType ?? "thinking";

    return {
      id: node.id,
      type: "thinking",
      position,
      data: {
        id: node.id,
        reasoning: node.reasoning,
        response: (node as ThinkingNode & { response?: string | null }).response ?? null,
        structuredReasoning: node.structuredReasoning,
        confidence: node.confidenceScore ?? 0.5,
        tokenUsage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          thinkingTokens: usage.thinkingTokens,
        },
        inputQuery: node.inputQuery,
        createdAt: node.createdAt,
        isSelected: node.id === selectedNodeId,
        nodeType,
      },
    };
  });
}

/**
 * Calculate node positions using a hierarchical tree layout.
 * Centers children under their parent for a clean visual hierarchy.
 */
function calculateNodePositions(
  nodes: ThinkingNode[],
  nodeMap: Map<string, ThinkingNode>,
  childrenMap: Map<string, string[]>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeWidth = 300;
  const nodeHeight = 160;
  const horizontalGap = 80;
  const verticalGap = 100;

  // Find root nodes (no parent or parent not in this set)
  const nodeIds = new Set(nodes.map((n) => n.id));
  const rootNodes = nodes.filter((n) => !n.parentNodeId || !nodeIds.has(n.parentNodeId));

  // Calculate subtree widths for centering
  const subtreeWidths = new Map<string, number>();

  function getSubtreeWidth(nodeId: string): number {
    if (subtreeWidths.has(nodeId)) return subtreeWidths.get(nodeId)!;

    const children = (childrenMap.get(nodeId) ?? []).filter((id) => nodeIds.has(id));
    if (children.length === 0) {
      subtreeWidths.set(nodeId, nodeWidth);
      return nodeWidth;
    }

    const childrenWidth = children.reduce(
      (sum, childId) => sum + getSubtreeWidth(childId) + horizontalGap,
      -horizontalGap
    );

    const width = Math.max(nodeWidth, childrenWidth);
    subtreeWidths.set(nodeId, width);
    return width;
  }

  // Calculate widths for all roots
  for (const root of rootNodes) {
    getSubtreeWidth(root.id);
  }

  // Position nodes top-down, centering children under parents
  function positionSubtree(nodeId: string, x: number, y: number) {
    positions.set(nodeId, { x, y });

    const children = (childrenMap.get(nodeId) ?? []).filter((id) => nodeIds.has(id));
    if (children.length === 0) return;

    const totalChildrenWidth = children.reduce(
      (sum, childId) => sum + getSubtreeWidth(childId) + horizontalGap,
      -horizontalGap
    );

    let childX = x - totalChildrenWidth / 2;

    for (const childId of children) {
      const childWidth = getSubtreeWidth(childId);
      positionSubtree(childId, childX + childWidth / 2, y + nodeHeight + verticalGap);
      childX += childWidth + horizontalGap;
    }
  }

  // Position root nodes side by side
  const totalRootWidth = rootNodes.reduce(
    (sum, root) => sum + getSubtreeWidth(root.id) + horizontalGap,
    -horizontalGap
  );

  let rootX = -totalRootWidth / 2;
  for (const root of rootNodes) {
    const width = getSubtreeWidth(root.id);
    positionSubtree(root.id, rootX + width / 2, 0);
    rootX += width + horizontalGap;
  }

  // Handle orphan nodes not in any tree
  let orphanX = -totalRootWidth / 2;
  const maxY = Math.max(0, ...Array.from(positions.values()).map((p) => p.y));
  for (const node of nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: orphanX, y: maxY + nodeHeight + verticalGap });
      orphanX += nodeWidth + horizontalGap;
    }
  }

  return positions;
}

/**
 * Transform database reasoning edges to React Flow edges.
 *
 * Edge IDs are prefixed with "edge-" to prevent key collisions with node IDs,
 * since React Flow renders nodes and edges as siblings in the DOM.
 */
export function transformEdgesToGraph(edges: ReasoningEdge[]): GraphEdge[] {
  // Deduplicate edges by ID (guards against DB-level duplicates from race conditions)
  const seen = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  return uniqueEdges.map((edge) => {
    const edgeType = edge.edgeType as EdgeType;
    const color = EDGE_COLORS[edgeType] ?? EDGE_COLORS.influences;
    return {
      id: `edge-${edge.id}`,
      source: edge.sourceId,
      target: edge.targetId,
      type: edgeType,
      animated: true,
      label: edgeType,
      labelStyle: { fill: color, fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: "var(--background)", fillOpacity: 0.85 },
      labelBgPadding: [4, 2] as [number, number],
      style: {
        stroke: color,
        strokeWidth: Math.max(1.5, edge.weight * 2.5),
        strokeOpacity: 0.8,
      },
      data: {
        edgeType,
        weight: edge.weight,
      },
    };
  });
}

/**
 * Get summary text for a node.
 */
export function getNodeSummary(node: GraphNode): string {
  if (node.data.inputQuery) {
    return truncate(node.data.inputQuery, 80);
  }
  return truncate(node.data.reasoning, 80);
}

/**
 * Group nodes by confidence level for statistics.
 */
export function groupNodesByConfidence(nodes: GraphNode[]): {
  low: number;
  medium: number;
  high: number;
} {
  return nodes.reduce(
    (acc, node) => {
      const confidence = node.data.confidence;
      if (confidence < 0.5) {
        acc.low++;
      } else if (confidence < 0.8) {
        acc.medium++;
      } else {
        acc.high++;
      }
      return acc;
    },
    { low: 0, medium: 0, high: 0 }
  );
}

/**
 * Calculate total token usage across nodes.
 */
export function calculateTotalTokens(nodes: GraphNode[]): {
  input: number;
  output: number;
  thinking: number;
  total: number;
} {
  const totals = nodes.reduce(
    (acc, node) => {
      acc.input += node.data.tokenUsage.inputTokens;
      acc.output += node.data.tokenUsage.outputTokens;
      acc.thinking += node.data.tokenUsage.thinkingTokens;
      return acc;
    },
    { input: 0, output: 0, thinking: 0 }
  );

  return {
    ...totals,
    total: totals.input + totals.output + totals.thinking,
  };
}
