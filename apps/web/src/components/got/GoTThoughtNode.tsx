"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { GoTFlowNode } from "@/lib/got-graph-utils";

const STATE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  verified: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Verified" },
  rejected: { bg: "bg-red-500/15", text: "text-red-400", label: "Rejected" },
  aggregated: { bg: "bg-pink-500/15", text: "text-pink-400", label: "Aggregated" },
  generated: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Generated" },
  evaluating: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Evaluating" },
  pending: { bg: "bg-gray-500/15", text: "text-gray-400", label: "Pending" },
};

function GoTThoughtNodeComponent({ data }: NodeProps<GoTFlowNode>) {
  const stateStyle = STATE_COLORS[data.state] ?? STATE_COLORS.generated;
  const score = data.score;
  const truncatedContent = data.content.length > 80
    ? data.content.slice(0, 80) + "..."
    : data.content;

  return (
    <div
      className={cn(
        "w-[200px] rounded-lg border bg-[var(--card)] transition-all cursor-pointer",
        data.isBestPath
          ? "border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
          : "border-[var(--border)]",
        data.isSelected && "ring-2 ring-amber-400/60",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500/50 !w-2 !h-2" />

      {/* Top bar: state badge + score */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)]">
        <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded", stateStyle.bg, stateStyle.text)}>
          {stateStyle.label}
        </span>
        {score !== null && (
          <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
            {(score * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-2 py-1.5">
        <p className="text-[10px] text-[var(--foreground)] leading-relaxed line-clamp-3">
          {truncatedContent}
        </p>
      </div>

      {/* Depth indicator */}
      <div className="px-2 pb-1.5 flex items-center gap-1">
        <span className="text-[9px] text-[var(--muted-foreground)]">
          d={data.depth}
        </span>
        {data.isBestPath && (
          <span className="text-[9px] text-amber-400 font-medium">
            best path
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-amber-500/50 !w-2 !h-2" />
    </div>
  );
}

export const GoTThoughtNode = memo(GoTThoughtNodeComponent);
GoTThoughtNode.displayName = "GoTThoughtNode";
