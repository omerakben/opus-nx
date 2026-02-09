"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThinkingStream, type SelectedNodeData } from "@/components/thinking";
import type { StreamWarning } from "@/lib/hooks/use-thinking-stream";

interface BottomPanelProps {
  thinking: string;
  tokenCount: number;
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
  onStart: (query: string, effort?: string) => void;
  onStop: () => void;
  onClear: () => void;
  phase?: "analyzing" | "reasoning" | "deciding" | "concluding" | "compacting" | null;
  compactionCount?: number;
  compactionSummary?: string | null;
  elapsedMs?: number;
  isMobile?: boolean;
  /** Selected graph node data for historical reasoning display */
  selectedNodeData?: SelectedNodeData | null;
  /** Callback to dismiss the selected node view */
  onClearSelection?: () => void;
  /** Model's final response from the completed stream */
  response?: string | null;
  /** Node ID of the persisted thinking node */
  streamNodeId?: string | null;
  /** Whether the stream result was degraded */
  degraded?: boolean;
  /** Recoverable warnings emitted during the stream */
  warnings?: StreamWarning[];
}

export function BottomPanel({
  thinking,
  tokenCount,
  isStreaming,
  error,
  sessionId,
  onStart,
  onStop,
  onClear,
  phase,
  compactionCount,
  compactionSummary,
  elapsedMs,
  isMobile,
  selectedNodeData,
  onClearSelection,
  response,
  streamNodeId,
  degraded,
  warnings,
}: BottomPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isMobile) {
    return (
      <div className="h-full">
        <ThinkingStream
          thinking={thinking}
          tokenCount={tokenCount}
          isStreaming={isStreaming}
          error={error}
          sessionId={sessionId}
          onStart={onStart}
          onStop={onStop}
          onClear={onClear}
          phase={phase}
          compactionCount={compactionCount}
          compactionSummary={compactionSummary}
          elapsedMs={elapsedMs}
          selectedNodeData={selectedNodeData}
          onClearSelection={onClearSelection}
          response={response}
          streamNodeId={streamNodeId}
          degraded={degraded}
          warnings={warnings}
          isMobile
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-t border-[var(--border)] transition-[height] duration-300 ease-out",
        isExpanded ? "h-[50vh]" : "h-64"
      )}
      data-tour="thinking-input"
    >
      <ThinkingStream
        thinking={thinking}
        tokenCount={tokenCount}
        isStreaming={isStreaming}
        error={error}
        sessionId={sessionId}
        onStart={onStart}
        onStop={onStop}
        onClear={onClear}
        phase={phase}
        compactionCount={compactionCount}
        compactionSummary={compactionSummary}
        elapsedMs={elapsedMs}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        selectedNodeData={selectedNodeData}
        onClearSelection={onClearSelection}
        response={response}
        streamNodeId={streamNodeId}
        degraded={degraded}
        warnings={warnings}
      />
    </div>
  );
}
