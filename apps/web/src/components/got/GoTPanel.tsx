"use client";

import { useState, useCallback, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { getConfidenceColor, getConfidenceTextClass, getConfidenceBgClass } from "@/lib/colors";
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, NeuralSubmitButton, Skeleton } from "@/components/ui";

// ============================================================
// Types
// ============================================================


interface GoTStats {
  totalThoughts: number;
  thoughtsExplored: number;
  thoughtsPruned: number;
  aggregationsMade: number;
  refinementsMade: number;
  maxDepthReached: number;
  totalTokens: number;
  totalDurationMs: number;
}

interface GoTResult {
  answer: string;
  confidence: number;
  reasoningSummary: string;
  stats: GoTStats;
  graphState: {
    thoughtCount: number;
    edgeCount: number;
    bestThoughts: string[];
  };
}

// ============================================================
// GoT Panel
// ============================================================

interface GoTPanelProps {
  sessionId: string | null;
}

export function GoTPanel({ sessionId: _sessionId }: GoTPanelProps) {
  const [query, setQuery] = useState("");
  const [strategy, setStrategy] = useState<"bfs" | "dfs" | "best_first">("bfs");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<GoTResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/got", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: query,
          strategy,
          maxDepth: 4,
          branchingFactor: 3,
          effort: "high",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "GoT reasoning failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "GoT reasoning failed");
    } finally {
      setIsRunning(false);
    }
  }, [query, strategy, isRunning]);

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

      {/* Query Input */}
      <form onSubmit={handleRun} className="flex gap-2">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a problem to reason about..."
          className="flex-1"
          disabled={isRunning}
        />
        <NeuralSubmitButton
          disabled={!query.trim()}
          isLoading={isRunning}
        />
      </form>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Loading */}
      {isRunning && !result && (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
        </div>
      )}

      {/* Results */}
      {result && (
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
              <p className="text-sm text-[var(--foreground)] leading-relaxed">
                {result.answer}
              </p>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCell label="Thoughts" value={result.stats.totalThoughts} />
            <StatCell label="Explored" value={result.stats.thoughtsExplored} />
            <StatCell label="Pruned" value={result.stats.thoughtsPruned} />
            <StatCell label="Aggregated" value={result.stats.aggregationsMade} />
            <StatCell label="Max Depth" value={result.stats.maxDepthReached} />
            <StatCell
              label="Tokens"
              value={result.stats.totalTokens.toLocaleString()}
            />
          </div>

          {/* Reasoning Summary */}
          <details className="group">
            <summary className="text-[11px] text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors">
              View reasoning summary
            </summary>
            <div className="mt-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">
              {result.reasoningSummary}
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
