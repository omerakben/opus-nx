"use client";

import { useRef, useEffect, useState } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { TokenCounter } from "./TokenCounter";
import { ThinkingInput } from "./ThinkingInput";
import { ReasoningDetail, ModelOutput } from "./ReasoningDetail";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import {
  AlertTriangle,
  Brain,
  Square,
  ChevronUp,
  ChevronDown,
  Database,
  Gauge,
  Clock,
  Sparkles,
  Search,
  Scale,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui";
import type { StreamWarning } from "@/lib/hooks/use-thinking-stream";

/** Data from a selected graph node for historical reasoning display */
export interface SelectedNodeData {
  id: string;
  reasoning: string;
  /** Model's final output/response */
  response: string | null;
  confidence: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    thinkingTokensEstimated?: boolean;
  };
  inputQuery: string | null;
  createdAt: Date;
  nodeType?: string;
}

type ThinkingPhase = "analyzing" | "reasoning" | "deciding" | "concluding" | "compacting" | null;

const PHASE_CONFIG: Record<string, { icon: typeof Brain; label: string; color: string; bgColor: string }> = {
  analyzing: { icon: Search, label: "Analyzing", color: "text-blue-400", bgColor: "bg-blue-400" },
  reasoning: { icon: Brain, label: "Reasoning", color: "text-amber-500", bgColor: "bg-amber-500" },
  deciding: { icon: Scale, label: "Deciding", color: "text-amber-400", bgColor: "bg-amber-400" },
  concluding: { icon: CheckCircle, label: "Concluding", color: "text-green-400", bgColor: "bg-green-400" },
  compacting: { icon: Database, label: "Compacting", color: "text-amber-400", bgColor: "bg-amber-400" },
};

const EFFORT_LEVELS = ["low", "medium", "high", "max"] as const;

interface ThinkingStreamProps {
  thinking: string;
  tokenCount: number;
  isStreaming: boolean;
  error: string | null;
  onStart: (query: string, effort?: string) => void;
  onStop: () => void;
  onClear: () => void;
  sessionId: string | null;
  phase?: ThinkingPhase;
  compactionCount?: number;
  compactionSummary?: string | null;
  elapsedMs?: number;
  isMobile?: boolean;
  /** Controlled expand/collapse from parent */
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  /** Historical node reasoning to display when a graph node is clicked */
  selectedNodeData?: SelectedNodeData | null;
  /** Callback to dismiss the selected node view */
  onClearSelection?: () => void;
  /** Model's final response from the completed stream */
  response?: string | null;
  /** Node ID of the persisted thinking node from the completed stream */
  streamNodeId?: string | null;
  /** Whether the stream result was degraded (persistence issues) */
  degraded?: boolean;
  /** Recoverable warnings emitted during the stream */
  warnings?: StreamWarning[];
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function ThinkingStream({
  thinking,
  tokenCount,
  isStreaming,
  error,
  onStart,
  onStop,
  onClear,
  sessionId,
  phase,
  compactionCount = 0,
  compactionSummary,
  elapsedMs = 0,
  isMobile,
  isExpanded = false,
  onToggleExpand,
  selectedNodeData,
  onClearSelection,
  response,
  streamNodeId,
  degraded = false,
  warnings = [],
}: ThinkingStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [effort, setEffort] = useState<string>("max");

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thinking, isStreaming]);

  const handleSubmit = (query: string) => {
    if (sessionId) {
      onStart(query, effort);
    }
  };

  // Determine display mode: streaming takes priority, then selected node, then last stream
  const isViewingNode = !isStreaming && !!selectedNodeData;

  const phaseConfig = phase ? PHASE_CONFIG[phase] : null;
  const PhaseIcon = phaseConfig?.icon ?? Brain;

  return (
    <Card className={cn("h-full flex flex-col", isMobile && "rounded-none border-0")}>
      <CardHeader className={cn(
        "flex-row items-center justify-between py-2 px-4 border-b border-[var(--border)]",
        isMobile && "px-3",
        isViewingNode && "border-b-violet-500/30"
      )}>
        <div className="flex items-center gap-2">
          {isViewingNode ? (
            <div className="flex items-center gap-1.5 text-violet-400">
              <Database className="w-4 h-4" />
              <CardTitle className="text-sm font-medium text-violet-400">
                Saved Reasoning
              </CardTitle>
              <span className="text-[10px] text-[var(--muted-foreground)] ml-1">
                {selectedNodeData.inputQuery
                  ? `"${selectedNodeData.inputQuery.length > 40 ? selectedNodeData.inputQuery.slice(0, 40) + "..." : selectedNodeData.inputQuery}"`
                  : "Node " + selectedNodeData.id.slice(0, 8)}
              </span>
            </div>
          ) : isStreaming && phaseConfig ? (
            <div className={cn("flex items-center gap-1.5", phaseConfig.color)}>
              <PhaseIcon className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-medium">{phaseConfig.label}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Brain className={cn("w-4 h-4", isStreaming ? "text-green-500 animate-pulse" : "text-[var(--muted-foreground)]")} />
              <CardTitle className="text-sm font-medium">Extended Thinking</CardTitle>
            </div>
          )}
          {isStreaming && (
            <div className={cn(
              "flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]",
              isMobile && "hidden"
            )}>
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {formatElapsed(elapsedMs)}
              </span>
              {compactionCount > 0 && (
                <span className="flex items-center gap-0.5 text-amber-400">
                  <Database className="w-3 h-3" />
                  {compactionCount}x compacted
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isViewingNode ? (
            <>
              <TokenCounter count={selectedNodeData.tokenUsage.thinkingTokens} isStreaming={false} />
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                selectedNodeData.confidence >= 0.8 ? "bg-green-500/10 text-green-400"
                  : selectedNodeData.confidence >= 0.5 ? "bg-amber-500/10 text-amber-400"
                  : "bg-red-500/10 text-red-400"
              )}>
                {Math.round(selectedNodeData.confidence * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-6 px-2 text-[10px] text-violet-400 hover:text-violet-300"
              >
                Dismiss
              </Button>
            </>
          ) : (
            <>
              <TokenCounter count={tokenCount} isStreaming={isStreaming} />
              {/* Effort selector — pill-based control */}
              {!isStreaming && (
                <div className={cn(
                  "flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-1",
                  isMobile && "gap-0.5 p-0.5"
                )}>
                  {EFFORT_LEVELS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEffort(e)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer",
                        isMobile && "px-3 py-1.5 text-xs",
                        effort === e && e === "max"
                          ? "bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] shadow-sm border border-[var(--brand-warm)]/30 font-semibold"
                          : effort === e
                            ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm border border-[var(--border)]"
                            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 border border-transparent"
                      )}
                      title={`${e} effort thinking${e === "max" ? " (Opus 4.6 exclusive)" : ""}`}
                    >
                      {e === "max" ? (
                        <span className="flex items-center gap-1">
                          <Sparkles className={cn("w-2.5 h-2.5", effort === e && "text-[var(--brand-warm)]")} />
                          max
                        </span>
                      ) : e}
                    </button>
                  ))}
                </div>
              )}
              {isStreaming && (
                <Button variant="outline" size="sm" onClick={onStop} className={cn("h-6 px-2 text-xs", isMobile && "h-8 px-3")}>
                  <Square className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              )}
              {thinking && !isStreaming && (
                <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-[10px] text-[var(--muted-foreground)]">
                  Clear
                </Button>
              )}
            </>
          )}
          {!isMobile && onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--muted)] transition-colors"
              aria-label={isExpanded ? "Collapse thinking panel" : "Expand thinking panel"}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Phase progress bar */}
        {isStreaming && phase && (
          <div className="px-4 py-1.5 border-b border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center gap-1.5">
              {(["analyzing", "reasoning", "deciding", "concluding"] as const).map((p) => {
                const cfg = PHASE_CONFIG[p];
                const PhIcon = cfg.icon;
                const phases = ["analyzing", "reasoning", "deciding", "concluding"] as const;
                const currentIdx = phases.indexOf(phase as typeof phases[number]);
                const thisIdx = phases.indexOf(p);
                const isActive = phase === p;
                const isPast = currentIdx > thisIdx;
                return (
                  <div key={p} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1 w-full">
                      <div className={cn(
                        "h-1 flex-1 rounded-full transition-all duration-500",
                        (isActive || isPast) ? "" : "bg-[var(--border)]",
                      )}>
                        {(isActive || isPast) && <div className={cn("h-full rounded-full", cfg.bgColor)} style={{ width: isActive ? "70%" : "100%" }} />}
                      </div>
                    </div>
                    <div className={cn(
                      "flex items-center gap-0.5 transition-colors",
                      isActive ? cfg.color : isPast ? "text-[var(--muted-foreground)]" : "text-[var(--muted-foreground)] opacity-30"
                    )}>
                      {isPast ? (
                        <CheckCircle className="w-2.5 h-2.5" />
                      ) : (
                        <PhIcon className={cn("w-2.5 h-2.5", isActive && "animate-pulse shadow-[0_0_8px_currentColor]")} />
                      )}
                      <span className={cn(
                        isActive ? "text-[9px] font-semibold" : "text-[8px] font-medium"
                      )}>{cfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compaction banner */}
        {compactionSummary && (
          <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <Database className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400 truncate">
              Memory consolidated: {compactionSummary}
            </span>
          </div>
        )}

        {/* Warning / degradation banner */}
        {!isStreaming && (degraded || warnings.length > 0) && (
          <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-400 space-y-0.5">
              {degraded && (
                <p>Result degraded — some data may not have persisted correctly.</p>
              )}
              {warnings.map((w, i) => (
                <p key={i}>{w.message}</p>
              ))}
            </div>
          </div>
        )}

        {/* Stream display OR historical node reasoning */}
        <div
          ref={containerRef}
          className={cn(
            "flex-1 overflow-y-auto bg-[var(--background)]",
            !isViewingNode && "p-4 font-mono text-sm leading-relaxed",
            isViewingNode ? "border-l-2 border-violet-500/30" : "border-l-2 border-amber-500/30",
            isMobile && !isViewingNode && "text-xs p-3"
          )}
        >
          {isViewingNode ? (
            <ReasoningDetail
              nodeId={selectedNodeData.id}
              fallbackReasoning={selectedNodeData.reasoning}
              fallbackResponse={selectedNodeData.response}
            />
          ) : error ? (
            <div className="text-red-400">Error: {error}</div>
          ) : thinking ? (
            <>
              <div className="text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
                {thinking}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-amber-400 animate-pulse ml-0.5 rounded-sm" />
                )}
              </div>

              {/* Model response after stream completes */}
              {!isStreaming && response && (
                <div className="mt-4 border-t border-violet-500/20 pt-4">
                  <ModelOutput content={response} />
                </div>
              )}
            </>
          ) : (
            <div className="text-[var(--muted-foreground)] italic flex flex-col items-center justify-center h-full gap-2">
              {sessionId ? (
                <>
                  <Brain className="w-8 h-8 opacity-20" />
                  <span className="text-xs">Enter a query to start extended thinking</span>
                  <span className="text-[10px] opacity-50">
                    Opus 4.6 with adaptive thinking + context compaction
                  </span>
                </>
              ) : (
                <span className="text-xs">Select or create a session to begin</span>
              )}
            </div>
          )}
        </div>

        {/* Stats bar: historical node view */}
        {isViewingNode && (
          <div className="px-4 py-1.5 border-t border-[var(--border)] flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] bg-[var(--card)]">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              {formatNumber(selectedNodeData.tokenUsage.thinkingTokens)} thinking tokens{selectedNodeData.tokenUsage.thinkingTokensEstimated ? " (est.)" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {selectedNodeData.createdAt instanceof Date
                ? selectedNodeData.createdAt.toLocaleString()
                : new Date(selectedNodeData.createdAt).toLocaleString()}
            </span>
            {selectedNodeData.nodeType && selectedNodeData.nodeType !== "thinking" && (
              <span className="flex items-center gap-1 text-violet-400">
                <Database className="w-3 h-3" />
                {selectedNodeData.nodeType}
              </span>
            )}
            <span className="ml-auto text-violet-400 flex items-center gap-1">
              <Database className="w-3 h-3" />
              Persisted
            </span>
          </div>
        )}

        {/* Stats bar when stream complete (only shown when NOT viewing a node) */}
        {!isViewingNode && thinking && !isStreaming && (
          <div className="px-4 py-1.5 border-t border-[var(--border)] flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] bg-[var(--card)]">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              {formatNumber(tokenCount)} tokens
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatElapsed(elapsedMs)}
            </span>
            {compactionCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <Database className="w-3 h-3" />
                {compactionCount} compaction{compactionCount > 1 ? "s" : ""}
              </span>
            )}
            {streamNodeId && (
              <span className="flex items-center gap-1 text-violet-400">
                <Database className="w-3 h-3" />
                Persisted
              </span>
            )}
            <span className="ml-auto text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Complete
            </span>
          </div>
        )}

        {/* Mobile streaming stats inline */}
        {isMobile && isStreaming && (
          <div className="px-3 py-1.5 border-t border-[var(--border)] flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] bg-[var(--card)]">
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {formatElapsed(elapsedMs)}
            </span>
            {compactionCount > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400">
                <Database className="w-3 h-3" />
                {compactionCount}x
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Gauge className="w-3 h-3" />
              {formatNumber(tokenCount)}
            </span>
          </div>
        )}

        {/* Input */}
        <div className={cn("p-3 border-t border-[var(--border)]", isMobile && "pb-4")}>
          <ThinkingInput
            onSubmit={handleSubmit}
            isLoading={isStreaming}
            placeholder={
              sessionId
                ? isMobile
                  ? "Ask a question for deep reasoning..."
                  : "Ask a complex question for deep reasoning..."
                : "Select a session first"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
