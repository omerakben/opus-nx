"use client";

import { memo, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { edgeTypes } from "../graph/EdgeTypes";
import { calculateSwarmLayout } from "@/lib/swarm-graph-layout";
import type { SwarmGraphNode, SwarmGraphEdge } from "@/lib/hooks/use-swarm";
import { EDGE_COLORS, type EdgeType } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/ui";

// ---------------------------------------------------------------------------
// Agent color mapping (matches AgentCard.tsx AGENT_COLORS)
// ---------------------------------------------------------------------------

const AGENT_COLORS: Record<string, string> = {
  maestro: "#06b6d4",
  deep_thinker: "#3b82f6",
  contrarian: "#f59e0b",
  verifier: "#f97316",
  synthesizer: "#22c55e",
  metacognition: "#8b5cf6",
};

function getAgentColor(agent: string): string {
  return AGENT_COLORS[agent] ?? "#6b7280";
}

function formatAgentLabel(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// SwarmNode — custom node component
// ---------------------------------------------------------------------------

interface SwarmNodeData {
  agent: string;
  content: string;
  confidence?: number;
  color: string;
  [key: string]: unknown;
}

type SwarmFlowNode = Node<SwarmNodeData>;

const SwarmNode = memo(function SwarmNode({ data }: NodeProps<SwarmFlowNode>) {
  const { agent, content, confidence, color } = data as SwarmNodeData;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-[var(--border)] !border-2 !border-[var(--background)]"
      />

      <div
        className={cn(
          "min-w-[200px] max-w-[280px] rounded-lg border bg-[var(--card)] shadow-md",
          "transition-all duration-300 ease-out",
          "animate-in fade-in-0 zoom-in-95"
        )}
        style={{ borderColor: color, borderLeftWidth: 3 }}
      >
        {/* Header */}
        <div
          className="px-2.5 py-1.5 border-b border-[var(--border)] flex items-center gap-1.5"
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-[10px] font-semibold truncate"
            style={{ color }}
          >
            {formatAgentLabel(agent)}
          </span>
          {confidence !== undefined && confidence > 0 && (
            <span className="text-[9px] font-medium text-[var(--muted-foreground)] ml-auto">
              {Math.round(confidence * 100)}%
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-2.5 py-2">
          <div className="max-h-40 overflow-y-auto pr-1">
            <MarkdownContent
              content={content}
              size="xs"
              className="[&_p]:my-0"
            />
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-[var(--border)] !border-2 !border-[var(--background)]"
      />
    </>
  );
});

// ---------------------------------------------------------------------------
// Node type registry
// ---------------------------------------------------------------------------

const nodeTypes = {
  swarm: SwarmNode,
};

// ---------------------------------------------------------------------------
// SwarmGraph component
// ---------------------------------------------------------------------------

interface SwarmGraphProps {
  graphNodes: SwarmGraphNode[];
  graphEdges: SwarmGraphEdge[];
}

export function SwarmGraph({ graphNodes, graphEdges }: SwarmGraphProps) {
  // Convert SwarmGraphNodes to React Flow nodes with layout positions.
  // The layout is incremental — once a node gets a position, it keeps it.
  const flowNodes = useMemo(() => {
    const layoutNodes = graphNodes.map((n) => ({
      id: n.id,
      agent: n.agent,
    }));
    const positionMap = calculateSwarmLayout(layoutNodes);

    return graphNodes.map((n): SwarmFlowNode => {
      const pos = positionMap.get(n.id) ?? { x: 0, y: 0 };
      const color = getAgentColor(n.agent);
      return {
        id: n.id,
        type: "swarm",
        position: pos,
        data: {
          agent: n.agent,
          content: n.content,
          confidence: n.confidence,
          color,
        },
      };
    });
  }, [graphNodes]);

  // Convert SwarmGraphEdges to React Flow edges.
  const flowEdges = useMemo(() => {
    return graphEdges.map((e): Edge => {
      const edgeType = e.type as EdgeType;
      const color = EDGE_COLORS[edgeType] ?? EDGE_COLORS.influences;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: edgeType,
        animated: true,
        style: {
          stroke: color,
          strokeWidth: 2,
          strokeOpacity: 0.8,
        },
        data: {
          edgeType,
          weight: 1,
        },
      };
    });
  }, [graphEdges]);

  // MiniMap node coloring by agent
  const miniMapNodeColor = useMemo(() => {
    return (node: SwarmFlowNode) => {
      return (node.data as SwarmNodeData)?.color ?? "#6b7280";
    };
  }, []);

  if (graphNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          Waiting for graph nodes...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden border border-[var(--border)]">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-[var(--background)]"
        nodesDraggable
        nodesConnectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="var(--grid-dot)"
          gap={20}
          size={1.5}
        />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(6, 182, 212, 0.08)"
          className="!bg-[var(--card)]/80 !backdrop-blur-sm !border !border-[var(--border)]/50 !rounded-xl !shadow-lg"
          position="bottom-right"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
