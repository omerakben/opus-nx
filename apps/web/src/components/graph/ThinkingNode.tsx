"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  getConfidenceColor,
  getConfidenceBgClass,
  getConfidenceTextClass,
} from "@/lib/colors";
import { formatNumber, truncate, formatRelativeTime } from "@/lib/utils";
import type { GraphNode } from "@/lib/graph-utils";
import { Brain, MessageSquare, Zap, Database, GitFork, User } from "lucide-react";

interface ThinkingNodeData {
  id: string;
  reasoning: string;
  structuredReasoning: Record<string, unknown>;
  confidence: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
  };
  inputQuery: string | null;
  createdAt: Date;
  isSelected: boolean;
  decisionCount?: number;
  nodeType?: string;
}

/** Get icon and styles based on node type */
function getNodeTypeConfig(nodeType?: string) {
  switch (nodeType) {
    case "compaction":
      return {
        Icon: Database,
        label: "Memory Consolidation",
        borderClass: "border-amber-500",
        bgClass: "bg-amber-500/10",
        textClass: "text-amber-500",
        glowClass: "shadow-amber-500/20",
      };
    case "fork_branch":
      return {
        Icon: GitFork,
        label: "Fork Branch",
        borderClass: "border-violet-500",
        bgClass: "bg-violet-500/10",
        textClass: "text-violet-500",
        glowClass: "shadow-violet-500/20",
      };
    case "human_annotation":
      return {
        Icon: User,
        label: "Human Note",
        borderClass: "border-cyan-500",
        bgClass: "bg-cyan-500/10",
        textClass: "text-cyan-500",
        glowClass: "shadow-cyan-500/20",
      };
    default:
      return {
        Icon: Brain,
        label: "Thinking",
        borderClass: "",
        bgClass: "",
        textClass: "",
        glowClass: "",
      };
  }
}

export const ThinkingNode = memo(function ThinkingNode({
  data,
}: NodeProps<GraphNode>) {
  const nodeData = data as unknown as ThinkingNodeData;
  const {
    reasoning,
    confidence,
    tokenUsage,
    inputQuery,
    createdAt,
    isSelected,
    decisionCount,
    nodeType,
  } = nodeData;

  const isSpecialNode = nodeType && nodeType !== "thinking";
  const typeConfig = getNodeTypeConfig(nodeType);
  const confidenceColor = isSpecialNode ? undefined : getConfidenceColor(confidence);
  const confidencePercent = Math.round(confidence * 100);

  // Get display text
  const displayText = inputQuery || reasoning;
  const truncatedText = truncate(displayText, 120);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-[var(--border)] !border-2 !border-[var(--background)]"
      />

      <div
        className={cn(
          "min-w-[240px] max-w-[320px] rounded-lg border-2 bg-[var(--card)] shadow-lg transition-all",
          isSelected
            ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)]"
            : "hover:shadow-xl",
          isSpecialNode && typeConfig.borderClass,
          isSpecialNode && typeConfig.glowClass,
          nodeType === "compaction" && "border-dashed"
        )}
        style={!isSpecialNode ? { borderColor: confidenceColor } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "p-1.5 rounded-md",
                isSpecialNode ? typeConfig.bgClass : getConfidenceBgClass(confidence)
              )}
            >
              <typeConfig.Icon
                className={cn(
                  "w-4 h-4",
                  isSpecialNode ? typeConfig.textClass : getConfidenceTextClass(confidence)
                )}
              />
            </div>
            {isSpecialNode ? (
              <span className={cn("text-xs font-medium", typeConfig.textClass)}>
                {typeConfig.label}
              </span>
            ) : (
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatRelativeTime(createdAt)}
              </span>
            )}
          </div>
          {!isSpecialNode && (
            <div
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                getConfidenceBgClass(confidence),
                getConfidenceTextClass(confidence)
              )}
            >
              {confidencePercent}%
            </div>
          )}
          {nodeType === "compaction" && (
            <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
              Compacted
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <p className="text-sm text-[var(--foreground)] line-clamp-3">
            {truncatedText}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 pt-0 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" title="Thinking tokens">
              <Zap className="w-3 h-3" />
              <span>{formatNumber(tokenUsage.thinkingTokens)}</span>
            </div>
            {decisionCount !== undefined && decisionCount > 0 && (
              <div className="flex items-center gap-1" title="Decision points">
                <MessageSquare className="w-3 h-3" />
                <span>{decisionCount}</span>
              </div>
            )}
          </div>
          {!isSpecialNode && (
            <span className="text-[10px] opacity-50">
              {formatNumber(tokenUsage.inputTokens + tokenUsage.outputTokens)} total
            </span>
          )}
          {isSpecialNode && (
            <span className="text-[10px] opacity-50">
              {formatRelativeTime(createdAt)}
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[var(--border)] !border-2 !border-[var(--background)]"
      />
    </>
  );
});
