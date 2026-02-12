"use client";

import { memo, useEffect, useRef } from "react";

import type { SwarmEventUnion } from "@/lib/swarm-client";
import {
  Brain,
  CheckCircle2,
  GitBranch,
  Lightbulb,
  Network,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";

const AGENT_COLORS: Record<string, string> = {
  deep_thinker: "#3b82f6",
  contrarian: "#ef4444",
  verifier: "#22c55e",
  synthesizer: "#f97316",
  metacognition: "#8b5cf6",
  maestro: "#06b6d4",
};

interface EventDisplay {
  icon: React.ReactNode;
  description: string;
  agent?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function shortExperimentId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}...` : id;
}

function comparisonSummary(
  comparisonResult?: Record<string, unknown> | null
): string | null {
  const comparison = asRecord(comparisonResult);
  if (!comparison) return null;

  const directSummary = comparison.summary;
  if (typeof directSummary === "string" && directSummary.trim().length > 0) {
    return truncate(directSummary.trim(), 140);
  }

  const rerun = asRecord(comparison.rerun);
  if (!rerun) return null;

  const totalTokens = typeof rerun.total_tokens === "number" ? rerun.total_tokens : null;
  const totalDurationMs =
    typeof rerun.total_duration_ms === "number" ? rerun.total_duration_ms : null;
  const agents = Array.isArray(rerun.agents)
    ? rerun.agents.filter((agent): agent is string => typeof agent === "string")
    : [];

  const parts: string[] = [];
  if (agents.length > 0) {
    parts.push(`rerun agents: ${agents.map(formatName).join(", ")}`);
  }
  if (totalTokens !== null) {
    parts.push(`tokens: ${totalTokens.toLocaleString()}`);
  }
  if (totalDurationMs !== null) {
    parts.push(`duration: ${(totalDurationMs / 1000).toFixed(1)}s`);
  }
  if (parts.length === 0) return null;
  return `Comparison ${parts.join(", ")}`;
}

function getEventDisplay(event: SwarmEventUnion): EventDisplay | null {
  switch (event.event) {
    case "swarm_started":
      return {
        icon: <Network className="w-3.5 h-3.5 text-cyan-400" />,
        description: `Swarm started with ${event.agents.length} agents`,
      };
    case "agent_started":
      return {
        icon: <Brain className="w-3.5 h-3.5 text-blue-400" />,
        description: `${formatName(event.agent)} started thinking`,
        agent: event.agent,
      };
    case "agent_thinking":
      // Skip thinking events (too noisy)
      return null;
    case "graph_node_created":
      return {
        icon: <GitBranch className="w-3.5 h-3.5 text-green-400" />,
        description: `Node created: ${event.content_preview}`,
        agent: event.agent,
      };
    case "agent_challenges":
      return {
        icon: <Swords className="w-3.5 h-3.5 text-amber-400" />,
        description: `Challenge: ${event.argument_preview}`,
        agent: event.challenger,
      };
    case "verification_score":
      return {
        icon: <Shield className="w-3.5 h-3.5 text-cyan-400" />,
        description: `Verification: ${event.verdict} (${Math.round(event.score * 100)}%)`,
      };
    case "agent_completed":
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
        description: `${formatName(event.agent)} completed (${Math.round(event.confidence * 100)}%)`,
        agent: event.agent,
      };
    case "synthesis_ready":
      return {
        icon: <Sparkles className="w-3.5 h-3.5 text-violet-400" />,
        description: `Synthesis ready (${Math.round(event.confidence * 100)}% confidence)`,
      };
    case "metacognition_insight":
      return {
        icon: <Lightbulb className="w-3.5 h-3.5 text-amber-400" />,
        description: event.description,
      };
    case "swarm_rerun_started":
      return {
        icon: <RefreshCw className="w-3.5 h-3.5 text-blue-400" />,
        description: truncate(
          `Rerun started for ${event.agents.map(formatName).join(", ")}${
            event.experiment_id
              ? ` (experiment ${shortExperimentId(event.experiment_id)})`
              : ""
          }: ${event.correction_preview}`,
          160
        ),
      };
    case "hypothesis_experiment_updated":
      {
        const updates = [
          `Experiment ${shortExperimentId(event.experiment_id)} -> ${formatName(event.status)}`,
        ];
        if (event.retention_decision) {
          updates.push(`retention: ${formatName(event.retention_decision)}`);
        }
        const summary = comparisonSummary(event.comparison_result);
        if (summary) {
          updates.push(summary);
        }
        return {
          icon: <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />,
          description: updates.join(" | "),
        };
      }
    default:
      return null;
  }
}

function formatName(name: string | undefined): string {
  if (!name) return "Unknown";
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeTime(eventTimestamp: string, firstTimestamp: string): string {
  const diff = new Date(eventTimestamp).getTime() - new Date(firstTimestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 1) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export const SwarmTimeline = memo(function SwarmTimeline({
  events,
}: {
  events: SwarmEventUnion[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new events
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events.length]);

  const firstTimestamp = events[0]?.timestamp;

  // Filter out agent_thinking events (too noisy for timeline)
  const displayEvents = events
    .map((event) => {
      const display = getEventDisplay(event);
      if (!display) return null;
      return { event, display };
    })
    .filter(Boolean) as Array<{
    event: SwarmEventUnion;
    display: EventDisplay;
  }>;

  if (displayEvents.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="max-h-48 overflow-y-auto scrollbar-thin"
      role="log"
      aria-label="Swarm event timeline"
    >
      <div className="relative pl-5">
        {/* Vertical connector line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border)]" />

        <div className="space-y-2">
          {displayEvents.map(({ event, display }, idx) => {
            const agentColor =
              display.agent ? AGENT_COLORS[display.agent] ?? "var(--muted-foreground)" : undefined;

            return (
              <div
                key={idx}
                className="relative flex items-start gap-2"
                aria-label={display.description}
              >
                {/* Icon dot */}
                <div className="absolute -left-5 mt-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[var(--background)] border border-[var(--border)]">
                  {display.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--foreground)] leading-tight whitespace-pre-wrap break-words">
                      {display.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {display.agent && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          color: agentColor,
                          backgroundColor: `${agentColor}20`,
                        }}
                      >
                        {formatName(display.agent)}
                      </span>
                    )}
                    <span className="text-[9px] text-[var(--muted-foreground)]">
                      {formatRelativeTime(event.timestamp, firstTimestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
