"use client";

import { memo, useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  getConfidenceColor,
  getConfidenceBgClass,
  getConfidenceTextClass,
} from "@/lib/colors";
import { formatNumber, truncate, formatRelativeTime } from "@/lib/utils";
import type { GraphNode } from "@/lib/graph-utils";
import {
  createCheckpoint,
  type CheckpointVerdict,
  type CheckpointResponse,
} from "@/lib/api";
import {
  Brain,
  MessageSquare,
  Zap,
  Database,
  GitFork,
  User,
  Check,
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  AlertCircle,
} from "lucide-react";

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
  /** Callback when a new branch is created via checkpoint correction */
  onBranchCreated?: (response: CheckpointResponse) => void;
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

/** Checkpoint action configuration */
const CHECKPOINT_ACTIONS = [
  {
    verdict: "verified" as CheckpointVerdict,
    icon: Check,
    color: "text-green-400 hover:bg-green-500/20",
    activeColor: "bg-green-500/20 text-green-400",
    title: "Verify this reasoning step",
  },
  {
    verdict: "questionable" as CheckpointVerdict,
    icon: HelpCircle,
    color: "text-amber-400 hover:bg-amber-500/20",
    activeColor: "bg-amber-500/20 text-amber-400",
    title: "Flag as questionable",
  },
  {
    verdict: "disagree" as CheckpointVerdict,
    icon: X,
    color: "text-red-400 hover:bg-red-500/20",
    activeColor: "bg-red-500/20 text-red-400",
    title: "Disagree and provide correction",
  },
] as const;

export const ThinkingNode = memo(function ThinkingNode({
  data,
}: NodeProps<GraphNode>) {
  const nodeData = data as unknown as ThinkingNodeData;
  const {
    id,
    reasoning,
    confidence,
    tokenUsage,
    inputQuery,
    createdAt,
    isSelected,
    decisionCount,
    nodeType,
    onBranchCreated,
  } = nodeData;

  const [isExpanded, setIsExpanded] = useState(false);
  const [checkpointState, setCheckpointState] = useState<{
    verdict: CheckpointVerdict | null;
    isLoading: boolean;
    error: string | null;
    saved: boolean;
  }>({
    verdict: null,
    isLoading: false,
    error: null,
    saved: false,
  });
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const [correctionText, setCorrectionText] = useState("");

  const isSpecialNode = nodeType && nodeType !== "thinking";
  const typeConfig = getNodeTypeConfig(nodeType);
  const confidenceColor = isSpecialNode ? undefined : getConfidenceColor(confidence);
  const confidencePercent = Math.round(confidence * 100);

  // Get display text
  const displayText = inputQuery || reasoning;
  const truncatedText = isExpanded ? displayText : truncate(displayText, 120);
  const canExpand = displayText.length > 120;

  /** Handle checkpoint action */
  const handleCheckpoint = useCallback(
    async (verdict: CheckpointVerdict, correction?: string) => {
      setCheckpointState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await createCheckpoint(id, {
        verdict,
        correction,
      });

      if (response.error) {
        setCheckpointState((prev) => ({
          ...prev,
          isLoading: false,
          error: response.error?.message ?? "Checkpoint failed",
        }));
        return;
      }

      setCheckpointState({
        verdict,
        isLoading: false,
        error: null,
        saved: true,
      });
      setShowCorrectionInput(false);
      setCorrectionText("");

      // Notify parent if a new branch was created
      if (response.data?.alternativeBranch && onBranchCreated) {
        onBranchCreated(response.data);
      }
    },
    [id, onBranchCreated]
  );

  /** Handle verdict button click */
  const handleVerdictClick = useCallback(
    (verdict: CheckpointVerdict) => {
      if (checkpointState.isLoading || checkpointState.saved) return;

      if (verdict === "disagree") {
        // Show correction input for disagree
        setShowCorrectionInput(true);
        setCheckpointState((prev) => ({ ...prev, verdict }));
      } else {
        // Directly submit for verified/questionable
        handleCheckpoint(verdict);
      }
    },
    [checkpointState.isLoading, checkpointState.saved, handleCheckpoint]
  );

  /** Submit correction */
  const handleSubmitCorrection = useCallback(() => {
    if (!correctionText.trim()) return;
    handleCheckpoint("disagree", correctionText.trim());
  }, [correctionText, handleCheckpoint]);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-[var(--border)] !border-2 !border-[var(--background)]"
      />

      <div
        className={cn(
          "min-w-[240px] max-w-[320px] rounded-lg border-2 bg-[var(--card)] shadow-lg transition-[box-shadow,transform] group card-hover-glow",
          isSelected
            ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)] shadow-[0_0_12px_rgba(139,92,246,0.15)]"
            : "",
          isSpecialNode && typeConfig.borderClass,
          isSpecialNode && typeConfig.glowClass,
          nodeType === "compaction" && "border-dashed",
          checkpointState.saved && checkpointState.verdict === "verified" && "ring-2 ring-green-500/50",
          checkpointState.saved && checkpointState.verdict === "questionable" && "ring-2 ring-amber-500/50",
          checkpointState.saved && checkpointState.verdict === "disagree" && "ring-2 ring-red-500/50"
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
          <p className={cn("text-sm text-[var(--foreground)]", !isExpanded && "line-clamp-3")}>
            {truncatedText}
          </p>
          {canExpand && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              className="flex items-center gap-0.5 mt-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          )}
        </div>

        {/* Checkpoint bar - shows on hover for thinking nodes */}
        {!isSpecialNode && !checkpointState.saved && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity border-t border-[var(--border)] px-3 py-1.5 flex items-center gap-1">
            <span className="text-[10px] text-[var(--muted-foreground)] mr-1">Checkpoint</span>
            {CHECKPOINT_ACTIONS.map(({ verdict, icon: ActionIcon, color, activeColor, title }) => (
              <button
                key={verdict}
                onClick={(e) => { e.stopPropagation(); handleVerdictClick(verdict); }}
                disabled={checkpointState.isLoading}
                className={cn(
                  "p-1 rounded transition-colors",
                  checkpointState.isLoading ? "opacity-50 cursor-not-allowed" : color,
                  checkpointState.verdict === verdict && activeColor
                )}
                title={title}
              >
                {checkpointState.isLoading && checkpointState.verdict === verdict ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ActionIcon className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Correction input for disagree */}
        {showCorrectionInput && !checkpointState.saved && (
          <div className="px-3 py-2 border-t border-[var(--border)] bg-red-500/5">
            <div className="text-[10px] text-red-400 mb-1.5 flex items-center gap-1">
              <X className="w-3 h-3" />
              Provide your correction
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                placeholder="What should the reasoning consider instead?"
                className="flex-1 text-[11px] px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-red-500/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && correctionText.trim()) {
                    handleSubmitCorrection();
                  } else if (e.key === "Escape") {
                    setShowCorrectionInput(false);
                    setCorrectionText("");
                    setCheckpointState((prev) => ({ ...prev, verdict: null }));
                  }
                }}
                autoFocus
                disabled={checkpointState.isLoading}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleSubmitCorrection(); }}
                disabled={!correctionText.trim() || checkpointState.isLoading}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  correctionText.trim() && !checkpointState.isLoading
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "opacity-50 cursor-not-allowed text-[var(--muted-foreground)]"
                )}
                title="Submit correction and trigger re-reasoning"
              >
                {checkpointState.isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            </div>
            {checkpointState.isLoading && (
              <div className="text-[10px] text-amber-400 mt-1.5 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Re-reasoning with your correction...
              </div>
            )}
          </div>
        )}

        {/* Saved checkpoint feedback */}
        {checkpointState.saved && (
          <div className={cn(
            "px-3 py-1.5 border-t border-[var(--border)] animate-fade-in-up",
            checkpointState.verdict === "verified" && "bg-green-500/5",
            checkpointState.verdict === "questionable" && "bg-amber-500/5",
            checkpointState.verdict === "disagree" && "bg-red-500/5"
          )}>
            <div className={cn(
              "text-[10px] flex items-center gap-1",
              checkpointState.verdict === "verified" && "text-green-400",
              checkpointState.verdict === "questionable" && "text-amber-400",
              checkpointState.verdict === "disagree" && "text-red-400"
            )}>
              <Check className="w-3 h-3" />
              {checkpointState.verdict === "verified" && "Verified by human operator"}
              {checkpointState.verdict === "questionable" && "Flagged as questionable"}
              {checkpointState.verdict === "disagree" && "Correction submitted — new branch created"}
            </div>
          </div>
        )}

        {/* Error feedback */}
        {checkpointState.error && (
          <div className="px-3 py-1.5 border-t border-[var(--border)] bg-red-500/5">
            <div className="text-[10px] text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {checkpointState.error}
            </div>
          </div>
        )}

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
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {formatNumber(tokenUsage.inputTokens + tokenUsage.outputTokens)} total
            </span>
          )}
          {isSpecialNode && (
            <span className="text-[10px] text-[var(--muted-foreground)]">
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
