"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import { getSessionNodes } from "@/lib/api";
import { appEvents } from "@/lib/events";
import {
  transformNodesToGraph,
  transformEdgesToGraph,
  type GraphNode,
  type GraphEdge,
} from "@/lib/graph-utils";

interface UseGraphReturn {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
  isLoading: boolean;
  error: string | null;
  onNodesChange: (changes: unknown) => void;
  onEdgesChange: (changes: unknown) => void;
  selectNode: (nodeId: string | null) => void;
  refreshGraph: () => Promise<void>;
}

export function useGraph(sessionId: string | null): UseGraphReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track selectedNodeId in a ref so refreshGraph can read it without
  // re-creating its identity every time selection changes.
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  // AbortController ref to cancel in-flight fetches on session switch or unmount
  const abortRef = useRef<AbortController | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const refreshGraph = useCallback(async () => {
    if (!sessionId) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Cancel any in-flight request to prevent duplicate calls
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const response = await getSessionNodes(sessionId, { signal: controller.signal });

    // If this request was aborted (session changed), discard results
    if (controller.signal.aborted) return;

    if (response.error) {
      setError(response.error.message);
      setNodes([]);
      setEdges([]);
    } else if (response.data) {
      // Transform data with Date objects
      const dbNodes = response.data.nodes.map((n) => ({
        ...n,
        confidenceScore: n.confidenceScore,
        createdAt: new Date(n.createdAt),
      }));

      const dbEdges = response.data.edges.map((e) => ({
        ...e,
        metadata: {},
        createdAt: new Date(e.createdAt),
      }));

      const graphNodes = transformNodesToGraph(
        dbNodes as unknown as import("@opus-nx/db").ThinkingNode[],
        selectedNodeIdRef.current ?? undefined
      );
      const graphEdges = transformEdgesToGraph(
        dbEdges as unknown as import("@opus-nx/db").ReasoningEdge[]
      );

      setNodes(graphNodes);
      setEdges(graphEdges);
    }

    setIsLoading(false);
  }, [sessionId, setNodes, setEdges]);

  const selectNode = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeId(nodeId);

      // Update node selection state
      setNodes((prevNodes) =>
        prevNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isSelected: node.id === nodeId,
          },
        }))
      );
    },
    [setNodes]
  );

  // Reset selection and refetch when session changes
  useEffect(() => {
    setSelectedNodeId(null);
    refreshGraph();
    return () => {
      // Cancel in-flight fetch on cleanup (StrictMode remount / session switch)
      abortRef.current?.abort();
    };
  }, [sessionId, refreshGraph]);

  // Subscribe to data:stale events targeting graph scope
  useEffect(() => {
    const unsub = appEvents.on("data:stale", (payload) => {
      if (
        (payload.scope === "graph" || payload.scope === "all") &&
        (!payload.sessionId || payload.sessionId === sessionId)
      ) {
        refreshGraph();
      }
    });
    return unsub;
  }, [sessionId, refreshGraph]);

  return {
    nodes,
    edges,
    selectedNode,
    isLoading,
    error,
    onNodesChange: onNodesChange as (changes: unknown) => void,
    onEdgesChange: onEdgesChange as (changes: unknown) => void,
    selectNode,
    refreshGraph,
  };
}
