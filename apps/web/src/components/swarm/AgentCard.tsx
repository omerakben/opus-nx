"use client";

import { memo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/hooks/use-swarm";
import { getConfidenceColor } from "@/lib/colors";
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const AGENT_COLORS: Record<string, string> = {
  deep_thinker: "#3b82f6",
  contrarian: "#ef4444",
  verifier: "#22c55e",
  synthesizer: "#f97316",
  metacognition: "#8b5cf6",
  maestro: "#06b6d4",
};

function formatAgentName(name: string | undefined): string {
  if (!name) return "Unknown Agent";
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_CONFIG = {
  pending: {
    label: "Waiting",
    className: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  },
  thinking: {
    label: "Thinking",
    className: "bg-blue-500/20 text-blue-400 animate-pulse",
  },
  completed: {
    label: "Done",
    className: "bg-green-500/20 text-green-400",
  },
  error: {
    label: "Error",
    className: "bg-red-500/20 text-red-400",
  },
} as const;

function StatusIcon({ status }: { status: AgentStatus["status"] }) {
  switch (status) {
    case "pending":
      return <Brain className="w-3 h-3 text-[var(--muted-foreground)]" />;
    case "thinking":
      return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="w-3 h-3 text-green-400" />;
    case "error":
      return <AlertCircle className="w-3 h-3 text-red-400" />;
  }
}

interface AgentCardProps {
  agent: AgentStatus;
  /** Compact mode for mobile — show only name + status badge */
  compact?: boolean;
}

export const AgentCard = memo(function AgentCard({
  agent,
  compact = false,
}: AgentCardProps) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const borderColor = AGENT_COLORS[agent.name] ?? "var(--border)";
  const config = STATUS_CONFIG[agent.status];
  const isError = agent.status === "error";

  const toggleThinking = useCallback(() => {
    setThinkingExpanded((prev) => !prev);
  }, []);

  return (
    <Card
      className={cn("overflow-hidden", isError && "bg-red-500/5")}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: isError ? "#ef4444" : borderColor,
      }}
      aria-label={`${formatAgentName(agent.name)} - ${config.label}`}
    >
      <CardContent className="p-2.5">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1">
          <StatusIcon status={agent.status} />
          <span
            className="text-[11px] font-medium truncate flex-1"
            style={{ color: isError ? "#ef4444" : borderColor }}
          >
            {formatAgentName(agent.name)}
          </span>
          <span
            className={cn(
              "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
              config.className
            )}
          >
            {config.label}
          </span>
        </div>

        {/* Error reason (U2) */}
        {isError && agent.conclusion && !compact && (
          <p className="text-[11px] text-red-400 mt-1">
            {agent.conclusion}
          </p>
        )}

        {/* Thinking preview (U1) — hidden in compact mode */}
        {!compact && agent.status === "thinking" && agent.thinkingPreview && (
          <div className="mt-1">
            {agent.thinkingPreview.length > 100 ? (
              <>
                {thinkingExpanded ? (
                  <div className="max-h-24 overflow-y-auto scrollbar-thin">
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      {agent.thinkingPreview}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {agent.thinkingPreview.slice(0, 100)}...
                  </p>
                )}
                <button
                  onClick={toggleThinking}
                  className="flex items-center gap-0.5 text-[10px] text-cyan-400 hover:text-cyan-300 mt-0.5 transition-colors"
                >
                  {thinkingExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Show more
                    </>
                  )}
                </button>
              </>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {agent.thinkingPreview}
              </p>
            )}
          </div>
        )}

        {/* Completed state — hidden in compact mode */}
        {!compact && agent.status === "completed" && (
          <>
            {/* Confidence bar */}
            <div className="mt-1.5 mb-1">
              <div className="h-1 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(agent.confidence * 100)}%`,
                    backgroundColor: getConfidenceColor(agent.confidence),
                  }}
                />
              </div>
            </div>
            {/* Conclusion */}
            <p className="text-[11px] text-[var(--foreground)] line-clamp-2">
              {agent.conclusion.length > 80
                ? agent.conclusion.slice(0, 80) + "..."
                : agent.conclusion}
            </p>
          </>
        )}

        {/* Footer — hidden in compact mode */}
        {!compact && (
          <div className="flex items-center gap-2 mt-1.5">
            {agent.tokensUsed > 0 && (
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {agent.tokensUsed.toLocaleString()} tokens
              </span>
            )}
            {agent.effort && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] ml-auto">
                {agent.effort}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
