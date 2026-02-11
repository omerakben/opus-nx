import type { Node, Edge } from "@xyflow/react";
import type { StreamingThought } from "./hooks/use-got-stream";

// ============================================================
// Types
// ============================================================

export interface GoTFlowNode extends Node {
  data: {
    id: string;
    content: string;
    score: number | null;
    state: string;
    depth: number;
    parentIds: string[];
    isBestPath: boolean;
    isSelected: boolean;
  };
}

export interface GoTFlowEdge extends Edge {
  data: {
    edgeType: string;
    weight: number;
    isBestPath: boolean;
  };
}

// ============================================================
// Layout Constants
// ============================================================

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;
const H_GAP = 50;
const V_GAP = 100;

// ============================================================
// Transform Function
// ============================================================

/**
 * Transform GoT thoughts and edges into ReactFlow nodes and edges.
 * Uses hierarchical depth-based layout with best-path highlighting.
 */
export function transformGoTToFlow(
  thoughts: StreamingThought[],
  edges: Array<{ sourceId: string; targetId: string; type: string; weight: number }>,
  bestThoughts: string[],
  selectedId?: string,
): { nodes: GoTFlowNode[]; edges: GoTFlowEdge[] } {
  if (thoughts.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Build best-path set: trace back from best thoughts through parentIds[0]
  const bestPathIds = new Set<string>();
  const thoughtIndex = new Map<string, StreamingThought>();
  for (const t of thoughts) {
    thoughtIndex.set(t.id, t);
  }
  for (const bestId of bestThoughts) {
    let current = thoughtIndex.get(bestId);
    while (current) {
      bestPathIds.add(current.id);
      if (current.parentIds.length === 0) break;
      current = thoughtIndex.get(current.parentIds[0]);
    }
  }

  // Build best-path edge set
  const bestEdgeKeys = new Set<string>();
  for (const bestId of bestThoughts) {
    let current = thoughtIndex.get(bestId);
    while (current && current.parentIds.length > 0) {
      const parentId = current.parentIds[0];
      bestEdgeKeys.add(`${parentId}->${current.id}`);
      current = thoughtIndex.get(parentId);
    }
  }

  // Group thoughts by depth for layout
  const depthGroups = new Map<number, StreamingThought[]>();
  for (const t of thoughts) {
    const group = depthGroups.get(t.depth) ?? [];
    group.push(t);
    depthGroups.set(t.depth, group);
  }

  // Calculate positions: center each depth level horizontally
  const positions = new Map<string, { x: number; y: number }>();
  const depths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

  for (const depth of depths) {
    const group = depthGroups.get(depth)!;
    const totalWidth = group.length * NODE_WIDTH + (group.length - 1) * H_GAP;
    const startX = -totalWidth / 2;

    group.forEach((thought, i) => {
      positions.set(thought.id, {
        x: startX + i * (NODE_WIDTH + H_GAP),
        y: depth * (NODE_HEIGHT + V_GAP),
      });
    });
  }

  // Create ReactFlow nodes
  const flowNodes: GoTFlowNode[] = thoughts.map((t) => ({
    id: t.id,
    type: "thought",
    position: positions.get(t.id) ?? { x: 0, y: 0 },
    data: {
      id: t.id,
      content: t.content,
      score: t.score,
      state: t.state,
      depth: t.depth,
      parentIds: t.parentIds,
      isBestPath: bestPathIds.has(t.id),
      isSelected: t.id === selectedId,
    },
  }));

  // Create ReactFlow edges
  const flowEdges: GoTFlowEdge[] = edges.map((e) => {
    const isBestPath = bestEdgeKeys.has(`${e.sourceId}->${e.targetId}`);
    return {
      id: `got-edge-${e.sourceId}-${e.targetId}`,
      source: e.sourceId,
      target: e.targetId,
      type: e.type === "supports" ? "supports" : "influences",
      animated: isBestPath,
      style: {
        stroke: isBestPath ? "#f59e0b" : e.type === "supports" ? "#ec4899" : "#3b82f6",
        strokeWidth: isBestPath ? 2.5 : 1.5,
        strokeOpacity: isBestPath ? 1 : 0.6,
      },
      data: {
        edgeType: e.type,
        weight: e.weight,
        isBestPath,
      },
    };
  });

  return { nodes: flowNodes, edges: flowEdges };
}
