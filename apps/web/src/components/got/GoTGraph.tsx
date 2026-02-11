"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { GoTThoughtNode } from "./GoTThoughtNode";
import { edgeTypes } from "@/components/graph/EdgeTypes";
import { GoTLegend } from "./GoTLegend";
import type { GoTFlowNode, GoTFlowEdge } from "@/lib/got-graph-utils";

const nodeTypes = {
  thought: GoTThoughtNode,
};

interface GoTGraphProps {
  nodes: GoTFlowNode[];
  edges: GoTFlowEdge[];
  onNodeClick?: (thoughtId: string) => void;
}

function GoTGraphInner({ nodes, edges, onNodeClick }: GoTGraphProps) {
  const handleNodeClick: NodeMouseHandler<GoTFlowNode> = useCallback(
    (_event, node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick],
  );

  const nodeColor = useCallback((node: GoTFlowNode) => {
    const score = node.data?.score ?? 0.5;
    if (score < 0.3) return "#ef4444";
    if (score < 0.5) return "#f97316";
    if (score < 0.7) return "#eab308";
    return "#22c55e";
  }, []);

  const defaultViewport = useMemo(() => ({ x: 0, y: 0, zoom: 0.8 }), []);

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--card)]">
        <p className="text-xs text-[var(--muted-foreground)]">
          Run a GoT query to see the reasoning graph
        </p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      defaultViewport={defaultViewport}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-[var(--background)]"
    >
      <Background
        variant={BackgroundVariant.Dots}
        color="rgba(245, 158, 11, 0.08)"
        gap={20}
        size={1.5}
      />
      <MiniMap
        nodeColor={nodeColor}
        maskColor="rgba(245, 158, 11, 0.06)"
        className="!bg-[var(--card)]/80 !backdrop-blur-sm !border !border-[var(--border)]/50 !rounded-xl !shadow-lg"
        position="bottom-right"
        pannable
        zoomable
      />
      <Controls
        className="!bg-[var(--card)] !border !border-[var(--border)] !rounded-lg !shadow-lg"
        position="bottom-left"
        showInteractive={false}
      />
      <GoTLegend />
    </ReactFlow>
  );
}

/**
 * Self-contained GoT graph with its own ReactFlowProvider.
 */
export function GoTGraph(props: GoTGraphProps) {
  return (
    <ReactFlowProvider>
      <GoTGraphInner {...props} />
    </ReactFlowProvider>
  );
}
