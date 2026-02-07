"use client";

import { useState, useCallback } from "react";
import { BranchCard } from "./BranchCard";
import { Convergence } from "./Convergence";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Skeleton,
} from "@/components/ui";
import {
  runForkAnalysis,
  steerForkAnalysis,
  type ForkResponse,
  type BranchGuidance,
  type SteeringResult,
} from "@/lib/api";
import {
  GitFork,
  Loader2,
  Send,
  Sparkles,
  Merge,
  Swords,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";

interface ForkPanelProps {
  sessionId: string | null;
}

export function ForkPanel({ sessionId }: ForkPanelProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ForkResponse | null>(null);
  const [steeringResult, setSteeringResult] = useState<SteeringResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSteering, setIsSteering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Human guidance state
  const [showGuidance, setShowGuidance] = useState(false);
  const [guidance, setGuidance] = useState<Record<string, string>>({});

  // Steering input state
  const [steerInput, setSteerInput] = useState("");
  const [steerAction, setSteerAction] = useState<"expand" | "merge" | "challenge" | null>(null);
  const [steerTarget, setSteerTarget] = useState<string>("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);
      setSteeringResult(null);

      // Build branch guidance from user input
      const branchGuidance: BranchGuidance[] = [];
      for (const [style, text] of Object.entries(guidance)) {
        if (text.trim()) {
          branchGuidance.push({ style, guidance: text.trim() });
        }
      }

      const response = await runForkAnalysis({
        query: query.trim(),
        sessionId: sessionId ?? undefined,
        branchGuidance: branchGuidance.length > 0 ? branchGuidance : undefined,
      });

      if (response.error) {
        setError(response.error.message);
      } else if (response.data) {
        setResult(response.data);
      }

      setIsLoading(false);
    },
    [query, sessionId, isLoading, guidance]
  );

  const handleSteer = useCallback(async () => {
    if (!result || !steerAction || isSteering) return;

    setIsSteering(true);
    setSteeringResult(null);

    let action;
    if (steerAction === "expand") {
      action = { action: "expand" as const, style: steerTarget, direction: steerInput || undefined };
    } else if (steerAction === "merge") {
      action = { action: "merge" as const, styles: ["conservative", "balanced"] as string[], focusArea: steerInput || undefined };
    } else {
      action = { action: "challenge" as const, style: steerTarget, challenge: steerInput };
    }

    const response = await steerForkAnalysis(result, action);

    if (response.error) {
      setError(response.error.message);
    } else if (response.data) {
      setSteeringResult(response.data);
    }

    setIsSteering(false);
    setSteerAction(null);
    setSteerInput("");
  }, [result, steerAction, steerTarget, steerInput, isSteering]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-[var(--border)]">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <GitFork className="w-4 h-4 text-violet-500" />
          ThinkFork Analysis
          <span className="text-[10px] font-normal text-[var(--muted-foreground)] ml-auto">
            Cognitive Co-Piloting
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-b border-[var(--border)]">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a problem for multi-perspective analysis..."
              disabled={isLoading}
              className="flex-1 text-sm"
            />
            <Button
              type="submit"
              disabled={!query.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Human Guidance Toggle */}
          <button
            type="button"
            onClick={() => setShowGuidance(!showGuidance)}
            className="flex items-center gap-1 mt-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <Users className="w-3 h-3" />
            <span>Guide individual branches</span>
            {showGuidance ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Per-Branch Guidance Inputs */}
          {showGuidance && (
            <div className="mt-2 space-y-1.5">
              {(["conservative", "aggressive", "balanced", "contrarian"] as const).map((style) => (
                <div key={style} className="flex items-center gap-2">
                  <span className="text-[10px] font-medium w-20 text-right capitalize text-[var(--muted-foreground)]">
                    {style}:
                  </span>
                  <input
                    type="text"
                    value={guidance[style] ?? ""}
                    onChange={(e) =>
                      setGuidance((prev) => ({ ...prev, [style]: e.target.value }))
                    }
                    placeholder={`Guide the ${style} perspective...`}
                    className="flex-1 text-[11px] px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                  />
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </div>
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Human guidance indicator */}
              {result.appliedGuidance && result.appliedGuidance.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-cyan-400">
                  <Users className="w-3 h-3" />
                  <span>Human guidance applied to {result.appliedGuidance.length} branch(es)</span>
                </div>
              )}

              {/* Branch cards with steering actions */}
              <div className="grid grid-cols-2 gap-3">
                {result.branches.map((branch) => (
                  <div key={branch.style} className="relative group">
                    <BranchCard
                      branch={branch}
                      isRecommended={
                        result.recommendedApproach?.style === branch.style
                      }
                    />
                    {/* Steering actions overlay */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                      <button
                        onClick={() => {
                          setSteerAction("expand");
                          setSteerTarget(branch.style);
                        }}
                        className="p-1 rounded bg-[var(--background)]/80 border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                        title="Expand this branch"
                      >
                        <Sparkles className="w-3 h-3 text-blue-400" />
                      </button>
                      <button
                        onClick={() => {
                          setSteerAction("challenge");
                          setSteerTarget(branch.style);
                        }}
                        className="p-1 rounded bg-[var(--background)]/80 border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                        title="Challenge this conclusion"
                      >
                        <Swords className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Steering Action Input */}
              {steerAction && (
                <Card className="bg-cyan-500/5 border-cyan-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-cyan-400 mb-2 flex items-center gap-1">
                      {steerAction === "expand" ? (
                        <><Sparkles className="w-3 h-3" /> Expand {steerTarget} branch</>
                      ) : steerAction === "merge" ? (
                        <><Merge className="w-3 h-3" /> Merge branches</>
                      ) : (
                        <><Swords className="w-3 h-3" /> Challenge {steerTarget} conclusion</>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={steerInput}
                        onChange={(e) => setSteerInput(e.target.value)}
                        placeholder={
                          steerAction === "expand"
                            ? "Direction for deeper analysis..."
                            : steerAction === "challenge"
                            ? "Your counter-argument..."
                            : "Focus area for synthesis..."
                        }
                        className="flex-1 text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSteer();
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleSteer}
                        disabled={isSteering || (steerAction === "challenge" && !steerInput.trim())}
                        className="text-xs"
                      >
                        {isSteering ? <Loader2 className="w-3 h-3 animate-spin" /> : "Go"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setSteerAction(null); setSteerInput(""); }}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Steering Result */}
              {steeringResult && (
                <Card className="bg-cyan-500/10 border-cyan-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-cyan-400 mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Steering Result ({steeringResult.action})
                    </div>
                    <p className="text-sm text-[var(--foreground)] mb-2">
                      {steeringResult.result}
                    </p>
                    {steeringResult.keyInsights.length > 0 && (
                      <ul className="space-y-0.5 mb-2">
                        {steeringResult.keyInsights.slice(0, 3).map((insight, i) => (
                          <li key={i} className="text-[11px] text-[var(--foreground)] flex items-start gap-1">
                            <span className="text-cyan-400">*</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="text-[10px] text-[var(--muted-foreground)]">
                      Confidence: {Math.round(steeringResult.confidence * 100)}% | {steeringResult.tokensUsed} tokens | {steeringResult.durationMs}ms
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Meta insight */}
              {result.metaInsight && (
                <Card className="bg-violet-500/10 border-violet-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-violet-400 mb-1">
                      Meta Insight
                    </div>
                    <p className="text-sm text-[var(--foreground)]">
                      {result.metaInsight}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Recommended approach */}
              {result.recommendedApproach && (
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-green-400 mb-1">
                      Recommended Approach
                    </div>
                    <p className="text-sm text-[var(--foreground)]">
                      <span className="font-medium">
                        {result.recommendedApproach.style}
                      </span>
                      : {result.recommendedApproach.rationale}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      Confidence: {Math.round(result.recommendedApproach.confidence * 100)}%
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Merge button */}
              {result.branches.length >= 2 && (
                <button
                  onClick={() => setSteerAction("merge")}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--muted-foreground)] hover:text-violet-400 border border-dashed border-[var(--border)] rounded-lg hover:border-violet-500/30 transition-colors"
                >
                  <Merge className="w-3 h-3" />
                  Merge branches into unified approach
                </button>
              )}

              {/* Convergence/Divergence */}
              <Convergence
                convergence={result.convergencePoints}
                divergence={result.divergencePoints}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <GitFork className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3" />
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                  Multi-Perspective Analysis
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
                  Enter a complex problem to analyze it from 4 different reasoning
                  styles. You can guide individual branches and steer the analysis.
                </p>
                <p className="text-[10px] text-cyan-400/60 mt-2">
                  Powered by Claude Opus 4.6 with max-effort reasoning
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
