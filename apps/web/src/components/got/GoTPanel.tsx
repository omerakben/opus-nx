"use client";

import { useState, useCallback, useEffect, useMemo, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { getConfidenceColor, getConfidenceTextClass, getConfidenceBgClass } from "@/lib/colors";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  NeuralSubmitButton,
  MarkdownContent,
  MarkdownRawToggle,
} from "@/components/ui";
import { GoTGraph } from "./GoTGraph";
import { transformGoTToFlow } from "@/lib/got-graph-utils";
import { useGoTStream } from "@/lib/hooks/use-got-stream";
import { appEvents } from "@/lib/events";
import type { StreamingThought } from "@/lib/hooks/use-got-stream";

// ============================================================
// Types
// ============================================================

interface GoTPanelProps {
  sessionId: string | null;
  onSendToVerify?: (steps: Array<{ content: string; type?: string }>) => void;
}

// ============================================================
// GoT Panel
// ============================================================

export function GoTPanel({ sessionId, onSendToVerify }: GoTPanelProps) {
  const [query, setQuery] = useState("");
  const [strategy, setStrategy] = useState<"bfs" | "dfs" | "best_first">("bfs");
  const [selectedThoughtId, setSelectedThoughtId] = useState<string | null>(null);

  // Config panel state
  const [maxDepth, setMaxDepth] = useState(4);
  const [branchingFactor, setBranchingFactor] = useState(3);
  const [effort, setEffort] = useState<"low" | "medium" | "high" | "max">("high");
  const [enableAggregation, setEnableAggregation] = useState(true);

  // Streaming hook
  const {
    phase,
    thoughts,
    thoughtOrder,
    currentDepth,
    maxDepth: streamMaxDepth,
    stats,
    errors,
    result,
    isStreaming,
    elapsedMs,
    start,
    stop,
    clear,
    restore,
  } = useGoTStream();

  // ── SessionStorage cache key for GoT results ────────────────
  const cacheKey = sessionId ? `opus-nx:got:${sessionId}` : null;

  // Restore persisted GoT result on mount / session change.
  // Priority: 1) sessionStorage (fast, in-session) → 2) database (survives logout)
  useEffect(() => {
    if (!sessionId || phase !== "idle") return;

    // Try sessionStorage first (fast path for in-session navigation)
    if (cacheKey) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { result: cachedResult, query: cachedQuery, strategy: cachedStrategy, elapsedMs: cachedMs } = JSON.parse(cached);
          if (cachedResult) {
            restore(cachedResult, cachedMs ?? 0);
            setQuery(cachedQuery ?? "");
            setStrategy(cachedStrategy ?? "bfs");
            return; // sessionStorage hit — skip DB fetch
          }
        }
      } catch {
        // Corrupted cache — fall through to DB
      }
    }

    // Fall back to database (survives logout/refresh)
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/got?sessionId=${sessionId}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const results = json.data?.results ?? [];
        if (cancelled || results.length === 0) return;

        // Use the most recent GoT result
        const latest = results[0];
        const dbResult = {
          answer: latest.answer,
          confidence: latest.confidence,
          reasoningSummary: latest.reasoningSummary,
          stats: latest.stats,
          graphState: latest.graphState,
        };
        restore(dbResult, latest.stats?.totalDurationMs ?? 0);
        setQuery(latest.query ?? "");
        if (latest.config?.strategy) {
          setStrategy(latest.config.strategy);
        }
      } catch {
        // DB fetch failed — non-critical, GoT panel starts empty
      }
    })();

    return () => { cancelled = true; };
  }, [sessionId, cacheKey, phase, restore]);

  // Cache result to sessionStorage on completion (write-through cache)
  useEffect(() => {
    if (phase === "done" && result && cacheKey) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          result,
          query,
          strategy,
          elapsedMs,
        }));
      } catch {
        // Storage full — non-critical
      }
    }
  }, [phase, result, cacheKey, query, strategy, elapsedMs]);

  // Reset when session changes
  useEffect(() => {
    const unsub = appEvents.on("session:changed", () => {
      clear();
      setSelectedThoughtId(null);
    });
    return unsub;
  }, [clear]);

  const handleRun = useCallback((e?: FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isStreaming) return;
    setSelectedThoughtId(null);

    if (sessionId) {
      appEvents.emit("got:started", { sessionId, strategy });
    }

    start({
      problem: query,
      sessionId: sessionId ?? undefined,
      strategy,
      maxDepth,
      branchingFactor,
      enableAggregation,
      effort,
    });
  }, [query, strategy, isStreaming, sessionId, maxDepth, branchingFactor, enableAggregation, effort, start]);

  // Emit completion event
  useEffect(() => {
    if (phase === "done" && result && sessionId) {
      appEvents.emit("got:complete", { sessionId, confidence: result.confidence });
      appEvents.emit("data:stale", { scope: "got", sessionId });
    }
  }, [phase, result, sessionId]);

  // Transform graph data for visualization
  const graphData = useMemo(() => {
    if (result) {
      // Use final result data (most accurate)
      return transformGoTToFlow(
        result.graphState.thoughts as StreamingThought[],
        result.graphState.edges,
        result.graphState.bestThoughts,
        selectedThoughtId ?? undefined,
      );
    }

    // During streaming, build from streaming state
    if (thoughts.size > 0) {
      const thoughtArr = Array.from(thoughts.values());
      // Build edges from parentIds
      const edges: Array<{ sourceId: string; targetId: string; type: string; weight: number }> = [];
      for (const t of thoughtArr) {
        for (const pid of t.parentIds) {
          edges.push({ sourceId: pid, targetId: t.id, type: "influences", weight: 1.0 });
        }
      }
      return transformGoTToFlow(thoughtArr, edges, [], selectedThoughtId ?? undefined);
    }

    return { nodes: [], edges: [] };
  }, [result, thoughts, selectedThoughtId]);

  // Selected thought detail
  const selectedThought = useMemo(() => {
    if (!selectedThoughtId) return null;
    // Check result first (final data), then streaming state
    if (result) {
      return (result.graphState.thoughts as StreamingThought[]).find(t => t.id === selectedThoughtId) ?? null;
    }
    return thoughts.get(selectedThoughtId) ?? null;
  }, [selectedThoughtId, result, thoughts]);

  // Cross-feature: Verify Answer
  const handleVerifyAnswer = useCallback(() => {
    if (!result || !onSendToVerify) return;
    const bestThoughtIds = result.graphState.bestThoughts;
    const allThoughts = result.graphState.thoughts as StreamingThought[];
    const steps: Array<{ content: string; type?: string }> = bestThoughtIds
      .map(id => allThoughts.find(t => t.id === id))
      .filter(Boolean)
      .map(t => ({ content: t!.content, type: "analysis" }));

    if (steps.length === 0) {
      steps.push({ content: result.answer, type: "conclusion" });
    }
    onSendToVerify(steps);
  }, [result, onSendToVerify]);

  // Cross-feature: Save to Memory
  const handleSaveToMemory = useCallback(async () => {
    if (!result) return;
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "archival_insert",
          tier: "archival",
          content: `GoT Answer (${strategy}, confidence: ${(result.confidence * 100).toFixed(0)}%): ${result.answer}\n\nReasoning: ${result.reasoningSummary}`,
          metadata: { source: "got", strategy, confidence: result.confidence },
          sessionId: sessionId ?? undefined,
        }),
      });
    } catch {
      // Silently fail — memory is optional
    }
  }, [result, strategy, sessionId]);

  // Recent thoughts feed (last 8)
  const recentThoughts = useMemo(() => {
    return thoughtOrder.slice(-8).map(id => thoughts.get(id)).filter(Boolean) as StreamingThought[];
  }, [thoughtOrder, thoughts]);

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="3" />
          <circle cx="5" cy="19" r="3" />
          <circle cx="19" cy="19" r="3" />
          <path d="M12 8v3M8.5 17l2-5.5M15.5 17l-2-5.5" />
        </svg>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Graph of Thoughts
        </h3>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/30 text-amber-500">
          GoT
        </Badge>
        {isStreaming && (
          <span className="text-[10px] text-amber-400 ml-auto">
            {formatElapsed(elapsedMs)}
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
        Explore problems using arbitrary reasoning graphs with BFS/DFS search,
        thought aggregation, and step-level verification.
      </p>

      {/* Strategy Selector */}
      <div className="flex gap-1.5">
        {(["bfs", "dfs", "best_first"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            disabled={isStreaming}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors",
              strategy === s
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                : "bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:border-amber-500/20"
            )}
          >
            {s === "bfs" ? "Breadth-First" : s === "dfs" ? "Depth-First" : "Best-First"}
          </button>
        ))}
      </div>

      {/* Config Panel */}
      <details className="group">
        <summary className="text-[11px] text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors">
          Advanced config
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[var(--muted-foreground)] block mb-0.5">Max Depth</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxDepth}
              onChange={e => setMaxDepth(Number(e.target.value))}
              disabled={isStreaming}
              className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--muted-foreground)] block mb-0.5">Branching</label>
            <input
              type="number"
              min={1}
              max={10}
              value={branchingFactor}
              onChange={e => setBranchingFactor(Number(e.target.value))}
              disabled={isStreaming}
              className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--muted-foreground)] block mb-0.5">Effort</label>
            <select
              value={effort}
              onChange={e => setEffort(e.target.value as typeof effort)}
              disabled={isStreaming}
              className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="max">Max</option>
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={enableAggregation}
                onChange={e => setEnableAggregation(e.target.checked)}
                disabled={isStreaming}
                className="rounded"
              />
              Aggregation
            </label>
          </div>
        </div>
      </details>

      {/* Query Input */}
      <form onSubmit={handleRun} className="flex gap-2">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a problem to reason about..."
          className="flex-1"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
          >
            Stop
          </button>
        ) : (
          <NeuralSubmitButton
            disabled={!query.trim()}
            isLoading={false}
          />
        )}
      </form>

      {/* Error Banner */}
      {errors.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs space-y-1">
          {errors.map((err, i) => (
            <div key={i}>{err.message}</div>
          ))}
        </div>
      )}

      {/* Live Progress (during streaming) */}
      {isStreaming && (
        <div className="space-y-2 animate-fade-in">
          {/* Depth Progress */}
          {streamMaxDepth > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                <span>Depth {currentDepth} / {streamMaxDepth}</span>
                <span>{thoughts.size} thoughts</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (currentDepth / streamMaxDepth) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Live Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-1.5">
              <MiniStat label="Explored" value={stats.thoughtsExplored} />
              <MiniStat label="Pruned" value={stats.thoughtsPruned} />
              <MiniStat label="Aggregated" value={stats.aggregationsMade} />
            </div>
          )}

          {/* Recent Thought Feed */}
          {recentThoughts.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recentThoughts.map(t => (
                <div
                  key={t.id}
                  className="px-2 py-1 rounded bg-[var(--card)] border border-[var(--border)] text-[10px] text-[var(--muted-foreground)] whitespace-pre-wrap break-words"
                >
                  <span className={cn(
                    "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
                    t.state === "verified" ? "bg-emerald-500" :
                    t.state === "rejected" ? "bg-red-500" : "bg-blue-500"
                  )} />
                  {t.content}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Exploring reasoning paths... {formatElapsed(elapsedMs)}
            </p>
          </div>
        </div>
      )}

      {/* Graph Visualization */}
      {graphData.nodes.length > 0 && (
        <div className="h-[400px] rounded-lg border border-[var(--border)] overflow-hidden relative isolate">
          <GoTGraph
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeClick={setSelectedThoughtId}
          />
        </div>
      )}

      {/* Thought Detail Card */}
      {selectedThought && (
        <Card className="border-amber-500/20 bg-amber-500/5 animate-fade-in">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-amber-400">
                Thought Detail
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  depth={selectedThought.depth}
                </span>
                {selectedThought.score !== null && (
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    getConfidenceBgClass(selectedThought.score),
                    getConfidenceTextClass(selectedThought.score)
                  )}>
                    {(selectedThought.score * 100).toFixed(0)}%
                  </span>
                )}
                <button
                  onClick={() => setSelectedThoughtId(null)}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs"
                >
                  &times;
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <MarkdownRawToggle content={selectedThought.content} size="sm" />
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && phase === "done" && (
        <div className="space-y-3 animate-fade-in">
          {/* Answer Card */}
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-amber-400">
                  Answer
                </CardTitle>
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
                  getConfidenceBgClass(result.confidence),
                  getConfidenceTextClass(result.confidence)
                )}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getConfidenceColor(result.confidence) }} />
                  {(result.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <MarkdownContent content={result.answer} size="base" />
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCell label="Thoughts" value={result.stats.totalThoughts} />
            <StatCell label="Explored" value={result.stats.thoughtsExplored} />
            <StatCell label="Pruned" value={result.stats.thoughtsPruned} />
            <StatCell label="Aggregated" value={result.stats.aggregationsMade} />
            <StatCell label="Max Depth" value={result.stats.maxDepthReached} />
            <StatCell label="Tokens" value={result.stats.totalTokens.toLocaleString()} />
            {result.stats.generationErrors > 0 && (
              <StatCell label="Gen Errors" value={result.stats.generationErrors} />
            )}
            {result.stats.evaluationErrors > 0 && (
              <StatCell label="Eval Errors" value={result.stats.evaluationErrors} />
            )}
          </div>

          {/* Cross-Feature Actions */}
          <div className="flex gap-2">
            {onSendToVerify && (
              <button
                onClick={handleVerifyAnswer}
                className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              >
                Verify Answer
              </button>
            )}
            <button
              onClick={handleSaveToMemory}
              className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              Save to Memory
            </button>
          </div>

          {/* Reasoning Summary */}
          <details className="group">
            <summary className="text-[11px] text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors">
              View reasoning summary
            </summary>
            <div className="mt-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)]">
              <MarkdownRawToggle content={result.reasoningSummary} size="sm" />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
      <div className="text-[10px] text-[var(--muted-foreground)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-1 rounded bg-[var(--card)] border border-[var(--border)] text-center">
      <div className="text-[9px] text-[var(--muted-foreground)]">{label}</div>
      <div className="text-xs font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}
