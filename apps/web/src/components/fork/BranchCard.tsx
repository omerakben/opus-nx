"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, Badge } from "@/components/ui";
import {
  FORK_ICONS,
  FORK_LABELS,
  FORK_COLORS,
  getForkStyleClasses,
  getConfidenceColor,
  type ForkStyle,
} from "@/lib/colors";
import { truncate } from "@/lib/utils";
import type { ForkBranch } from "@/lib/api";
import { AlertCircle } from "lucide-react";

interface BranchCardProps {
  branch: ForkBranch;
  isRecommended?: boolean;
  defaultExpanded?: boolean;
}

export function BranchCard({ branch, isRecommended, defaultExpanded }: BranchCardProps) {
  const style = branch.style as ForkStyle;
  const icon = FORK_ICONS[style];
  const label = FORK_LABELS[style];
  const classes = getForkStyleClasses(style);

  const confidencePercent = Math.round(branch.confidence * 100);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);

  // Error state: branch failed
  if (branch.error) {
    return (
      <Card
        className={cn(
          "overflow-hidden border-l-4 border-red-500 transition-all bg-red-500/5"
        )}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{icon}</span>
              <span className="text-sm font-medium text-red-400">
                {label}
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/50 text-red-400">
              Failed
            </Badge>
          </div>
          <div className="flex items-start gap-2 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {branch.error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confidenceColor = getConfidenceColor(branch.confidence);
  const circumference = Math.PI * 24; // 2 * PI * r(12) for 28px diameter (24px inner)
  const dashOffset = circumference * (1 - branch.confidence);

  const assumptions = branch.assumptions ?? [];
  const displayedAssumptions = isExpanded
    ? assumptions
    : assumptions.slice(0, 2);

  const needsToggle =
    branch.conclusion.length > 150 || branch.keyInsights.length > 3 ||
    branch.keyInsights.some((insight) => insight.length > 60) ||
    assumptions.length > 2 ||
    assumptions.some((a) => a.length > 60);

  const displayedInsights = isExpanded
    ? branch.keyInsights
    : branch.keyInsights.slice(0, 3);

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all relative",
        !isExpanded && "min-h-[180px]",
        isRecommended && "ring-2 ring-green-500/50"
      )}
      style={{
        borderLeft: "4px solid transparent",
        borderImage: `linear-gradient(to bottom, ${FORK_COLORS[style]}, ${FORK_COLORS[style]}33) 1`,
      }}
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
              <Badge variant="success" className="text-[10px] px-1 py-0 ml-1">
                Recommended
              </Badge>
            )}
          </div>
          {/* Circular confidence indicator */}
          <div className="relative shrink-0 w-7 h-7">
            <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
              <circle
                cx="14"
                cy="14"
                r="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-[var(--muted-foreground)]/20"
              />
              <circle
                cx="14"
                cy="14"
                r="12"
                fill="none"
                stroke={confidenceColor}
                strokeWidth="2"
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
        </div>

        {/* Conclusion */}
        <p className="text-sm text-[var(--foreground)] mb-2">
          {isExpanded ? branch.conclusion : truncate(branch.conclusion, 150)}
        </p>

        {/* Assumptions */}
        {assumptions.length > 0 && (
          <div className="mt-2 mb-2 rounded-md bg-amber-500/5 border border-amber-500/20 px-2.5 py-2">
            <div className="text-[10px] font-medium text-amber-400/90 mb-1 tracking-wide uppercase">
              Assumptions
            </div>
            <ul className="space-y-0.5">
              {displayedAssumptions.map((assumption, i) => (
                <li
                  key={i}
                  className="text-[12px] text-[var(--foreground)]/80 flex items-start gap-1"
                >
                  <span className="text-amber-400/70 mt-px">~</span>
                  <span>{isExpanded ? assumption : truncate(assumption, 60)}</span>
                </li>
              ))}
            </ul>
            {!isExpanded && assumptions.length > 2 && (
              <span className="text-[10px] text-amber-400/50 mt-0.5 block">
                +{assumptions.length - 2} more
              </span>
            )}
          </div>
        )}

        {/* Key Insights */}
        {branch.keyInsights.length > 0 && (
          <div className="mt-2">
            <div className="text-[11px] text-[var(--muted-foreground)] mb-1">
              Key Insights
            </div>
            <ul className="space-y-0.5">
              {displayedInsights.map((insight, i) => (
                <li
                  key={i}
                  className="text-[12px] text-[var(--foreground)] flex items-start gap-1"
                >
                  <span className="text-[var(--muted-foreground)]">&#8226;</span>
                  <span>{isExpanded ? insight : truncate(insight, 60)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expand/Collapse toggle */}
        {needsToggle && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-[10px] text-[var(--muted-foreground)] hover:text-violet-400 cursor-pointer mt-1"
          >
            {isExpanded ? "Show less" : "Read more"}
          </button>
        )}

        {/* Risks & Opportunities */}
        <div className="flex gap-2 mt-2">
          <div className="flex-1">
            <div className="text-[10px] text-red-400 mb-0.5">
              Risks ({branch.risks?.length ?? 0})
            </div>
            {branch.risks && branch.risks.length > 0 ? (
              <ul className="space-y-0.5">
                {(isExpanded ? branch.risks : branch.risks.slice(0, 1)).map((risk, i) => (
                  <li key={i} className="text-[11px] text-[var(--muted-foreground)] flex items-start gap-1">
                    <span className="text-red-400 mt-0.5">&#8226;</span>
                    <span>{isExpanded ? risk : truncate(risk, 60)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">None identified</p>
            )}
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-green-400 mb-0.5">
              Opportunities ({branch.opportunities?.length ?? 0})
            </div>
            {branch.opportunities && branch.opportunities.length > 0 ? (
              <ul className="space-y-0.5">
                {(isExpanded ? branch.opportunities : branch.opportunities.slice(0, 1)).map((opp, i) => (
                  <li key={i} className="text-[11px] text-[var(--muted-foreground)] flex items-start gap-1">
                    <span className="text-green-400 mt-0.5">&#8226;</span>
                    <span>{isExpanded ? opp : truncate(opp, 60)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">None identified</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
