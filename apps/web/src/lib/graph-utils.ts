import type { Node, Edge } from "@xyflow/react";
import type { ThinkingNode, ReasoningEdge } from "@opus-nx/db";
import { EDGE_COLORS, getConfidenceColor, type EdgeType } from "./colors";
import { parseTokenUsage, truncate } from "./utils";

// ============================================================
// Types
// ============================================================

export interface GraphNode extends Node {
  data: {
    id: string;
    reasoning: string;
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
  // Arrange nodes in a hierarchical layout based on parent relationships
  const nodeMap = new Map<string, ThinkingNode>();
  const childrenMap = new Map<string, string[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    if (node.parentNodeId) {
      const siblings = childrenMap.get(node.parentNodeId) ?? [];
      siblings.push(node.id);
      childrenMap.set(node.parentNodeId, siblings);
    }
  }

  // Calculate positions using BFS
  const positions = calculateNodePositions(nodes, nodeMap, childrenMap);

  return nodes.map((node) => {
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
 * Calculate node positions for hierarchical layout.
 */
function calculateNodePositions(
  nodes: ThinkingNode[],
  nodeMap: Map<string, ThinkingNode>,
  childrenMap: Map<string, string[]>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeWidth = 280;
  const nodeHeight = 120;
  const horizontalGap = 60;
  const verticalGap = 80;

  // Find root nodes (no parent)
  const rootNodes = nodes.filter((n) => !n.parentNodeId);

  // BFS to assign positions
  let currentY = 0;

  const processLevel = (levelNodes: string[], level: number) => {
    const startX = -(levelNodes.length * (nodeWidth + horizontalGap)) / 2;

    levelNodes.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: startX + index * (nodeWidth + horizontalGap),
        y: level * (nodeHeight + verticalGap),
      });
    });

    // Process children
    const nextLevel: string[] = [];
    for (const nodeId of levelNodes) {
      const children = childrenMap.get(nodeId) ?? [];
      nextLevel.push(...children);
    }

    if (nextLevel.length > 0) {
      processLevel(nextLevel, level + 1);
    }
  };

  if (rootNodes.length > 0) {
    processLevel(
      rootNodes.map((n) => n.id),
      0
    );
  }

  // Handle orphan nodes
  let orphanX = 0;
  for (const node of nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: orphanX, y: currentY });
      orphanX += nodeWidth + horizontalGap;
    }
  }

  return positions;
}

/**
 * Transform database reasoning edges to React Flow edges.
 */
export function transformEdgesToGraph(edges: ReasoningEdge[]): GraphEdge[] {
  return edges.map((edge) => {
    const edgeType = edge.edgeType as EdgeType;
    return {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: edgeType,
      animated: edgeType === "influences",
      style: {
        stroke: EDGE_COLORS[edgeType] ?? EDGE_COLORS.influences,
        strokeWidth: Math.max(1, edge.weight * 2),
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
