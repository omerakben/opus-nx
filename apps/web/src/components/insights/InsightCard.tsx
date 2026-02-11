"use client";

import { useState, useCallback } from "react";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";
import { Badge, Card, CardContent } from "@/components/ui";
import {
  INSIGHT_COLORS,
  INSIGHT_ICONS,
  INSIGHT_LABELS,
  getConfidenceColor,
} from "@/lib/colors";
import type { Insight } from "@/lib/api";
import { Link, ChevronDown, ChevronRight, Layers } from "lucide-react";

interface InsightCardProps {
  insight: Insight;
  onEvidenceClick?: (nodeId: string) => void;
}

export function InsightCard({ insight, onEvidenceClick }: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const [navigatingNodeId, setNavigatingNodeId] = useState<string | null>(null);
  const Icon = INSIGHT_ICONS[insight.insightType];
  const label = INSIGHT_LABELS[insight.insightType];
  const color = INSIGHT_COLORS[insight.insightType];

  const confidencePercent = Math.round(insight.confidence * 100);
  const hasMoreEvidence = insight.evidence.length > 1;
  const visibleEvidence = isEvidenceExpanded
    ? insight.evidence
    : insight.evidence.slice(0, 1);
  const hiddenCount = insight.evidence.length - 1;

  const nodesAnalyzedCount = insight.thinkingNodesAnalyzed?.length ?? 0;
  const metadataEntries = insight.metadata
    ? Object.entries(insight.metadata)
    : [];

  const highConfidence = insight.confidence >= 0.8;
  const lowConfidence = insight.confidence < 0.5;

  const createdDate = new Date(insight.createdAt);
  const absoluteDate = createdDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const handleCardClick = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleEvidenceClick = useCallback(
    (nodeId: string) => {
      setNavigatingNodeId(nodeId);
      onEvidenceClick?.(nodeId);
      setTimeout(() => setNavigatingNodeId(null), 1500);
    },
    [onEvidenceClick]
  );

  return (
    <Card
      role="article"
      aria-expanded={isExpanded}
      className={cn(
        "overflow-hidden insight-card card-hover-glow cursor-pointer transition-all duration-200",
        highConfidence && "border-l-2",
        lowConfidence && "opacity-85"
      )}
      style={highConfidence ? { borderLeftColor: color } : undefined}
      onClick={handleCardClick}
    >
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <ChevronRight
              className={cn(
                "w-3 h-3 text-[var(--muted-foreground)] transition-transform duration-200 shrink-0",
                isExpanded && "rotate-90"
              )}
            />
            <Badge
              variant="outline"
              className="text-[11px] px-1.5 py-0"
              style={{
                borderColor: color,
                color,
                backgroundColor: `${color}10`,
              }}
            >
              <Icon className="w-3 h-3 mr-1" /> {label}
            </Badge>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              aria-label={`Confidence: ${confidencePercent} percent`}
              style={{ backgroundColor: `${color}20`, color }}
            >
              {confidencePercent}%
            </span>
            <div className="w-16 h-1.5 rounded-full bg-[var(--muted)]/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${confidencePercent}%`,
                  backgroundColor: getConfidenceColor(insight.confidence),
                }}
              />
            </div>
          </div>
        </div>

        {/* Insight text */}
        <p
          className={cn(
            "text-sm text-[var(--foreground)] mb-2",
            !isExpanded && "line-clamp-3"
          )}
        >
          {insight.insight}
        </p>

        {/* Expanded detail view */}
        <div
          className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out"
          style={{
            maxHeight: isExpanded ? "500px" : "0px",
            opacity: isExpanded ? 1 : 0,
          }}
        >
          {/* Metadata entries */}
          {metadataEntries.length > 0 && (
            <div className="mb-2 p-2 rounded bg-[var(--muted)]/50 space-y-1">
              <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Metadata
              </p>
              {metadataEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between text-[11px] text-[var(--foreground)]"
                >
                  <span className="text-[var(--muted-foreground)]">{key}</span>
                  <span className="font-medium">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Absolute timestamp in expanded view */}
          <p className="text-[10px] text-[var(--muted-foreground)] mb-2">
            {absoluteDate}
          </p>
        </div>

        {/* Evidence links */}
        {insight.evidence.length > 0 && (
          <div
            className="mt-2 pt-2 border-t border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] mb-1.5">
              <Link className="w-3 h-3" />
              Evidence ({insight.evidence.length})
            </div>

            {/* Navigating toast feedback */}
            {navigatingNodeId && (
              <div className="mb-1.5 px-2 py-1 rounded bg-violet-500/10 text-violet-400 text-[10px] animate-pulse">
                Navigating to node...
              </div>
            )}

            {/* Expandable evidence section */}
            <div
              className="space-y-1 overflow-hidden transition-[max-height] duration-300 ease-out"
              style={{
                maxHeight: isEvidenceExpanded
                  ? `${Math.max(200, insight.evidence.length * 100)}px`
                  : "72px",
              }}
            >
              {visibleEvidence.map((ev, i) => (
                <button
                  key={i}
                  onClick={() => handleEvidenceClick(ev.nodeId)}
                  aria-label={`Navigate to evidence node: ${truncate(ev.excerpt, 40)}`}
                  className="w-full text-left p-1.5 rounded border-l-2 border-violet-500/50 bg-[var(--muted)] hover:bg-[var(--border)] transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] outline-none"
                >
                  <blockquote className="text-[11px] text-[var(--foreground)] italic line-clamp-2 bg-[var(--muted)]/50 pl-1">
                    {truncate(ev.excerpt, 80)}
                  </blockquote>
                  <p className="text-[9px] text-[var(--muted-foreground)] mt-0.5">
                    Relevance: {Math.round(ev.relevance * 100)}%
                  </p>
                </button>
              ))}
            </div>

            {/* Show more / Show less toggle */}
            {hasMoreEvidence && (
              <button
                onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] outline-none rounded px-1 py-0.5"
              >
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform duration-200",
                    isEvidenceExpanded && "rotate-180"
                  )}
                />
                {isEvidenceExpanded
                  ? "Show less"
                  : `Show ${hiddenCount} more`}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
          <span>{formatRelativeTime(createdDate)}</span>
          {nodesAnalyzedCount > 0 && (
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Based on {nodesAnalyzedCount} node{nodesAnalyzedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
