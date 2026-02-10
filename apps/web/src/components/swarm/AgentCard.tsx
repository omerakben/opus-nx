"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/hooks/use-swarm";
import { getConfidenceColor } from "@/lib/colors";
import { Brain, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const AGENT_COLORS: Record<string, string> = {
  deep_thinker: "#3b82f6",
  contrarian: "#ef4444",
  verifier: "#22c55e",
  synthesizer: "#f97316",
  metacognition: "#8b5cf6",
  maestro: "#06b6d4",
};

function formatAgentName(name: string): string {
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

export const AgentCard = memo(function AgentCard({
  agent,
}: {
  agent: AgentStatus;
}) {
  const borderColor = AGENT_COLORS[agent.name] ?? "var(--border)";
  const config = STATUS_CONFIG[agent.status];

  return (
    <Card
      className="overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <CardContent className="p-2.5">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1">
          <StatusIcon status={agent.status} />
          <span
            className="text-[11px] font-medium truncate flex-1"
            style={{ color: borderColor }}
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

        {/* Thinking preview */}
        {agent.status === "thinking" && agent.thinkingPreview && (
          <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2 mt-1">
            {agent.thinkingPreview.length > 100
              ? agent.thinkingPreview.slice(0, 100) + "..."
              : agent.thinkingPreview}
          </p>
        )}

        {/* Completed state */}
        {agent.status === "completed" && (
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

        {/* Footer */}
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
      </CardContent>
    </Card>
  );
});
