"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Brain, Loader2 } from "lucide-react";
import { MarkdownContent } from "@/components/ui";

interface StreamingNodeData {
  reasoning: string;
  phase: "analyzing" | "reasoning" | "deciding" | "concluding" | "compacting" | null;
  tokenCount: number;
  confidence: number;
  isSelected: boolean;
  [key: string]: unknown;
}

const PHASE_COLORS = {
  analyzing: { border: "border-blue-500/60", glow: "shadow-blue-500/20", text: "text-blue-400", label: "Analyzing" },
  reasoning: { border: "border-violet-500/60", glow: "shadow-violet-500/20", text: "text-violet-400", label: "Reasoning" },
  deciding: { border: "border-amber-500/60", glow: "shadow-amber-500/20", text: "text-amber-400", label: "Deciding" },
  concluding: { border: "border-emerald-500/60", glow: "shadow-emerald-500/20", text: "text-emerald-400", label: "Concluding" },
  compacting: { border: "border-cyan-500/60", glow: "shadow-cyan-500/20", text: "text-cyan-400", label: "Compacting" },
};

function StreamingNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as StreamingNodeData;
  const phaseConfig = nodeData.phase ? PHASE_COLORS[nodeData.phase] : PHASE_COLORS.analyzing;
  const reasoning = nodeData.reasoning || "Processing...";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />

      <div
        className={`relative w-56 rounded-xl border-2 ${phaseConfig.border} bg-[var(--card)] shadow-lg ${phaseConfig.glow} transition-all duration-500`}
        style={{
          animation: "streamingPulse 2s ease-in-out infinite",
        }}
      >
        {/* Ripple effect */}
        <div className="absolute -inset-2 rounded-xl opacity-30" style={{ animation: "ripple 2s ease-out infinite" }}>
          <div className={`w-full h-full rounded-xl border ${phaseConfig.border}`} />
        </div>
        <div className="absolute -inset-4 rounded-xl opacity-15" style={{ animation: "ripple 2s ease-out infinite 0.5s" }}>
          <div className={`w-full h-full rounded-xl border ${phaseConfig.border}`} />
        </div>

        {/* Header */}
        <div className="relative px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Brain className={`w-4 h-4 ${phaseConfig.text}`} />
              <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-current ${phaseConfig.text}`} style={{ animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }} />
            </div>
            <span className={`text-xs font-semibold ${phaseConfig.text}`}>
              {phaseConfig.label}
            </span>
          </div>
          <Loader2 className={`w-3 h-3 ${phaseConfig.text} animate-spin`} />
        </div>

        {/* Content preview */}
        <div className="relative px-3 py-2">
          <div className="text-[10px] text-[var(--muted-foreground)] leading-relaxed max-h-28 overflow-y-auto pr-1">
            <MarkdownContent content={reasoning} size="xs" className="[&_p]:my-0" />
            <span className="inline-block w-1.5 h-3 ml-0.5 bg-current opacity-70" style={{ animation: "blink 1s step-end infinite" }} />
          </div>
        </div>

        {/* Token counter */}
        <div className="px-3 py-1.5 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[9px] text-[var(--muted)]">
            {nodeData.tokenCount > 0 ? `~${nodeData.tokenCount.toLocaleString()} tokens` : "Starting..."}
          </span>
          <div className="flex items-center gap-1">
            <div className="w-12 h-1 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-1000`}
                style={{ width: `${Math.min(nodeData.confidence * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </>
  );
}

export const StreamingNode = memo(StreamingNodeComponent);
