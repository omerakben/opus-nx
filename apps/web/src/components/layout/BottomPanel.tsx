"use client";

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
}: BottomPanelProps) {
  return (
    <div className="h-64 border-t border-[var(--border)]">
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
      />
    </div>
  );
}
