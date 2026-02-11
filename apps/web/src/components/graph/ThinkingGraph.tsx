"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ThinkingNode } from "./ThinkingNode";
import { StreamingNode } from "./StreamingNode";
import { edgeTypes } from "./EdgeTypes";
import { GraphControls } from "./GraphControls";
import { GraphLegend } from "./GraphLegend";
import { getConfidenceColor } from "@/lib/colors";
import type { GraphNode, GraphEdge } from "@/lib/graph-utils";
import { Skeleton } from "@/components/ui";

// Node types for React Flow
const nodeTypes = {
  thinking: ThinkingNode,
  streaming: StreamingNode,
};

function FitViewHelper({ selectedNodeId }: { selectedNodeId?: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (selectedNodeId) {
      const timeout = setTimeout(() => {
        fitView({ nodes: [{ id: selectedNodeId }], duration: 300, padding: 0.5 });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [selectedNodeId, fitView]);

  return null;
}

interface ThinkingGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onNodesChange?: OnNodesChange<GraphNode>;
  onEdgesChange?: OnEdgesChange<GraphEdge>;
  isLoading?: boolean;
  isMobile?: boolean;
  onSeedDemo?: () => void;
  onBranchCreated?: () => void;
  selectedNodeId?: string;
}

export function ThinkingGraph({
  nodes,
  edges,
  onNodeClick,
  onNodesChange,
  onEdgesChange,
  isLoading,
  isMobile,
  onSeedDemo,
  onBranchCreated,
  selectedNodeId,
}: ThinkingGraphProps) {
  // Edge filter and confidence filter state
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<Set<string>>(
    new Set(["influences", "contradicts", "supports", "supersedes", "refines", "challenges", "verifies", "merges", "observes"])
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);

  const handleEdgeFilterChange = useCallback((edgeType: string) => {
    setActiveEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(edgeType)) {
        next.delete(edgeType);
      } else {
        next.add(edgeType);
      }
      return next;
    });
  }, []);

  const handleConfidenceFilterChange = useCallback((value: number) => {
    setConfidenceThreshold(value);
  }, []);

  // Filter nodes by confidence
  const filteredNodes = useMemo(() => {
    const threshold = confidenceThreshold / 100;
    if (threshold <= 0) return nodes;
    return nodes.map((node) => {
      const confidence = (node.data as { confidence?: number })?.confidence ?? 1;
      return {
        ...node,
        hidden: confidence < threshold,
      };
    });
  }, [nodes, confidenceThreshold]);

  // Filter edges by type and hide edges to/from hidden nodes
  const filteredEdges = useMemo(() => {
    const hiddenNodeIds = new Set(
      filteredNodes.filter((n) => n.hidden).map((n) => n.id)
    );
    return edges.map((edge) => {
      const edgeType = (edge.data as { edgeType?: string })?.edgeType ?? edge.type ?? "influences";
      const typeHidden = !activeEdgeTypes.has(edgeType);
      const nodeHidden = hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target);
      return {
        ...edge,
        hidden: typeHidden || nodeHidden,
      };
    });
  }, [edges, activeEdgeTypes, filteredNodes]);

  // Inject onBranchCreated callback into each node's data
  const nodesWithCallbacks = useMemo(() => {
    if (!onBranchCreated) return filteredNodes;
    return filteredNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onBranchCreated,
      },
    }));
  }, [filteredNodes, onBranchCreated]);

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
          {onSeedDemo && (
            <button
              onClick={onSeedDemo}
              className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Load Demo Session
            </button>
          )}
          <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--muted-foreground)] mt-4">
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
      nodes={nodesWithCallbacks}
      edges={filteredEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      defaultViewport={defaultViewport}
      fitView
      fitViewOptions={{ padding: isMobile ? 0.3 : 0.4, maxZoom: 1.2 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-[var(--background)]"
    >
      <Background
        variant={BackgroundVariant.Dots}
        color="var(--grid-dot)"
        gap={20}
        size={1.5}
      />
      {!isMobile && (
        <MiniMap
          nodeColor={nodeColor}
          maskColor="rgba(139, 92, 246, 0.08)"
          className="!bg-[var(--card)]/80 !backdrop-blur-sm !border !border-[var(--border)]/50 !rounded-xl !shadow-lg"
          position="bottom-right"
          pannable
          zoomable
        />
      )}
      <GraphControls
        activeEdgeTypes={activeEdgeTypes}
        onEdgeFilterChange={handleEdgeFilterChange}
        confidenceThreshold={confidenceThreshold}
        onConfidenceFilterChange={handleConfidenceFilterChange}
      />
      {!isMobile && <GraphLegend />}
      {selectedNodeId && <FitViewHelper selectedNodeId={selectedNodeId} />}
    </ReactFlow>
  );
}
