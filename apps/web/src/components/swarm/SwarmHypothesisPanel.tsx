"use client";

import { useState } from "react";
import { Button, Card, CardContent } from "@/components/ui";
import type {
  SwarmHypothesisExperiment,
  SwarmHypothesisLifecycleInfo,
  SwarmHypothesisRetentionDecision,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Lightbulb, RefreshCw } from "lucide-react";

interface SwarmHypothesisPanelProps {
  experiments: SwarmHypothesisExperiment[];
  lifecycle?: SwarmHypothesisLifecycleInfo | null;
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onCompareExperiment?: (
    experimentId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onRetainDecision?: (
    experimentId: string,
    decision: SwarmHypothesisRetentionDecision
  ) => Promise<{ ok: boolean; error?: string }>;
}

interface ComparisonMetrics {
  summary: string | null;
  tokens: number | null;
  durationMs: number | null;
  agentCount: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status: string): string {
  switch (status) {
    case "promoted":
      return "bg-indigo-500/20 text-indigo-300";
    case "checkpointed":
      return "bg-cyan-500/20 text-cyan-300";
    case "rerunning":
      return "bg-amber-500/20 text-amber-300";
    case "comparing":
      return "bg-blue-500/20 text-blue-300";
    case "retained":
      return "bg-green-500/20 text-green-300";
    case "deferred":
      return "bg-amber-500/20 text-amber-300";
    case "archived":
      return "bg-slate-500/20 text-slate-300";
    default:
      return "bg-[var(--muted)] text-[var(--muted-foreground)]";
  }
}

function retentionBadge(decision: string): string {
  switch (decision) {
    case "retain":
      return "bg-green-500/20 text-green-300";
    case "defer":
      return "bg-amber-500/20 text-amber-300";
    case "archive":
      return "bg-slate-500/20 text-slate-300";
    default:
      return "bg-[var(--muted)] text-[var(--muted-foreground)]";
  }
}

function getComparisonMetrics(
  comparisonResult: Record<string, unknown> | null
): ComparisonMetrics {
  if (!comparisonResult) {
    return { summary: null, tokens: null, durationMs: null, agentCount: null };
  }

  const summary =
    typeof comparisonResult.summary === "string"
      ? comparisonResult.summary
      : typeof comparisonResult.result_summary === "string"
        ? comparisonResult.result_summary
        : null;

  const rerun = asRecord(comparisonResult.rerun);
  const tokens =
    rerun && typeof rerun.total_tokens === "number"
      ? rerun.total_tokens
      : typeof comparisonResult.total_tokens === "number"
        ? comparisonResult.total_tokens
        : null;

  const durationMs =
    rerun && typeof rerun.total_duration_ms === "number"
      ? rerun.total_duration_ms
      : typeof comparisonResult.total_duration_ms === "number"
        ? comparisonResult.total_duration_ms
        : null;

  const agentCount =
    rerun && Array.isArray(rerun.agents)
      ? rerun.agents.filter((agent) => typeof agent === "string").length
      : Array.isArray(comparisonResult.agents)
        ? comparisonResult.agents.filter((agent) => typeof agent === "string").length
        : null;

  return { summary, tokens, durationMs, agentCount };
}

export function SwarmHypothesisPanel({
  experiments,
  lifecycle = null,
  loading = false,
  onRefresh,
  onCompareExperiment,
  onRetainDecision,
}: SwarmHypothesisPanelProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [comparePendingId, setComparePendingId] = useState<string | null>(null);
  const [compareErrors, setCompareErrors] = useState<Record<string, string>>({});
  const [decisionPendingKey, setDecisionPendingKey] = useState<string | null>(null);
  const [decisionErrors, setDecisionErrors] = useState<Record<string, string>>({});

  const handleCompare = async (experimentId: string) => {
    if (!onCompareExperiment) return;
    if (comparePendingId !== null || decisionPendingKey !== null) return;

    setComparePendingId(experimentId);
    try {
      const result = await onCompareExperiment(experimentId);
      if (result.ok) {
        setCompareErrors((prev) => {
          const next = { ...prev };
          delete next[experimentId];
          return next;
        });
      } else {
        setCompareErrors((prev) => ({
          ...prev,
          [experimentId]: result.error ?? "Failed to compare experiment",
        }));
      }
    } finally {
      setComparePendingId(null);
    }
  };

  const handleRetentionDecision = async (
    experimentId: string,
    decision: "retain" | "defer" | "archive"
  ) => {
    if (!onRetainDecision) return;
    if (comparePendingId !== null || decisionPendingKey !== null) return;

    const pendingKey = `${experimentId}:${decision}`;
    setDecisionPendingKey(pendingKey);

    try {
      const result = await onRetainDecision(experimentId, decision);
      if (result.ok) {
        setDecisionErrors((prev) => {
          const next = { ...prev };
          delete next[experimentId];
          return next;
        });
      } else {
        setDecisionErrors((prev) => ({
          ...prev,
          [experimentId]: result.error ?? "Failed to save retention decision",
        }));
      }
    } finally {
      setDecisionPendingKey(null);
    }
  };

  if (!loading && experiments.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-xs font-medium text-[var(--foreground)]">
          Hypothesis Lifecycle
        </span>
        <span className="text-[10px] text-[var(--muted-foreground)]">
          ({experiments.length} experiments)
        </span>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] ml-auto gap-1"
            onClick={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
              } finally {
                setRefreshing(false);
              }
            }}
            disabled={loading || refreshing}
            aria-label="Refresh hypothesis experiments"
          >
            <RefreshCw className={cn("w-3 h-3", (loading || refreshing) && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {lifecycle?.degradedMode && (
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-3 space-y-1">
              <p className="text-[11px] font-medium text-amber-300">
                Lifecycle is running in degraded mode (in-memory fallback).
              </p>
              <p className="text-[10px] text-amber-200/90">
                {lifecycle.degradedReason
                  ? `Reason: ${lifecycle.degradedReason}`
                  : "Supabase lifecycle tables are unavailable."}
              </p>
            </CardContent>
          </Card>
        )}

        {loading && experiments.length === 0 && (
          <Card className="border-[var(--border)] bg-[var(--muted)]/30">
            <CardContent className="p-3 text-xs text-[var(--muted-foreground)]">
              Loading hypothesis experiments...
            </CardContent>
          </Card>
        )}

        {experiments.map((experiment) => {
          const metrics = getComparisonMetrics(experiment.comparisonResult);

          return (
            <Card
              key={experiment.id}
              className="border-[var(--border)] bg-[var(--muted)]/20"
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--foreground)] whitespace-pre-wrap break-words">
                      {experiment.alternativeSummary || "No hypothesis summary available."}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                      statusBadge(experiment.status)
                    )}
                  >
                    {formatLabel(experiment.status)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                    {experiment.id}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    Updated {new Date(experiment.lastUpdated).toLocaleString()}
                  </span>
                  {experiment.retentionDecision && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        retentionBadge(experiment.retentionDecision)
                      )}
                    >
                      Retention: {formatLabel(experiment.retentionDecision)}
                    </span>
                  )}
                </div>

                {(metrics.tokens !== null ||
                  metrics.durationMs !== null ||
                  metrics.agentCount !== null) && (
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.tokens !== null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                        {metrics.tokens.toLocaleString()} tokens
                      </span>
                    )}
                    {metrics.durationMs !== null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                        {(metrics.durationMs / 1000).toFixed(1)}s rerun
                      </span>
                    )}
                    {metrics.agentCount !== null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                        {metrics.agentCount} agents
                      </span>
                    )}
                  </div>
                )}

                {metrics.summary && (
                  <p className="text-[11px] text-[var(--muted-foreground)] whitespace-pre-wrap break-words">
                    {metrics.summary}
                  </p>
                )}

                {(onCompareExperiment || onRetainDecision) &&
                  experiment.status !== "archived" && (
                  <div className="pt-1">
                    {onCompareExperiment && (
                      <>
                        <div className="text-[10px] text-[var(--muted-foreground)] mb-1.5">
                          Comparison
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                            disabled={
                              loading ||
                              refreshing ||
                              comparePendingId !== null ||
                              decisionPendingKey !== null
                            }
                            onClick={() => handleCompare(experiment.id)}
                          >
                            {comparePendingId === experiment.id ? "Starting..." : "Compare Now"}
                          </Button>
                        </div>
                        {compareErrors[experiment.id] && (
                          <p className="text-[10px] text-red-300 mt-1">
                            {compareErrors[experiment.id]}
                          </p>
                        )}
                      </>
                    )}

                    {onRetainDecision && (
                      <>
                        <div className="text-[10px] text-[var(--muted-foreground)] mt-2 mb-1.5">
                          Retention decision
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] border-green-500/30 text-green-300 hover:bg-green-500/10"
                            disabled={
                              loading ||
                              refreshing ||
                              comparePendingId !== null ||
                              decisionPendingKey !== null
                            }
                            onClick={() => handleRetentionDecision(experiment.id, "retain")}
                          >
                            {decisionPendingKey === `${experiment.id}:retain` ? "Saving..." : "Retain"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                            disabled={
                              loading ||
                              refreshing ||
                              comparePendingId !== null ||
                              decisionPendingKey !== null
                            }
                            onClick={() => handleRetentionDecision(experiment.id, "defer")}
                          >
                            {decisionPendingKey === `${experiment.id}:defer` ? "Saving..." : "Defer"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] border-slate-500/30 text-slate-300 hover:bg-slate-500/10"
                            disabled={
                              loading ||
                              refreshing ||
                              comparePendingId !== null ||
                              decisionPendingKey !== null
                            }
                            onClick={() => handleRetentionDecision(experiment.id, "archive")}
                          >
                            {decisionPendingKey === `${experiment.id}:archive` ? "Saving..." : "Archive"}
                          </Button>
                        </div>
                        {decisionErrors[experiment.id] && (
                          <p className="text-[10px] text-red-300 mt-1">
                            {decisionErrors[experiment.id]}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
