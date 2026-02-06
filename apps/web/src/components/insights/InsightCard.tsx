"use client";

import { cn } from "@/lib/utils";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { Badge, Card, CardContent } from "@/components/ui";
import {
  INSIGHT_COLORS,
  INSIGHT_ICONS,
  INSIGHT_LABELS,
  type InsightType,
} from "@/lib/colors";
import type { Insight } from "@/lib/api";
import { Link } from "lucide-react";

interface InsightCardProps {
  insight: Insight;
  onEvidenceClick?: (nodeId: string) => void;
}

export function InsightCard({ insight, onEvidenceClick }: InsightCardProps) {
  const icon = INSIGHT_ICONS[insight.insightType];
  const label = INSIGHT_LABELS[insight.insightType];
  const color = INSIGHT_COLORS[insight.insightType];

  const confidencePercent = Math.round(insight.confidence * 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: color, color }}
          >
            {icon} {label}
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
            <div className="space-y-1">
              {insight.evidence.slice(0, 2).map((ev, i) => (
                <button
                  key={i}
                  onClick={() => onEvidenceClick?.(ev.nodeId)}
                  className="w-full text-left p-1.5 rounded bg-[var(--muted)] hover:bg-[var(--border)] transition-colors"
                >
                  <p className="text-[11px] text-[var(--foreground)] line-clamp-2">
                    {truncate(ev.excerpt, 80)}
                  </p>
                  <p className="text-[9px] text-[var(--muted-foreground)] mt-0.5">
                    Relevance: {Math.round(ev.relevance * 100)}%
                  </p>
                </button>
              ))}
              {insight.evidence.length > 2 && (
                <p className="text-[10px] text-[var(--muted-foreground)] text-center">
                  +{insight.evidence.length - 2} more
                </p>
              )}
            </div>
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
