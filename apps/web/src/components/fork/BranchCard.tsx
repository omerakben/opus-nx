"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, Badge } from "@/components/ui";
import {
  FORK_ICONS,
  FORK_LABELS,
  getForkStyleClasses,
  type ForkStyle,
} from "@/lib/colors";
import { truncate } from "@/lib/utils";
import type { ForkBranch } from "@/lib/api";

interface BranchCardProps {
  branch: ForkBranch;
  isRecommended?: boolean;
}

export function BranchCard({ branch, isRecommended }: BranchCardProps) {
  const style = branch.style as ForkStyle;
  const icon = FORK_ICONS[style];
  const label = FORK_LABELS[style];
  const classes = getForkStyleClasses(style);

  const confidencePercent = Math.round(branch.confidence * 100);

  return (
    <Card
      className={cn(
        "overflow-hidden border-l-4 transition-all",
        classes.border,
        isRecommended && "ring-2 ring-green-500/50"
      )}
    >
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{icon}</span>
            <span className={cn("text-sm font-medium", classes.text)}>
              {label}
            </span>
            {isRecommended && (
              <Badge variant="success" className="text-[9px] px-1 py-0 ml-1">
                Recommended
              </Badge>
            )}
          </div>
          <span
            className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded",
              classes.bg,
              classes.text
            )}
          >
            {confidencePercent}%
          </span>
        </div>

        {/* Conclusion */}
        <p className="text-sm text-[var(--foreground)] mb-2">
          {truncate(branch.conclusion, 150)}
        </p>

        {/* Key Insights */}
        {branch.keyInsights.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] text-[var(--muted-foreground)] mb-1">
              Key Insights
            </div>
            <ul className="space-y-0.5">
              {branch.keyInsights.slice(0, 3).map((insight, i) => (
                <li
                  key={i}
                  className="text-[11px] text-[var(--foreground)] flex items-start gap-1"
                >
                  <span className="text-[var(--muted-foreground)]">•</span>
                  <span>{truncate(insight, 60)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks & Opportunities */}
        <div className="flex gap-2 mt-2">
          {branch.risks && branch.risks.length > 0 && (
            <div className="flex-1">
              <div className="text-[9px] text-red-400 mb-0.5">
                Risks ({branch.risks.length})
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {truncate(branch.risks[0], 40)}
              </p>
            </div>
          )}
          {branch.opportunities && branch.opportunities.length > 0 && (
            <div className="flex-1">
              <div className="text-[9px] text-green-400 mb-0.5">
                Opportunities ({branch.opportunities.length})
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {truncate(branch.opportunities[0], 40)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
