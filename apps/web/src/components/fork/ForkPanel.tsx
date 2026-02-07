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
  RotateCcw,
  ArrowRight,
  Zap,
  Clock,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [steerAction, setSteerAction] = useState<"expand" | "merge" | "challenge" | "refork" | null>(null);
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
      const styles = result.branches.map(b => b.style);
      action = { action: "merge" as const, styles, focusArea: steerInput || undefined };
    } else if (steerAction === "challenge") {
      action = { action: "challenge" as const, style: steerTarget, challenge: steerInput };
    } else {
      action = { action: "refork" as const, newContext: steerInput, keepOriginal: true };
    }

    const response = await steerForkAnalysis(result, action);

    if (response.error) {
      setError(response.error.message);
    } else if (response.data) {
      setSteeringResult(response.data);
      // Only clear input on success
      setSteerAction(null);
      setSteerInput("");
    }

    setIsSteering(false);
  }, [result, steerAction, steerTarget, steerInput, isSteering]);

  const steerActionConfig = {
    expand: { icon: Sparkles, label: "Expand", color: "text-blue-400", borderColor: "border-blue-500/30", bgColor: "bg-blue-500/5" },
    merge: { icon: Merge, label: "Merge", color: "text-violet-400", borderColor: "border-violet-500/30", bgColor: "bg-violet-500/5" },
    challenge: { icon: Swords, label: "Challenge", color: "text-red-400", borderColor: "border-red-500/30", bgColor: "bg-red-500/5" },
    refork: { icon: RotateCcw, label: "Re-fork", color: "text-amber-400", borderColor: "border-amber-500/30", bgColor: "bg-amber-500/5" },
  };

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
              {/* Loading animation */}
              <div className="text-center py-4">
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-2 border-violet-500/40 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GitFork className="w-6 h-6 text-violet-400 animate-pulse" />
                  </div>
                </div>
                <p className="text-xs text-violet-400 animate-pulse">
                  Forking reasoning into 4 perspectives...
                </p>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                  Each branch uses independent max-effort thinking
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setError(null)}>
                Try again
              </Button>
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
                        className="p-1 rounded bg-[var(--background)]/80 border border-[var(--border)] hover:bg-blue-500/20 hover:border-blue-500/30 transition-colors"
                        title="Expand this branch deeper"
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
                <Card className={cn(steerActionConfig[steerAction].bgColor, steerActionConfig[steerAction].borderColor)}>
                  <CardContent className="p-3">
                    <div className={cn("text-xs mb-2 flex items-center gap-1", steerActionConfig[steerAction].color)}>
                      {(() => {
                        const ActionIcon = steerActionConfig[steerAction].icon;
                        return <ActionIcon className="w-3 h-3" />;
                      })()}
                      {steerAction === "expand" && <>Expand {steerTarget} branch</>}
                      {steerAction === "merge" && <>Merge all branches</>}
                      {steerAction === "challenge" && <>Challenge {steerTarget} conclusion</>}
                      {steerAction === "refork" && <>Re-fork with new context</>}
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
                          if (e.key === "Enter" && !isSteering && !((steerAction === "challenge" || steerAction === "refork") && !steerInput.trim())) {
                            handleSteer();
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSteer}
                        disabled={isSteering || ((steerAction === "challenge" || steerAction === "refork") && !steerInput.trim())}
                        className="text-xs"
                      >
                        {isSteering ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setSteerAction(null); setSteerInput(""); }}
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
                      <span className="text-[10px] text-[var(--muted-foreground)] ml-1">
                        ({steeringResult.action})
                      </span>
                    </div>
                    <p className="text-sm text-[var(--foreground)] mb-2 leading-relaxed">
                      {steeringResult.result}
                    </p>
                    {steeringResult.synthesizedApproach && (
                      <div className="mb-2 p-2 rounded bg-violet-500/10 border border-violet-500/20">
                        <p className="text-[11px] text-violet-400 font-medium mb-0.5">Synthesized Approach</p>
                        <p className="text-xs text-[var(--foreground)]">{steeringResult.synthesizedApproach}</p>
                      </div>
                    )}
                    {steeringResult.expandedAnalysis && (
                      <div className="mb-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                        <p className="text-[11px] text-blue-400 font-medium mb-0.5">Expanded Analysis</p>
                        <p className="text-xs text-[var(--foreground)]">{steeringResult.expandedAnalysis}</p>
                      </div>
                    )}
                    {steeringResult.challengeResponse && (
                      <div className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                        <p className="text-[11px] text-red-400 font-medium mb-0.5">Challenge Response</p>
                        <p className="text-xs text-[var(--foreground)]">{steeringResult.challengeResponse}</p>
                      </div>
                    )}
                    {steeringResult.keyInsights.length > 0 && (
                      <ul className="space-y-0.5 mb-2">
                        {steeringResult.keyInsights.slice(0, 4).map((insight, i) => (
                          <li key={i} className="text-[11px] text-[var(--foreground)] flex items-start gap-1">
                            <span className="text-cyan-400 mt-0.5">*</span>
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
                      Meta Insight
                    </div>
                    <p className="text-sm text-[var(--foreground)] leading-relaxed">
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
                      <span className="font-medium capitalize">
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

              {/* Action buttons */}
              {result.branches.length >= 2 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setSteerAction("merge")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--muted-foreground)] hover:text-violet-400 border border-dashed border-[var(--border)] rounded-lg hover:border-violet-500/30 transition-colors"
                  >
                    <Merge className="w-3 h-3" />
                    Merge branches
                  </button>
                  <button
                    onClick={() => setSteerAction("refork")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--muted-foreground)] hover:text-amber-400 border border-dashed border-[var(--border)] rounded-lg hover:border-amber-500/30 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Re-fork with context
                  </button>
                </div>
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
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GitFork className="w-8 h-8 text-[var(--muted-foreground)]" />
                  </div>
                </div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                  Multi-Perspective Analysis
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
                  Enter a complex problem to analyze it from 4 reasoning
                  perspectives. Guide branches and steer the analysis.
                </p>
                <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" /> Expand
                  </span>
                  <span className="flex items-center gap-1">
                    <Swords className="w-3 h-3 text-red-400" /> Challenge
                  </span>
                  <span className="flex items-center gap-1">
                    <Merge className="w-3 h-3 text-violet-400" /> Merge
                  </span>
                  <span className="flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-amber-400" /> Re-fork
                  </span>
                </div>
                <p className="text-[10px] text-cyan-400/60 mt-3">
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
