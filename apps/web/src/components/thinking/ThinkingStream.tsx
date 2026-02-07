"use client";

import { useRef, useEffect, useState } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { TokenCounter } from "./TokenCounter";
import { ThinkingInput } from "./ThinkingInput";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import {
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

type ThinkingPhase = "analyzing" | "reasoning" | "deciding" | "concluding" | "compacting" | null;

const PHASE_CONFIG: Record<string, { icon: typeof Brain; label: string; color: string }> = {
  analyzing: { icon: Search, label: "Analyzing", color: "text-blue-400" },
  reasoning: { icon: Brain, label: "Reasoning", color: "text-violet-400" },
  deciding: { icon: Scale, label: "Deciding", color: "text-amber-400" },
  concluding: { icon: CheckCircle, label: "Concluding", color: "text-green-400" },
  compacting: { icon: Database, label: "Compacting", color: "text-amber-400" },
};

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
}: ThinkingStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [effort, setEffort] = useState<string>("high");
  const [isExpanded, setIsExpanded] = useState(false);

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

  const phaseConfig = phase ? PHASE_CONFIG[phase] : null;
  const PhaseIcon = phaseConfig?.icon ?? Brain;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-row items-center justify-between py-2 px-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          {isStreaming && phaseConfig ? (
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
            <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
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
          <TokenCounter count={tokenCount} isStreaming={isStreaming} />
          {/* Effort selector */}
          {!isStreaming && (
            <div className="flex items-center gap-0.5 border border-[var(--border)] rounded-md overflow-hidden">
              {(["low", "medium", "high", "max"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEffort(e)}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] transition-colors",
                    effort === e
                      ? "bg-[var(--accent)] text-white"
                      : "hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                  )}
                  title={`${e} effort thinking${e === "max" ? " (Opus 4.6 exclusive)" : ""}`}
                >
                  {e === "max" ? (
                    <span className="flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      max
                    </span>
                  ) : e}
                </button>
              ))}
            </div>
          )}
          {isStreaming && (
            <Button variant="outline" size="sm" onClick={onStop} className="h-6 px-2 text-xs">
              <Square className="w-3 h-3 mr-1" />
              Stop
            </Button>
          )}
          {thinking && !isStreaming && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-[10px]">
              Clear
            </Button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--muted)] transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </CardHeader>

      <CardContent className={cn("flex-1 flex flex-col p-0 overflow-hidden", isExpanded && "max-h-[50vh]")}>
        {/* Compaction banner */}
        {compactionSummary && (
          <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <Database className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400 truncate">
              Memory consolidated: {compactionSummary}
            </span>
          </div>
        )}

        {/* Stream display */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed bg-gray-900/50"
        >
          {error ? (
            <div className="text-red-400">Error: {error}</div>
          ) : thinking ? (
            <div className="text-green-400 whitespace-pre-wrap">
              {thinking}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
              )}
            </div>
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

        {/* Stats bar when complete */}
        {thinking && !isStreaming && (
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
            <span className="ml-auto text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Complete
            </span>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-[var(--border)]">
          <ThinkingInput
            onSubmit={handleSubmit}
            isLoading={isStreaming}
            placeholder={
              sessionId
                ? "Ask a complex question for deep reasoning..."
                : "Select a session first"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
