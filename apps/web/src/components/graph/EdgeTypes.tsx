"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { EDGE_COLORS, EDGE_LABELS, type EdgeType } from "@/lib/colors";
import { cn } from "@/lib/utils";

interface CustomEdgeProps extends EdgeProps {
  data?: {
    edgeType: EdgeType;
    weight: number;
  };
}

function createEdgeComponent(edgeType: EdgeType) {
  const EdgeComponent = memo(function EdgeComponent({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
  }: CustomEdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const color = EDGE_COLORS[edgeType];
    const weight = data?.weight ?? 1;
    const strokeWidth = Math.max(1, weight * 2);

    // Determine if edge should be animated
    const isAnimated = edgeType === "influences";

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke: color,
            strokeWidth,
            strokeDasharray: edgeType === "contradicts" ? "5,5" : undefined,
          }}
          className={cn(isAnimated && "animated")}
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <div
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--background)] border border-[var(--border)] opacity-0 hover:opacity-100 transition-opacity"
              style={{ color }}
            >
              {EDGE_LABELS[edgeType]}
            </div>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  });

  EdgeComponent.displayName = `${edgeType}Edge`;
  return EdgeComponent;
}

// Create all edge type components
export const InfluencesEdge = createEdgeComponent("influences");
export const ContradictsEdge = createEdgeComponent("contradicts");
export const SupportsEdge = createEdgeComponent("supports");
export const SupersedesEdge = createEdgeComponent("supersedes");
export const RefinesEdge = createEdgeComponent("refines");

// Export edge types map for React Flow
export const edgeTypes = {
  influences: InfluencesEdge,
  contradicts: ContradictsEdge,
  supports: SupportsEdge,
  supersedes: SupersedesEdge,
  refines: RefinesEdge,
};
