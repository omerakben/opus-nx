"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ThinkingNode } from "./ThinkingNode";
import { edgeTypes } from "./EdgeTypes";
import { GraphControls } from "./GraphControls";
import { GraphLegend } from "./GraphLegend";
import { getConfidenceColor } from "@/lib/colors";
import type { GraphNode, GraphEdge } from "@/lib/graph-utils";
import { Skeleton } from "@/components/ui";

// Node types for React Flow
const nodeTypes = {
  thinking: ThinkingNode,
};

interface ThinkingGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onNodesChange?: OnNodesChange<GraphNode>;
  onEdgesChange?: OnEdgesChange<GraphEdge>;
  isLoading?: boolean;
}

export function ThinkingGraph({
  nodes,
  edges,
  onNodeClick,
  onNodesChange,
  onEdgesChange,
  isLoading,
}: ThinkingGraphProps) {
  // Handle node click
  const handleNodeClick: NodeMouseHandler<GraphNode> = useCallback(
    (_event, node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  // MiniMap node color
  const nodeColor = useCallback((node: GraphNode) => {
    const confidence = (node.data as { confidence?: number })?.confidence ?? 0.5;
    return getConfidenceColor(confidence);
  }, []);

  // Default viewport
  const defaultViewport = useMemo(
    () => ({ x: 0, y: 0, zoom: 0.8 }),
    []
  );

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--card)]">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="w-48 h-24 rounded-lg" />
          <div className="flex gap-4">
            <Skeleton className="w-32 h-16 rounded-lg" />
            <Skeleton className="w-32 h-16 rounded-lg" />
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Loading reasoning graph...
          </p>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--card)]">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🧠</div>
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
            No reasoning nodes yet
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
            Start a thinking session to see your reasoning graph visualized here.
            Each node represents a step in the extended thinking process.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      defaultViewport={defaultViewport}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-[var(--background)]"
    >
      <Background
        color="var(--border)"
        gap={24}
        size={1}
      />
      <MiniMap
        nodeColor={nodeColor}
        maskColor="rgba(0, 0, 0, 0.7)"
        className="!bg-[var(--card)] !border-[var(--border)]"
        position="bottom-right"
        pannable
        zoomable
      />
      <GraphControls />
      <GraphLegend />
    </ReactFlow>
  );
}
