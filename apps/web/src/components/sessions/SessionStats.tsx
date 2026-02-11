"use client";

import { Card, CardHeader, CardTitle, CardContent, Tooltip } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import type { GraphNode } from "@/lib/graph-utils";
import { groupNodesByConfidence, calculateTotalTokens } from "@/lib/graph-utils";
import { AlertTriangle, Brain, TrendingUp, Zap } from "lucide-react";

interface SessionStatsProps {
  nodes: GraphNode[];
  /** Show compact view (for collapsed sidebar) */
  isCompact?: boolean;
}

export function SessionStats({ nodes, isCompact = false }: SessionStatsProps) {
  const confidenceGroups = groupNodesByConfidence(nodes);
  const tokenTotals = calculateTotalTokens(nodes);

  // Detect swarm nodes with missing token data (nodes exist but all tokens are 0)
  const hasNodes = nodes.length > 0;
  const tokensPending = hasNodes && tokenTotals.total === 0;

  const stats = [
    {
      label: "Thinking Nodes",
      value: nodes.length,
      icon: Brain,
      color: "text-blue-500",
    },
    {
      label: "Total Tokens",
      value: tokensPending ? "--" : formatNumber(tokenTotals.total),
      icon: Zap,
      color: "text-yellow-500",
    },
    {
      label: "High Confidence",
      value: confidenceGroups.high,
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      label: "Low Confidence",
      value: confidenceGroups.low,
      icon: AlertTriangle,
      color: "text-red-500",
    },
  ];

  // Compact view for collapsed sidebar - show only primary metric with tooltip
  if (isCompact) {
    const primaryStat = stats[0]; // Thinking Nodes

    return (
      <Tooltip
        content={
          <div className="p-2 space-y-1.5">
            <div className="font-medium text-sm mb-2">Session Stats</div>
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between gap-4 text-xs">
                <span className="text-[var(--muted-foreground)]">{stat.label}</span>
                <span className="font-medium">{stat.value}</span>
              </div>
            ))}
          </div>
        }
      >
        <div className="flex flex-col items-center gap-1 cursor-help">
          <primaryStat.icon className={`w-5 h-5 ${primaryStat.color}`} />
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {primaryStat.value}
          </span>
        </div>
      </Tooltip>
    );
  }

  // Full view
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium">Session Stats</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-2 rounded-md bg-[var(--muted)]"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className={`w-3 h-3 ${stat.color}`} />
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {stat.label}
                </span>
              </div>
              <div className="text-lg font-semibold text-[var(--foreground)]">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Token breakdown */}
        {tokenTotals.total > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <div className="text-[10px] text-[var(--muted-foreground)] mb-2">
              Token Breakdown
            </div>
            <div className="space-y-1.5">
              <TokenBar
                label="Thinking"
                value={tokenTotals.thinking}
                total={tokenTotals.total}
                color="bg-green-500"
              />
              <TokenBar
                label="Input"
                value={tokenTotals.input}
                total={tokenTotals.total}
                color="bg-blue-500"
              />
              <TokenBar
                label="Output"
                value={tokenTotals.output}
                total={tokenTotals.total}
                color="bg-purple-500"
              />
            </div>
          </div>
        )}

        {/* Pending token data indicator for swarm-originated nodes */}
        {tokensPending && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted-foreground)] leading-relaxed">
              Token usage not yet available. Swarm agent metrics are populated after each phase completes.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TokenBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function TokenBar({ label, value, total, color }: TokenBarProps) {
  const percent = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--muted-foreground)] w-14">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[10px] text-[var(--foreground)] w-12 text-right font-mono">
        {formatNumber(value)}
      </span>
    </div>
  );
}
