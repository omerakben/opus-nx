"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  NeuralSubmitButton,
  Skeleton,
} from "@/components/ui";
import {
  runForkAnalysis,
  steerForkAnalysis,
  type ForkResponse,
  type SteeringResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Clock,
  GitFork,
  Loader2,
  Merge,
  RotateCcw,
  Sparkles,
  Split,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BranchCard } from "./BranchCard";
import { Convergence } from "./Convergence";

interface ForkPanelProps {
  sessionId: string | null;
}

/**
 * Divergent Path Analysis Panel
 *
 * De-gimmicked from persona-based "ThinkFork" to neutral path-based analysis.
 * Focuses on convergence/divergence detection as the key feature.
 *
 * Key changes from original:
 * - 3 independent reasoning attempts (not 4 personas)
 * - Neutral path labels (A/B/C) instead of Conservative/Aggressive/etc.
 * - Emphasis on divergence points where user can select assumptions
 */
export function ForkPanel({ sessionId }: ForkPanelProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ForkResponse | null>(null);
  const [steeringResult, setSteeringResult] = useState<SteeringResult | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSteering, setIsSteering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Steering input state
  const [steerInput, setSteerInput] = useState("");
  const [steerAction, setSteerAction] = useState<
    "expand" | "merge" | "challenge" | "refork" | null
  >(null);
  const [steerTarget, setSteerTarget] = useState<string>("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);
      setSteeringResult(null);

      // Request 3 branches (excluding contrarian for de-gimmicked mode)
      const response = await runForkAnalysis({
        query: query.trim(),
        sessionId: sessionId ?? undefined,
        styles: ["conservative", "aggressive", "balanced"], // 3 paths, not 4
      });

      if (response.error) {
        setError(response.error.message);
      } else if (response.data) {
        setResult(response.data);
      }

      setIsLoading(false);
    },
    [query, sessionId, isLoading],
  );

  const handleSteer = useCallback(async () => {
    if (!result || !steerAction || isSteering) return;

    setIsSteering(true);
    setSteeringResult(null);

    let action;
    if (steerAction === "expand") {
      action = {
        action: "expand" as const,
        style: steerTarget,
        direction: steerInput || undefined,
      };
    } else if (steerAction === "merge") {
      const styles = result.branches.map((b) => b.style);
      action = {
        action: "merge" as const,
        styles,
        focusArea: steerInput || undefined,
      };
    } else if (steerAction === "challenge") {
      action = {
        action: "challenge" as const,
        style: steerTarget,
        challenge: steerInput,
      };
    } else {
      action = {
        action: "refork" as const,
        newContext: steerInput,
        keepOriginal: true,
      };
    }

    const response = await steerForkAnalysis(result, action);

    if (response.error) {
      setError(response.error.message);
    } else if (response.data) {
      setSteeringResult(response.data);
      setSteerAction(null);
      setSteerInput("");
    }

    setIsSteering(false);
  }, [result, steerAction, steerTarget, steerInput, isSteering]);

  const steerActionConfig = {
    expand: {
      icon: Sparkles,
      label: "Expand",
      color: "text-blue-400",
      borderColor: "border-blue-500/30",
      bgColor: "bg-blue-500/5",
    },
    merge: {
      icon: Merge,
      label: "Synthesize",
      color: "text-violet-400",
      borderColor: "border-violet-500/30",
      bgColor: "bg-violet-500/5",
    },
    challenge: {
      icon: Swords,
      label: "Challenge",
      color: "text-red-400",
      borderColor: "border-red-500/30",
      bgColor: "bg-red-500/5",
    },
    refork: {
      icon: RotateCcw,
      label: "Re-analyze",
      color: "text-amber-400",
      borderColor: "border-amber-500/30",
      bgColor: "bg-amber-500/5",
    },
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-[var(--border)]">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Split className="w-4 h-4 text-violet-500" />
          Divergent Path Analysis
          <span className="text-[10px] font-normal text-[var(--muted-foreground)] ml-auto">
            Independent Reasoning
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-b border-[var(--border)]"
        >
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a decision to analyze..."
              disabled={isLoading}
              className="flex-1 text-xs"
            />
            <NeuralSubmitButton
              disabled={!query.trim()}
              isLoading={isLoading}
            />
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-2">
            3 independent reasoning attempts with varied assumptions
          </p>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              {/* Loading animation */}
              <div className="text-center py-4">
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-2 border-violet-500/40 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Split className="w-6 h-6 text-violet-400 animate-pulse" />
                  </div>
                </div>
                <p className="text-xs text-violet-400 animate-pulse">
                  Running 3 independent reasoning paths...
                </p>
                <LoadingProgress />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-32 rounded-lg"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setError(null)}
              >
                Try again
              </Button>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Convergence/Divergence Summary - THE KEY FEATURE */}
              {(result.convergencePoints.length > 0 ||
                result.divergencePoints.length > 0) && (
                <div className="p-3 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <GitFork className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      Analysis Summary
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[var(--muted-foreground)]">
                        {result.convergencePoints.length} agreement
                        {result.convergencePoints.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-[var(--muted-foreground)]">
                        {result.divergencePoints.length} divergence
                        {result.divergencePoints.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  {result.divergencePoints.length > 0 && (
                    <p className="text-[10px] text-amber-400 mt-2">
                      Review divergence points below to select your preferred
                      assumption
                    </p>
                  )}
                </div>
              )}

              {/* Branch cards */}
              <div className="grid grid-cols-3 gap-3">
                {result.branches.slice(0, 3).map((branch) => (
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
                        className="p-1 rounded bg-[var(--background)]/80 border border-[var(--border)] hover:bg-blue-500/20 hover:border-blue-500/30 transition-colors"
                        title="Expand this path deeper"
                      >
                        <Sparkles className="w-3 h-3 text-blue-400" />
                      </button>
                      <button
                        onClick={() => {
                          setSteerAction("challenge");
                          setSteerTarget(branch.style);
                        }}
                        className="p-1 rounded bg-[var(--background)]/80 border border-[var(--border)] hover:bg-red-500/20 hover:border-red-500/30 transition-colors"
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
                <Card
                  className={cn(
                    steerActionConfig[steerAction].bgColor,
                    steerActionConfig[steerAction].borderColor,
                  )}
                >
                  <CardContent className="p-3">
                    <div
                      className={cn(
                        "text-xs mb-2 flex items-center gap-1",
                        steerActionConfig[steerAction].color,
                      )}
                    >
                      {(() => {
                        const ActionIcon = steerActionConfig[steerAction].icon;
                        return <ActionIcon className="w-3 h-3" />;
                      })()}
                      {steerAction === "expand" && <>Expand path deeper</>}
                      {steerAction === "merge" && <>Synthesize all paths</>}
                      {steerAction === "challenge" && (
                        <>Challenge this conclusion</>
                      )}
                      {steerAction === "refork" && (
                        <>Re-analyze with new context</>
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
                              : steerAction === "refork"
                                ? "New context to re-analyze with..."
                                : "Focus area for synthesis..."
                        }
                        className="flex-1 text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !isSteering &&
                            !(
                              (steerAction === "challenge" ||
                                steerAction === "refork") &&
                              !steerInput.trim()
                            )
                          ) {
                            handleSteer();
                          }
                          if (e.key === "Escape") {
                            setSteerAction(null);
                            setSteerInput("");
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSteer}
                        disabled={
                          isSteering ||
                          ((steerAction === "challenge" ||
                            steerAction === "refork") &&
                            !steerInput.trim())
                        }
                        className="text-xs"
                      >
                        {isSteering ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSteerAction(null);
                          setSteerInput("");
                        }}
                        className="text-xs px-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Steering Result */}
              {steeringResult && (
                <Card className="bg-cyan-500/10 border-cyan-500/30 overflow-hidden">
                  <div className="h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500" />
                  <CardContent className="p-3">
                    <div className="text-xs text-cyan-400 mb-1.5 flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      Steering Result
                    </div>
                    <p className="text-sm text-[var(--foreground)] mb-2 leading-relaxed">
                      {steeringResult.result}
                    </p>
                    {steeringResult.synthesizedApproach && (
                      <div className="mb-2 p-2 rounded bg-violet-500/10 border border-violet-500/20">
                        <p className="text-[11px] text-violet-400 font-medium mb-0.5">
                          Synthesized Approach
                        </p>
                        <p className="text-xs text-[var(--foreground)]">
                          {steeringResult.synthesizedApproach}
                        </p>
                      </div>
                    )}
                    {steeringResult.expandedAnalysis && (
                      <div className="mb-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                        <p className="text-[11px] text-blue-400 font-medium mb-0.5">
                          Expanded Analysis
                        </p>
                        <p className="text-xs text-[var(--foreground)]">
                          {steeringResult.expandedAnalysis}
                        </p>
                      </div>
                    )}
                    {steeringResult.challengeResponse && (
                      <div className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                        <p className="text-[11px] text-red-400 font-medium mb-0.5">
                          Challenge Response
                        </p>
                        <p className="text-xs text-[var(--foreground)]">
                          {steeringResult.challengeResponse}
                        </p>
                      </div>
                    )}
                    {steeringResult.keyInsights.length > 0 && (
                      <ul className="space-y-0.5 mb-2">
                        {steeringResult.keyInsights
                          .slice(0, 4)
                          .map((insight, i) => (
                            <li
                              key={i}
                              className="text-[11px] text-[var(--foreground)] flex items-start gap-1"
                            >
                              <span className="text-cyan-400 mt-0.5">•</span>
                              <span>{insight}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
                      <span className="flex items-center gap-0.5">
                        <Target className="w-2.5 h-2.5" />
                        {Math.round(steeringResult.confidence * 100)}%
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" />
                        {steeringResult.tokensUsed} tokens
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {(steeringResult.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Meta insight */}
              {result.metaInsight && (
                <Card className="bg-violet-500/10 border-violet-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-violet-400 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Cross-Path Insight
                    </div>
                    <p className="text-sm text-[var(--foreground)] leading-relaxed">
                      {result.metaInsight}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Recommended approach - simplified */}
              {result.recommendedApproach && (
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-green-400 mb-1">
                      Recommended Path
                    </div>
                    <p className="text-sm text-[var(--foreground)]">
                      {result.recommendedApproach.rationale}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      Confidence:{" "}
                      {Math.round(result.recommendedApproach.confidence * 100)}%
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Action buttons */}
              {result.branches.length >= 2 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setSteerAction("merge")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--muted-foreground)] hover:text-violet-400 border border-dashed border-[var(--border)] rounded-lg hover:border-violet-500/30 transition-colors"
                  >
                    <Merge className="w-3 h-3" />
                    Synthesize paths
                  </button>
                  <button
                    onClick={() => setSteerAction("refork")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--muted-foreground)] hover:text-amber-400 border border-dashed border-[var(--border)] rounded-lg hover:border-amber-500/30 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Re-analyze with context
                  </button>
                </div>
              )}

              {/* Convergence/Divergence Details */}
              <Convergence
                convergence={result.convergencePoints}
                divergence={result.divergencePoints}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Split className="w-8 h-8 text-[var(--muted-foreground)]" />
                  </div>
                </div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                  Divergent Path Analysis
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
                  Run 3 independent reasoning attempts on a complex decision.
                  Compare where they converge and diverge.
                </p>
                {/* Example query chips */}
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {[
                    "Should we use microservices?",
                    "Optimistic vs pessimistic locking?",
                    "Build vs buy decision?",
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setQuery(example)}
                      className="text-[10px] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:border-violet-500/30 hover:text-violet-400 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 outline-none"
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />{" "}
                    Convergence
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />{" "}
                    Divergence
                  </span>
                  <span className="flex items-center gap-1">
                    <Merge className="w-3 h-3 text-violet-400" /> Synthesize
                  </span>
                </div>
                <p className="text-[10px] text-[#D97757]/70 mt-3">
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

const LOADING_MESSAGES = [
  "Analyzing path 1 of 3...",
  "Analyzing path 2 of 3...",
  "Analyzing path 3 of 3...",
  "Comparing convergence points...",
];

function LoadingProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setStep((p) => (p + 1) % LOADING_MESSAGES.length),
      2500,
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
      {LOADING_MESSAGES[step]}
    </p>
  );
}
