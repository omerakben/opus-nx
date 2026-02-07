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
  isMobile?: boolean;
}

export function ThinkingGraph({
  nodes,
  edges,
  onNodeClick,
  onNodesChange,
  onEdgesChange,
  isLoading,
  isMobile,
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
    () => ({ x: 0, y: 0, zoom: isMobile ? 0.6 : 0.8 }),
    [isMobile]
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
      <div className="w-full h-full flex items-center justify-center bg-[var(--card)] relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-[var(--border)] opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-dashed border-violet-500/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-blue-500/20" />
        <div className="text-center p-8 relative z-10">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/10 to-violet-500/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--muted-foreground)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" strokeDasharray="4 4" />
                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
                <path d="M12 9v-3M12 18v-3M9 12H6M18 12h-3" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
            Reasoning Graph
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm mb-4">
            {isMobile
              ? "Start a thinking session to see the reasoning graph."
              : "Start a thinking session to visualize the reasoning graph. Each node is a step in Claude\u2019s extended thinking."}
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/50" /> Supports
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/50" /> Contradicts
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/50" /> Influences
            </span>
          </div>
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
      fitViewOptions={{ padding: isMobile ? 0.3 : 0.2 }}
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
      {!isMobile && (
        <MiniMap
          nodeColor={nodeColor}
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bg-[var(--card)] !border-[var(--border)]"
          position="bottom-right"
          pannable
          zoomable
        />
      )}
      <GraphControls />
      {!isMobile && <GraphLegend />}
    </ReactFlow>
  );
}
