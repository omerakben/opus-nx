"use client";

import { useState } from "react";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";
import { Badge, Card, CardContent } from "@/components/ui";
import {
  INSIGHT_COLORS,
  INSIGHT_ICONS,
  INSIGHT_LABELS,
} from "@/lib/colors";
import type { Insight } from "@/lib/api";
import { Link, ChevronDown } from "lucide-react";

interface InsightCardProps {
  insight: Insight;
  onEvidenceClick?: (nodeId: string) => void;
}

export function InsightCard({ insight, onEvidenceClick }: InsightCardProps) {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const Icon = INSIGHT_ICONS[insight.insightType];
  const label = INSIGHT_LABELS[insight.insightType];
  const color = INSIGHT_COLORS[insight.insightType];

  const confidencePercent = Math.round(insight.confidence * 100);
  const hasMoreEvidence = insight.evidence.length > 1;
  const visibleEvidence = isEvidenceExpanded
    ? insight.evidence
    : insight.evidence.slice(0, 1);
  const hiddenCount = insight.evidence.length - 1;

  return (
    <Card className="overflow-hidden insight-card card-hover-glow">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: color, color }}
          >
            <Icon className="w-3 h-3 mr-1" /> {label}
          </Badge>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {confidencePercent}%
          </span>
        </div>

        {/* Insight text */}
        <p className="text-sm text-[var(--foreground)] mb-2">
          {insight.insight}
        </p>

        {/* Evidence links */}
        {insight.evidence.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] mb-1.5">
              <Link className="w-3 h-3" />
              Evidence ({insight.evidence.length})
            </div>

            {/* Expandable evidence section */}
            <div
              className="space-y-1 overflow-hidden transition-[max-height] duration-300 ease-out"
              style={{
                maxHeight: isEvidenceExpanded
                  ? `${insight.evidence.length * 80}px`
                  : "72px",
              }}
            >
              {visibleEvidence.map((ev, i) => (
                <button
                  key={i}
                  onClick={() => onEvidenceClick?.(ev.nodeId)}
                  className="w-full text-left p-1.5 rounded bg-[var(--muted)] hover:bg-[var(--border)] transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] outline-none"
                >
                  <p className="text-[11px] text-[var(--foreground)] line-clamp-2">
                    {truncate(ev.excerpt, 80)}
                  </p>
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
        <div className="mt-2 text-[10px] text-[var(--muted-foreground)]">
          {formatRelativeTime(new Date(insight.createdAt))}
        </div>
      </CardContent>
    </Card>
  );
}
