"use client";

import { memo, useState, useCallback } from "react";
import { Card, CardContent, MarkdownContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/hooks/use-swarm";
import { getConfidenceColor } from "@/lib/colors";
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Zap,
  Eye,
  Sparkles,
  Compass,
  Shield,
} from "lucide-react";

const AGENT_COLORS: Record<string, string> = {
  deep_thinker: "#3b82f6",
  contrarian: "#ef4444",
  verifier: "#22c55e",
  synthesizer: "#f97316",
  metacognition: "#8b5cf6",
  maestro: "#06b6d4",
};

const AGENT_ICONS: Record<string, typeof Brain> = {
  deep_thinker: Brain,
  contrarian: Zap,
  verifier: Shield,
  synthesizer: Sparkles,
  metacognition: Eye,
  maestro: Compass,
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  deep_thinker: "In-depth analytical reasoning",
  contrarian: "Challenges assumptions and finds weaknesses",
  verifier: "Validates claims with step-by-step verification",
  synthesizer: "Merges perspectives into coherent synthesis",
  metacognition: "Analyzes reasoning patterns and biases",
  maestro: "Orchestrates task decomposition and agent selection",
};

function formatAgentName(name: string | undefined): string {
  if (!name) return "Unknown Agent";
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
  const [isExpanded, setIsExpanded] = useState(false);
  const borderColor = AGENT_COLORS[agent.name] ?? "#6b7280";
  const AgentIcon = AGENT_ICONS[agent.name] ?? Brain;
  const description = AGENT_DESCRIPTIONS[agent.name] ?? "";
  const isError = agent.status === "error";
  const isThinking = agent.status === "thinking";
  const isCompleted = agent.status === "completed";

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const confidencePercent = Math.round(agent.confidence * 100);
  const confidenceColor = getConfidenceColor(agent.confidence);
  const circumference = Math.PI * 24;
  const dashOffset = circumference * (1 - agent.confidence);

  // Decide if the card has enough content to warrant expansion
  const hasExpandableContent =
    (agent.conclusion && agent.conclusion.length > 120) ||
    (agent.thinkingPreview && agent.thinkingPreview.length > 120);

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)]"
        style={{ borderLeftWidth: 3, borderLeftColor: isError ? "#ef4444" : borderColor }}
      >
        <AgentIcon className="w-3.5 h-3.5 shrink-0" style={{ color: borderColor }} />
        <span className="text-xs font-medium truncate flex-1" style={{ color: borderColor }}>
          {formatAgentName(agent.name)}
        </span>
        {isThinking && <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />}
        {isCompleted && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
        {isError && <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200 cursor-pointer",
        isError && "bg-red-500/5",
        isThinking && "animate-pulse",
        !isExpanded && "hover:bg-[var(--muted)]/30"
      )}
      style={{
        borderLeft: "4px solid transparent",
        borderImage: isError
          ? "linear-gradient(to bottom, #ef4444, #ef444433) 1"
          : `linear-gradient(to bottom, ${borderColor}, ${borderColor}33) 1`,
      }}
      onClick={toggleExpand}
      role="article"
      aria-expanded={isExpanded}
      aria-label={`${formatAgentName(agent.name)} — ${agent.status}`}
    >
      <CardContent className="p-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                "w-3 h-3 text-[var(--muted-foreground)] transition-transform duration-200 shrink-0",
                isExpanded && "rotate-90"
              )}
            />
            <AgentIcon
              className="w-4 h-4 shrink-0"
              style={{ color: isError ? "#ef4444" : borderColor }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: isError ? "#ef4444" : borderColor }}
            >
              {formatAgentName(agent.name)}
            </span>
            {/* Status badge */}
            {isThinking && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Thinking
              </span>
            )}
            {isError && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                Error
              </span>
            )}
          </div>

          {/* Circular confidence indicator (like BranchCard) */}
          {isCompleted && agent.confidence > 0 && (
            <div className="relative shrink-0 w-7 h-7">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                <circle
                  cx="14" cy="14" r="12"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  className="text-[var(--muted-foreground)]/20"
                />
                <circle
                  cx="14" cy="14" r="12"
                  fill="none" stroke={confidenceColor} strokeWidth="2"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold"
                style={{ color: confidenceColor }}
              >
                {confidencePercent}
              </span>
            </div>
          )}
        </div>

        {/* Description (subtle) */}
        {description && (
          <p className="text-[11px] text-[var(--muted-foreground)] mb-2 ml-[22px]">
            {description}
          </p>
        )}

        {/* Error reason */}
        {isError && agent.conclusion && (
          <div className="flex items-start gap-2 text-red-400 mb-2 ml-[22px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{agent.conclusion}</p>
          </div>
        )}

        {/* Thinking preview (live streaming) */}
        {isThinking && agent.thinkingPreview && (
          <div className="ml-[22px] mb-2">
            <div className="rounded-md bg-blue-500/5 border border-blue-500/20 px-2.5 py-2">
              <div className="text-[10px] font-medium text-blue-400/90 mb-1 tracking-wide uppercase">
                Live Reasoning
              </div>
              <MarkdownContent
                content={agent.thinkingPreview}
                size="sm"
                className="[&_p]:my-0"
              />
            </div>
          </div>
        )}

        {/* Completed: conclusion */}
        {isCompleted && agent.conclusion && (
          <div className="ml-[22px]">
            <MarkdownContent
              content={agent.conclusion}
              size="base"
              className="[&_p]:my-0"
            />
          </div>
        )}

        {/* Expanded detail */}
        <div
          className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out"
          style={{
            maxHeight: isExpanded ? "400px" : "0px",
            opacity: isExpanded ? 1 : 0,
          }}
        >
          {/* Thinking preview in completed state */}
          {isCompleted && agent.thinkingPreview && (
            <div className="ml-[22px] mt-2 rounded-md bg-[var(--muted)]/50 border border-[var(--border)] px-2.5 py-2">
              <div className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1 tracking-wide uppercase">
                Reasoning Process
              </div>
              <MarkdownContent
                content={agent.thinkingPreview}
                size="xs"
                className="max-h-32 overflow-y-auto scrollbar-thin pr-1 [&_p]:my-0"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {isCompleted && (
          <div className="flex items-center gap-3 mt-2 ml-[22px] text-[10px] text-[var(--muted-foreground)]">
            {agent.tokensUsed > 0 && (
              <span>{agent.tokensUsed.toLocaleString()} tokens</span>
            )}
            {agent.effort && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--muted)] font-medium">
                {agent.effort}
              </span>
            )}
            {hasExpandableContent && (
              <span
                className="ml-auto text-cyan-400 hover:text-cyan-300 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand();
                }}
              >
                {isExpanded ? "Show less" : "Read more"}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
