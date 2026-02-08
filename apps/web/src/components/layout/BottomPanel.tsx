"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThinkingStream } from "@/components/thinking";

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
      />
    </div>
  );
}
