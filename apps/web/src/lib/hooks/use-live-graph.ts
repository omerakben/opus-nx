"use client";

import { useMemo } from "react";
import type { GraphNode, GraphEdge } from "@/lib/graph-utils";
import type { StreamingNode as StreamingNodeType } from "./use-thinking-stream";

interface UseLiveGraphOptions {
  persistedNodes: GraphNode[];
  persistedEdges: GraphEdge[];
  isStreaming: boolean;
  streamingNodes: StreamingNodeType[];
  phase: "analyzing" | "reasoning" | "deciding" | "concluding" | "compacting" | null;
  tokenCount: number;
}

interface UseLiveGraphReturn {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Merges persisted graph nodes with provisional streaming nodes.
 * During streaming, a "live" node appears in the graph with real-time updates.
 * When streaming completes, the persisted graph refreshes and replaces the provisional node.
 */
export function useLiveGraph({
  persistedNodes,
  persistedEdges,
  isStreaming,
  streamingNodes,
  phase,
  tokenCount,
}: UseLiveGraphOptions): UseLiveGraphReturn {
  const mergedNodes = useMemo(() => {
    if (!isStreaming || streamingNodes.length === 0) {
      return persistedNodes;
    }

    // Find the latest streaming node
    const latestStreaming = streamingNodes[streamingNodes.length - 1];

    // Calculate position for the streaming node
    // Place it below the last persisted node, or at origin if no nodes
    let streamX = 0;
    let streamY = 100;

    if (persistedNodes.length > 0) {
      // Find the node with the highest Y position
      let maxY = -Infinity;
      let maxYNode: GraphNode | null = null;
      for (const node of persistedNodes) {
        const y = node.position?.y ?? 0;
        if (y > maxY) {
          maxY = y;
          maxYNode = node;
        }
      }
      if (maxYNode) {
        streamX = maxYNode.position?.x ?? 0;
        streamY = maxY + 260; // nodeHeight + gap
      }
    }

    // Create provisional streaming node
    const streamingGraphNode: GraphNode = {
      id: `streaming-${latestStreaming.id}`,
      type: "streaming",
      position: { x: streamX, y: streamY },
      data: {
        id: latestStreaming.id,
        reasoning: latestStreaming.reasoning,
        structuredReasoning: {},
        confidence: Math.min(tokenCount / 5000, 0.9), // Confidence fills as tokens accumulate
        tokenUsage: {
          inputTokens: 0,
          outputTokens: tokenCount,
          thinkingTokens: tokenCount,
        },
        inputQuery: null,
        createdAt: latestStreaming.timestamp,
        isSelected: false,
        nodeType: "streaming",
        phase,
        tokenCount,
      } as GraphNode["data"],
    };

    return [...persistedNodes, streamingGraphNode];
  }, [persistedNodes, isStreaming, streamingNodes, phase, tokenCount]);

  const mergedEdges = useMemo(() => {
    if (!isStreaming || streamingNodes.length === 0 || persistedNodes.length === 0) {
      return persistedEdges;
    }

    const latestStreaming = streamingNodes[streamingNodes.length - 1];

    // Find the last persisted node to connect the streaming node to
    let lastPersistedId: string | null = null;
    let maxY = -Infinity;
    for (const node of persistedNodes) {
      const y = node.position?.y ?? 0;
      if (y > maxY) {
        maxY = y;
        lastPersistedId = node.id;
      }
    }

    if (!lastPersistedId) return persistedEdges;

    // Create provisional edge
    const streamingEdge: GraphEdge = {
      id: `streaming-edge-${latestStreaming.id}`,
      source: lastPersistedId,
      target: `streaming-${latestStreaming.id}`,
      type: "influences",
      animated: true,
      data: {
        edgeType: "influences",
        weight: 0.8,
      },
      style: {
        stroke: "#3b82f6",
        strokeWidth: 2,
        strokeDasharray: "5 5",
      },
    };

    return [...persistedEdges, streamingEdge];
  }, [persistedEdges, persistedNodes, isStreaming, streamingNodes]);

  return {
    nodes: mergedNodes,
    edges: mergedEdges,
  };
}
