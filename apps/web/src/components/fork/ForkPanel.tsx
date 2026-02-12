"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  NeuralSubmitButton,
  MarkdownContent,
} from "@/components/ui";
import {
  steerForkAnalysis,
  getSessionForkAnalyses,
  getSessionNodes,
  type ForkResponse,
  type DebateResponse,
  type SteeringResult,
  type ApiError,
} from "@/lib/api";
import { useForkStream } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import {
  FORK_COLORS,
  FORK_ICONS,
  FORK_LABELS,
  type ForkStyle,
} from "@/lib/colors";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  GitFork,
  Merge,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Split,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appEvents } from "@/lib/events";
import { BranchCard } from "./BranchCard";
import { Convergence } from "./Convergence";

interface ForkPanelProps {
  sessionId: string | null;
}

type EffortLevel = "low" | "medium" | "high" | "max";

/**
 * Divergent Path Analysis Panel
 *
 * De-gimmicked from persona-based "ThinkFork" to neutral path-based analysis.
 * Focuses on convergence/divergence detection as the key feature.
 *
 * Key changes from original:
 * - 4 divergent reasoning paths (conservative/aggressive/balanced/contrarian)
 * - Emphasis on divergence points where user can select assumptions
 * - Debate mode for multi-round argumentation between perspectives
 */
export function ForkPanel({ sessionId }: ForkPanelProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ForkResponse | null>(null);
  const [steeringHistory, setSteeringHistory] = useState<SteeringResult[]>([]);
  const [expandedSteeringIdx, setExpandedSteeringIdx] = useState<number>(0);
  const [isSteering, setIsSteering] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [errorTimestamp, setErrorTimestamp] = useState<Date | null>(null);
  const [mode, setMode] = useState<"fork" | "debate">("fork");
  const [debateResult, setDebateResult] = useState<DebateResponse | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  // SSE streaming hook
  const forkStream = useForkStream();
  const isStreamInProgress =
    forkStream.phase === "branches" ||
    forkStream.phase === "comparison" ||
    forkStream.phase === "debate_rounds";

  // Effort level selector (Improvement 2a)
  const [effort, setEffort] = useState<EffortLevel>("max");

  // Convergence assumption selections (Improvement 1)
  const [selectedAssumptions, setSelectedAssumptions] = useState<
    Record<string, { style: string; position: string }>
  >({});

  // Active branch for tab-style selector (null = show compact overview)
  const [activeBranch, setActiveBranch] = useState<number | null>(null);

  // Branch guidance state (Improvement 2)
  const [showGuidance, setShowGuidance] = useState(false);
  const [branchGuidances, setBranchGuidances] = useState<
    Record<string, string>
  >({});

  // Last submitted query for retry (Improvement 2d)
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState("");

  // Dynamic suggestions derived from session's reasoning nodes
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

  // Track previous sessionId to detect changes
  const prevSessionIdRef = useRef(sessionId);

  const loadDynamicSuggestions = useCallback(async (sid: string) => {
    try {
      const response = await getSessionNodes(sid);
      if (response.error || !response.data?.nodes?.length) return;

      const queries = response.data.nodes
        .filter((n) => n.inputQuery && n.nodeType !== "compaction" && n.inputQuery.length > 10)
        .map((n) => n.inputQuery!)
        .filter((q, i, arr) => arr.indexOf(q) === i)
        .slice(0, 3);

      if (queries.length > 0) {
        setDynamicSuggestions(queries);
      }
    } catch {
      // Silent — suggestions are non-critical
    }
  }, []);

  // Reset ALL local state when session changes, then load saved data
  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    // Clear stale state from previous session
    if (sessionChanged) {
      setResult(null);
      setDebateResult(null);
      setSteeringHistory([]);
      setExpandedSteeringIdx(0);
      setAnalysisId(null);
      setError(null);
      setErrorTimestamp(null);
      setQuery("");
      setActiveBranch(null);
      setSelectedAssumptions({});
      setDynamicSuggestions([]);
      forkStream.clear();
    }

    if (!sessionId) return;

    let cancelled = false;

    // Load dynamic suggestions
    loadDynamicSuggestions(sessionId);

    // Load saved analyses
    async function loadSaved() {
      try {
        const response = await getSessionForkAnalyses(sessionId!);
        if (cancelled) return;
        if (response.error) {
          console.warn("[ForkPanel] Failed to load saved analyses:", response.error.message);
          return;
        }
        if (!response.data?.analyses?.length) return;

        const latest = response.data.analyses[0];
        setQuery(latest.query);
        setMode(latest.mode);
        setAnalysisId(latest.id);

        if (latest.mode === "debate") {
          const debateData = latest.result as DebateResponse;
          setDebateResult(debateData);
          setResult(debateData.initialFork);
        } else {
          setResult(latest.result as ForkResponse);
        }

        if (latest.steeringHistory.length > 0) {
          setSteeringHistory(
            (latest.steeringHistory as SteeringResult[]).slice().reverse()
          );
          setExpandedSteeringIdx(0);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[ForkPanel] Error loading saved analyses:", err);
        }
      }
    }

    loadSaved();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Subscribe to thinking:complete to refresh dynamic suggestions
  useEffect(() => {
    const unsub = appEvents.on("thinking:complete", (payload) => {
      if (payload.sessionId === sessionId && sessionId) {
        loadDynamicSuggestions(sessionId);
      }
    });
    return unsub;
  }, [sessionId, loadDynamicSuggestions]);

  // Sync streaming results to local state when done
  useEffect(() => {
    if (forkStream.phase === "done") {
      if (forkStream.result) setResult(forkStream.result);
      if (forkStream.debateResult) setDebateResult(forkStream.debateResult);
      if (forkStream.analysisId) setAnalysisId(forkStream.analysisId);
    }
    if (forkStream.phase === "error" && forkStream.error) {
      setError({ message: forkStream.error, code: "STREAM_ERROR" });
      setErrorTimestamp(new Date());
    }
  }, [forkStream.phase, forkStream.result, forkStream.debateResult, forkStream.analysisId, forkStream.error]);

  // Steering input state
  const [steerInput, setSteerInput] = useState("");
  const [steerAction, setSteerAction] = useState<
    "expand" | "merge" | "challenge" | "refork" | null
  >(null);
  const [steerTarget, setSteerTarget] = useState<string>("");

  const handleSelectAssumption = useCallback(
    (topic: string, style: string, position: string) => {
      setSelectedAssumptions((prev) => ({
        ...prev,
        [topic]: { style, position },
      }));
    },
    [],
  );

  const handleReAnalyzeWithAssumptions = useCallback(
    async (assumptions: Record<string, string>) => {
      if (!result || isSteering) return;

      setIsSteering(true);

      const assumptionSummary = Object.entries(assumptions)
        .map(([topic, choice]) => `[${topic}]: ${choice}`)
        .join("\n");

      const response = await steerForkAnalysis(
        result,
        {
          action: "refork" as const,
          newContext: `Re-analyze using these selected assumptions:\n${assumptionSummary}`,
          keepOriginal: true,
        },
        query.trim() || lastSubmittedQuery,
        analysisId ?? undefined,
      );

      if (response.error) {
        setError(response.error);
        setErrorTimestamp(new Date());
      } else if (response.data) {
        setSteeringHistory(prev => [response.data!, ...prev]);
        setExpandedSteeringIdx(0);
      }

      setIsSteering(false);
    },
    [result, isSteering, analysisId, query, lastSubmittedQuery],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || forkStream.isStreaming) return;

      forkStream.clear();
      setError(null);
      setErrorTimestamp(null);
      setResult(null);
      setDebateResult(null);
      setSteeringHistory([]);
      setExpandedSteeringIdx(0);
      setAnalysisId(null);
      setActiveBranch(null);
      setLastSubmittedQuery(query.trim());

      if (mode === "debate") {
        forkStream.startDebate({
          query: query.trim(),
          sessionId: sessionId ?? undefined,
          styles: ["conservative", "aggressive", "balanced", "contrarian"],
          effort,
          debateRounds: 2,
        });
      } else {
        const guidance = Object.entries(branchGuidances)
          .filter(([, g]) => g.trim())
          .map(([style, guidance]) => ({ style, guidance }));

        forkStream.startFork({
          query: query.trim(),
          sessionId: sessionId ?? undefined,
          styles: ["conservative", "aggressive", "balanced", "contrarian"],
          effort,
          branchGuidance: guidance.length > 0 ? guidance : undefined,
        });
      }
    },
    [query, sessionId, forkStream.isStreaming, forkStream.clear, forkStream.startDebate, forkStream.startFork, mode, branchGuidances, effort],
  );

  // Retry handler (Improvement 2d)
  const handleRetry = useCallback(() => {
    if (!lastSubmittedQuery) return;
    setError(null);
    setErrorTimestamp(null);
    // Re-trigger submit
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    setQuery(lastSubmittedQuery);
    // Use a microtask so the query state updates first
    setTimeout(() => {
      handleSubmit(fakeEvent);
    }, 0);
  }, [lastSubmittedQuery, handleSubmit]);

  const handleSteer = useCallback(async () => {
    if (!result || !steerAction || isSteering) return;

    setIsSteering(true);

    try {
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
        // Include selected assumptions as context for re-analysis
        const assumptionContext = Object.entries(selectedAssumptions)
          .map(
            ([topic, { style, position }]) =>
              `[${topic}]: Use ${style} assumption — "${position}"`
          )
          .join("\n");
        const fullContext = [steerInput, assumptionContext]
          .filter(Boolean)
          .join("\n\nSelected assumptions:\n");
        action = {
          action: "refork" as const,
          newContext: fullContext,
          keepOriginal: true,
        };
      }

      const response = await steerForkAnalysis(
        result,
        action,
        query.trim() || lastSubmittedQuery,
        analysisId ?? undefined
      );

      if (response.error) {
        setError(response.error);
        setErrorTimestamp(new Date());
      } else if (response.data) {
        setSteeringHistory(prev => [response.data!, ...prev]);
        setExpandedSteeringIdx(0);
        setSteerAction(null);
        setSteerInput("");
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Steering request failed",
        code: "STEER_NETWORK_ERROR",
      });
      setErrorTimestamp(new Date());
    } finally {
      setIsSteering(false);
    }
  }, [result, steerAction, steerTarget, steerInput, isSteering, analysisId, selectedAssumptions, query, lastSubmittedQuery]);

  // Visible steering items (Improvement 2c)
  const visibleSteeringHistory = useMemo(() => {
    return steeringHistory;
  }, [steeringHistory]);

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

  const effortOptions: { value: EffortLevel; label: string }[] = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Med" },
    { value: "high", label: "High" },
    { value: "max", label: "Max" },
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-[var(--border)]">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Split className="w-4 h-4 text-violet-500" />
          Divergent Path Analysis
          <span className="text-[11px] font-normal text-[var(--muted-foreground)] ml-auto">
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
          {/* Mode Toggle */}
          <div className="flex mb-3 p-0.5 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setMode("fork")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md transition-colors",
                mode === "fork"
                  ? "bg-[var(--background)] text-violet-400 shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <Split className="w-3 h-3" />
              Fork
            </button>
            <button
              type="button"
              onClick={() => setMode("debate")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md transition-colors",
                mode === "debate"
                  ? "bg-[var(--background)] text-amber-400 shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <Swords className="w-3 h-3" />
              Debate
            </button>
          </div>

          {/* Effort Level Selector (Improvement 2a) */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] text-[var(--muted-foreground)] shrink-0">Effort:</span>
            <div className="flex gap-0.5 p-0.5 rounded-md bg-[var(--muted)]/20 border border-[var(--border)]">
              {effortOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEffort(value)}
                  className={cn(
                    "px-2.5 py-0.5 text-[10px] rounded transition-colors",
                    effort === value && value === "max"
                      ? "bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] shadow-sm font-semibold border border-[var(--brand-warm)]/30"
                      : effort === value
                        ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm font-medium"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">
              {effort === "low" && "Fast analysis"}
              {effort === "medium" && "Balanced speed/depth"}
              {effort === "high" && "Deep reasoning"}
              {effort === "max" && "Deepest reasoning (50k tokens)"}
            </span>
          </div>

          {/* Branch Guidance (collapsible) */}
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowGuidance((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <Compass className="w-3 h-3" />
              {showGuidance ? "Hide guidance" : "Add branch guidance"}
              {showGuidance ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {showGuidance && (
              <div className="mt-2 space-y-1.5">
                {(
                  [
                    { style: "conservative", color: "text-blue-400" },
                    { style: "aggressive", color: "text-red-400" },
                    { style: "balanced", color: "text-green-400" },
                    { style: "contrarian", color: "text-amber-400" },
                  ] as const
                ).map(({ style, color }) => (
                  <div key={style} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs w-20 shrink-0 capitalize font-medium",
                        color
                      )}
                    >
                      {style}
                    </span>
                    <input
                      type="text"
                      value={branchGuidances[style] ?? ""}
                      onChange={(e) =>
                        setBranchGuidances((prev) => ({
                          ...prev,
                          [style]: e.target.value,
                        }))
                      }
                      placeholder={`Guidance for ${style} path...`}
                      className="flex-1 text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                    />
                  </div>
                ))}
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Optional hints to steer each reasoning path
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a decision to analyze..."
              disabled={forkStream.isStreaming}
              className="flex-1 text-xs"
            />
            <NeuralSubmitButton
              disabled={!query.trim()}
              isLoading={forkStream.isStreaming}
            />
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-2">
            {mode === "debate"
              ? "4 perspectives debate across multiple rounds"
              : "4 divergent reasoning paths with varied assumptions"}
          </p>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {isStreamInProgress ? (
            <div className="space-y-4">
              {/* Phase indicator */}
              <div className="text-center py-2">
                <div className="relative w-12 h-12 mx-auto mb-2">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {mode === "debate" ? (
                      <Swords className="w-5 h-5 text-amber-400 animate-pulse" />
                    ) : (
                      <Split className="w-5 h-5 text-violet-400 animate-pulse" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-violet-400">
                  {forkStream.phase === "branches" && (
                    <>Analyzing paths ({forkStream.completedBranches.length}/{forkStream.branches.size})</>
                  )}
                  {forkStream.phase === "comparison" && "Synthesizing convergence..."}
                  {forkStream.phase === "debate_rounds" && (
                    <>Debate round {forkStream.currentRound} of {forkStream.totalRounds}</>
                  )}
                </p>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                  {(forkStream.elapsedMs / 1000).toFixed(0)}s elapsed
                </p>
              </div>

              {/* Progressive branch cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from(forkStream.branches.values()).map((sb) => {
                  if (sb.status === "complete" && sb.result) {
                    return <BranchCard key={sb.style} branch={sb.result} />;
                  }
                  if (sb.status === "error") {
                    return (
                      <BranchCard
                        key={sb.style}
                        branch={{
                          style: sb.style,
                          conclusion: "",
                          confidence: 0,
                          keyInsights: [],
                          error: sb.error ?? "Unknown error",
                        }}
                      />
                    );
                  }
                  return (
                    <BranchCard
                      key={sb.style}
                      branch={{
                        style: sb.style,
                        conclusion: "",
                        confidence: 0,
                        keyInsights: [],
                      }}
                      isStreaming={sb.status === "thinking"}
                      isPending={sb.status === "pending"}
                    />
                  );
                })}
              </div>

              {/* Comparison phase indicator */}
              {forkStream.phase === "comparison" && (
                <Card className="bg-violet-500/10 border-violet-500/30">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                    <span className="text-xs text-violet-400">
                      Analyzing convergence and divergence points...
                    </span>
                  </CardContent>
                </Card>
              )}

              {/* Debate rounds streaming progress */}
              {forkStream.phase === "debate_rounds" && forkStream.debateRounds.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      Debate in progress
                    </span>
                  </div>
                  {forkStream.debateRounds.map((entry, idx) => {
                    const branchStyle = entry.style as ForkStyle;
                    const branchColor = FORK_COLORS[branchStyle] ?? "var(--border)";
                    return (
                      <Card
                        key={`${entry.style}-${entry.round}-${idx}`}
                        className="border-l-2 overflow-hidden"
                        style={{ borderLeftColor: branchColor }}
                      >
                        <CardContent className="p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm" style={{ color: branchColor }}>
                              {FORK_ICONS[branchStyle]}
                            </span>
                            <span className="text-xs font-medium" style={{ color: branchColor }}>
                              R{entry.round} — {entry.style.charAt(0).toUpperCase() + entry.style.slice(1)}
                            </span>
                            <span className="text-[11px] text-[var(--muted-foreground)] ml-auto">
                              {Math.round(entry.confidence * 100)}%
                            </span>
                          </div>
                          <MarkdownContent
                            content={entry.response}
                            size="xs"
                            className="[&_p]:my-0"
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Stop button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1 text-[var(--muted-foreground)]"
                  onClick={forkStream.stop}
                >
                  Stop analysis
                </Button>
              </div>
            </div>
          ) : error ? (
            /* Improved Error Recovery (Improvement 2d) */
            <div className="text-center py-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{error.message}</p>
              </div>
              {error.code && (
                <p className="text-[11px] text-[var(--muted-foreground)] mb-1">
                  Error code: {error.code}
                </p>
              )}
              {errorTimestamp && (
                <p className="text-[10px] text-[var(--muted-foreground)] mb-3">
                  {errorTimestamp.toLocaleTimeString()}
                </p>
              )}
              <div className="flex items-center justify-center gap-2">
                {error.recoverable !== false && lastSubmittedQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={handleRetry}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Retry
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => { setError(null); setErrorTimestamp(null); }}
                >
                  Dismiss
                </Button>
              </div>
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
                    <button
                      onClick={() => document.getElementById('convergence-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="flex items-center gap-1.5 cursor-pointer hover:text-green-400 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span>
                        {result.convergencePoints.length} agreement
                        {result.convergencePoints.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                    <button
                      onClick={() => document.getElementById('divergence-details')?.scrollIntoView({ behavior: 'smooth' })}
                      className="flex items-center gap-1.5 cursor-pointer hover:text-red-400 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>
                        {result.divergencePoints.length} divergence
                        {result.divergencePoints.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                  </div>
                  {result.divergencePoints.length > 0 && (
                    <p className="text-[11px] text-amber-400 mt-2">
                      Review divergence points below to select your preferred
                      assumption
                    </p>
                  )}
                </div>
              )}

              {/* Branch path selector pills */}
              <div className="flex gap-1.5 p-1 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                {result.branches.map((branch, idx) => {
                  const style = branch.style as ForkStyle;
                  const isActive = activeBranch === idx;
                  const isRecommended = result.recommendedApproach?.style === branch.style;
                  return (
                    <button
                      key={branch.style}
                      onClick={() => setActiveBranch(isActive ? null : idx)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs rounded-md transition-all",
                        isActive
                          ? "bg-[var(--background)] shadow-sm font-medium"
                          : "hover:bg-[var(--background)]/50"
                      )}
                      style={isActive ? { color: FORK_COLORS[style] } : undefined}
                    >
                      <span className="text-sm">{FORK_ICONS[style]}</span>
                      <span className={cn(
                        "hidden sm:inline",
                        !isActive && "text-[var(--muted-foreground)]"
                      )}>
                        {FORK_LABELS[style].replace("Path ", "")}
                      </span>
                      <span className={cn(
                        "text-[10px] font-semibold",
                        !isActive && "text-[var(--muted-foreground)]"
                      )}>
                        {Math.round(branch.confidence * 100)}%
                      </span>
                      {isRecommended && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Full-width branch card display */}
              {activeBranch !== null && result.branches[activeBranch] && (
                <div>
                  <BranchCard
                    branch={result.branches[activeBranch]}
                    isRecommended={
                      result.recommendedApproach?.style === result.branches[activeBranch].style
                    }
                    defaultExpanded
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => {
                        setSteerAction("expand");
                        setSteerTarget(result.branches[activeBranch].style);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] text-[var(--muted-foreground)] hover:text-blue-400 rounded border border-[var(--border)] hover:border-blue-500/30 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Expand
                    </button>
                    <button
                      onClick={() => {
                        setSteerAction("challenge");
                        setSteerTarget(result.branches[activeBranch].style);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] text-[var(--muted-foreground)] hover:text-red-400 rounded border border-[var(--border)] hover:border-red-500/30 transition-colors"
                    >
                      <Swords className="w-3 h-3" /> Challenge
                    </button>
                  </div>
                </div>
              )}

              {/* Compact overview when no branch selected (Improvement 2b) */}
              {activeBranch === null && (
                <div className="grid grid-cols-2 gap-2">
                  {result.branches.map((branch, idx) => {
                    const style = branch.style as ForkStyle;
                    const isRecommended = result.recommendedApproach?.style === branch.style;
                    return (
                      <button
                        key={branch.style}
                        onClick={() => setActiveBranch(idx)}
                        className={cn(
                          "text-left p-2.5 rounded-lg border transition-all hover:shadow-sm",
                          isRecommended
                            ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
                            : "border-[var(--border)] bg-[var(--muted)]/20 hover:bg-[var(--muted)]/40"
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="text-sm font-medium"
                            style={{ color: FORK_COLORS[style] }}
                          >
                            {FORK_ICONS[style]}
                          </span>
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: FORK_COLORS[style] }}
                          >
                            {FORK_LABELS[style]}
                          </span>
                          <span className="text-[10px] font-semibold text-[var(--muted-foreground)] ml-auto">
                            {Math.round(branch.confidence * 100)}%
                          </span>
                          {isRecommended && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          )}
                        </div>
                        <MarkdownContent
                          content={branch.conclusion}
                          size="xs"
                          className="[&_p]:my-0"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

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
                      <NeuralSubmitButton
                        disabled={
                          isSteering ||
                          ((steerAction === "challenge" ||
                            steerAction === "refork") &&
                            !steerInput.trim())
                        }
                        isLoading={isSteering}
                        onClick={handleSteer}
                      />
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

              {/* Steering History (Improvement 2c) */}
              {steeringHistory.length > 0 && (
                <div className="space-y-2">
                  {visibleSteeringHistory.map((sr, idx) => {
                    const realIdx = idx;
                    const isExpanded = expandedSteeringIdx === realIdx;
                    return (
                      <Card key={realIdx} className="bg-cyan-500/10 border-cyan-500/30 overflow-hidden">
                        <div className="h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500" />
                        {isExpanded ? (
                          <CardContent className="p-3">
                            <div className="text-xs text-cyan-400 mb-1.5 flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              Steering Result
                              {realIdx === 0 && <span className="text-[11px] ml-1 text-cyan-400/60">(latest)</span>}
                              <button
                                onClick={() => setExpandedSteeringIdx(-1)}
                                className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                            </div>
                            <MarkdownContent
                              content={sr.result}
                              size="sm"
                              className="mb-2 [&_p]:my-0"
                            />
                            {sr.synthesizedApproach && (
                              <div className="mb-2 p-2 rounded bg-violet-500/10 border border-violet-500/20">
                                <p className="text-[11px] text-violet-400 font-medium mb-0.5">
                                  Synthesized Approach
                                </p>
                                <MarkdownContent
                                  content={sr.synthesizedApproach}
                                  size="xs"
                                  className="[&_p]:my-0"
                                />
                              </div>
                            )}
                            {sr.expandedAnalysis && (
                              <div className="mb-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                                <p className="text-[11px] text-blue-400 font-medium mb-0.5">
                                  Expanded Analysis
                                </p>
                                <MarkdownContent
                                  content={sr.expandedAnalysis}
                                  size="xs"
                                  className="[&_p]:my-0"
                                />
                              </div>
                            )}
                            {sr.challengeResponse && (
                              <div className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                                <p className="text-[11px] text-red-400 font-medium mb-0.5">
                                  Challenge Response
                                </p>
                                <MarkdownContent
                                  content={sr.challengeResponse}
                                  size="xs"
                                  className="[&_p]:my-0"
                                />
                              </div>
                            )}
                            {sr.keyInsights.length > 0 && (
                              <ul className="space-y-0.5 mb-2">
                                {sr.keyInsights.map((insight, i) => (
                                  <li
                                    key={i}
                                    className="text-[11px] text-[var(--foreground)] flex items-start gap-1"
                                  >
                                    <span className="text-cyan-400 mt-0.5">•</span>
                                    <MarkdownContent
                                      content={insight}
                                      size="xs"
                                      className="[&_p]:my-0"
                                    />
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
                              <span className="flex items-center gap-0.5">
                                <Target className="w-2.5 h-2.5" />
                                {Math.round(sr.confidence * 100)}%
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5" />
                                {sr.tokensUsed} tokens
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {(sr.durationMs / 1000).toFixed(1)}s
                              </span>
                            </div>
                          </CardContent>
                        ) : (
                          <CardContent className="p-2">
                            <button
                              onClick={() => setExpandedSteeringIdx(realIdx)}
                              className="w-full flex items-center gap-2 text-left"
                            >
                              <Target className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span className="text-xs text-[var(--foreground)] flex-1 whitespace-pre-wrap break-words">
                                {sr.result}
                              </span>
                              <span className="text-[11px] text-[var(--muted-foreground)] shrink-0">
                                {(sr.durationMs / 1000).toFixed(1)}s
                              </span>
                              <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                            </button>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Meta insight */}
              {result.metaInsight && (
                <Card className="bg-violet-500/10 border-violet-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-violet-400 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Cross-Path Insight
                    </div>
                    <MarkdownContent content={result.metaInsight} size="base" />
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
                    <MarkdownContent
                      content={result.recommendedApproach.rationale}
                      size="sm"
                      className="[&_p]:my-0"
                    />
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
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 rounded-lg transition-colors"
                  >
                    <Merge className="w-3.5 h-3.5" />
                    Synthesize paths
                  </button>
                  <button
                    onClick={() => setSteerAction("refork")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Re-analyze with context
                  </button>
                </div>
              )}

              {/* Convergence/Divergence Details */}
              <div id="convergence-details">
                <Convergence
                  convergence={result.convergencePoints}
                  divergence={result.divergencePoints}
                  onSelectAssumption={handleSelectAssumption}
                  onReAnalyze={handleReAnalyzeWithAssumptions}
                />
              </div>

              {/* Debate Results */}
              {debateResult && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Swords className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      Debate ({debateResult.totalRounds} rounds)
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground)] ml-auto">
                      {(debateResult.totalDurationMs / 1000).toFixed(1)}s
                    </span>
                  </div>

                  {/* Debate Rounds Timeline (Improvements 1a, 1b, 1e) */}
                  {Array.from({ length: debateResult.totalRounds }, (_, roundIdx) => {
                    const roundEntries = debateResult.rounds.filter(
                      (r) => r.round === roundIdx + 1
                    );
                    return (
                      <div key={roundIdx} className="space-y-2">
                        <div className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                          Round {roundIdx + 1}
                        </div>
                        {roundEntries.map((entry) => {
                          const entryKey = `${entry.style}-${entry.round}`;
                          const branchStyle = entry.style as ForkStyle;
                          const branchColor = FORK_COLORS[branchStyle] ?? "var(--border)";
                          const branchIcon = FORK_ICONS[branchStyle] ?? "";

                          return (
                            <Card
                              key={entryKey}
                              className={cn(
                                "border-l-2 overflow-hidden",
                                entry.positionChanged
                                  ? "bg-amber-500/5"
                                  : ""
                              )}
                              style={{ borderLeftColor: entry.positionChanged ? "#f59e0b" : branchColor }}
                            >
                              <CardContent className="p-2.5">
                                {/* Header with branch identity (Improvement 1e) */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="text-sm font-medium"
                                      style={{ color: branchColor }}
                                    >
                                      {branchIcon}
                                    </span>
                                    <span
                                      className="text-xs font-medium"
                                      style={{ color: branchColor }}
                                    >
                                      {entry.style.charAt(0).toUpperCase() + entry.style.slice(1)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {entry.positionChanged && (
                                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                        Position changed
                                      </span>
                                    )}
                                    <span className="text-[11px] text-[var(--muted-foreground)]">
                                      {Math.round(entry.confidence * 100)}%
                                    </span>
                                  </div>
                                </div>

                                {/* Response text with expand/collapse (Improvement 1a) */}
                                <MarkdownContent
                                  content={entry.response}
                                  size="xs"
                                  className="[&_p]:my-0"
                                />

                                {/* Counterpoints section (Improvement 1b) */}
                                {entry.keyCounterpoints.length > 0 && (
                                  <div className="mt-2 p-1.5 rounded bg-red-500/5 border border-red-500/15">
                                    <p className="text-[10px] font-medium text-red-400 mb-0.5">
                                      Counterpoints
                                    </p>
                                    <ul className="space-y-0.5">
                                      {entry.keyCounterpoints.map((cp, cpIdx) => (
                                        <li
                                          key={cpIdx}
                                          className="text-[11px] text-[var(--foreground)] flex items-start gap-1"
                                        >
                                          <span className="text-red-400 mt-0.5 shrink-0">•</span>
                                          <span>{cp}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Concessions section - ALL concessions (Improvement 1b) */}
                                {entry.concessions.length > 0 && (
                                  <div className="mt-1.5 p-1.5 rounded bg-green-500/5 border border-green-500/15">
                                    <p className="text-[10px] font-medium text-green-400 mb-0.5">
                                      Concessions
                                    </p>
                                    <ul className="space-y-0.5">
                                      {entry.concessions.map((con, conIdx) => (
                                        <li
                                          key={conIdx}
                                          className="text-[11px] text-[var(--foreground)] flex items-start gap-1"
                                        >
                                          <span className="text-green-400 mt-0.5 shrink-0">•</span>
                                          <span>{con}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Final Positions Comparison (Improvement 1c) */}
                  {debateResult.finalPositions.length > 0 && (
                    <Card className="bg-[var(--muted)]/20 border-[var(--border)]">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Target className="w-3.5 h-3.5 text-violet-400" />
                          <span className="text-xs font-medium text-[var(--foreground)]">
                            Final Positions
                          </span>
                          <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">
                            {debateResult.finalPositions.filter(p => p.changedFromInitial).length} of{" "}
                            {debateResult.finalPositions.length} evolved
                          </span>
                        </div>
                        <div className="space-y-2">
                          {debateResult.finalPositions.map((pos) => {
                            const style = pos.style as ForkStyle;
                            const branchColor = FORK_COLORS[style] ?? "var(--foreground)";
                            const branchIcon = FORK_ICONS[style] ?? "";
                            // Find initial confidence from the first round
                            const initialEntry = debateResult.rounds.find(
                              r => r.style === pos.style && r.round === 1
                            );
                            const initialConf = initialEntry?.confidence ?? pos.confidence;
                            const delta = pos.confidence - initialConf;
                            const deltaSymbol = delta > 0.01 ? "\u2191" : delta < -0.01 ? "\u2193" : "\u2192";
                            const deltaColor = delta > 0.01
                              ? "text-green-400"
                              : delta < -0.01
                                ? "text-red-400"
                                : "text-[var(--muted-foreground)]";

                            return (
                              <div
                                key={pos.style}
                                className={cn(
                                  "p-2 rounded-lg border",
                                  pos.changedFromInitial
                                    ? "border-amber-500/30 bg-amber-500/5"
                                    : "border-[var(--border)] bg-[var(--background)]"
                                )}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-sm" style={{ color: branchColor }}>
                                    {branchIcon}
                                  </span>
                                  <span
                                    className="text-[11px] font-medium"
                                    style={{ color: branchColor }}
                                  >
                                    {pos.style.charAt(0).toUpperCase() + pos.style.slice(1)}
                                  </span>
                                  {pos.changedFromInitial && (
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                      evolved
                                    </span>
                                  )}
                                  <div className="ml-auto flex items-center gap-1.5">
                                    <span className="text-[10px] text-[var(--muted-foreground)]">
                                      {Math.round(initialConf * 100)}%
                                    </span>
                                    <span className={cn("text-[10px] font-medium", deltaColor)}>
                                      {deltaSymbol}
                                    </span>
                                    <span className="text-[10px] font-semibold text-[var(--foreground)]">
                                      {Math.round(pos.confidence * 100)}%
                                    </span>
                                  </div>
                                </div>
                                <MarkdownContent
                                  content={pos.conclusion}
                                  size="xs"
                                  className="[&_p]:my-0"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Consensus Card - Improved (Improvement 1f) */}
                  {debateResult.consensus && (
                    <Card className="bg-green-500/10 border-green-500/30 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Merge className="w-4 h-4 text-green-400" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-green-400">
                              Consensus Reached
                            </div>
                            <div className="text-[11px] text-[var(--muted-foreground)]">
                              {debateResult.finalPositions.filter(p => p.changedFromInitial).length} of{" "}
                              {debateResult.finalPositions.length} positions evolved during debate
                            </div>
                          </div>
                          <div className="ml-auto text-right">
                            <div className="text-lg font-bold text-green-400">
                              {Math.round((debateResult.consensusConfidence ?? 0) * 100)}%
                            </div>
                            <div className="text-[10px] text-[var(--muted-foreground)]">confidence</div>
                          </div>
                        </div>
                        <MarkdownContent
                          content={debateResult.consensus}
                          size="base"
                        />
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-green-500/20 text-[11px] text-[var(--muted-foreground)]">
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="w-2.5 h-2.5" />
                            {debateResult.totalRounds} rounds
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" />
                            {debateResult.totalTokensUsed.toLocaleString()} tokens
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {(debateResult.totalDurationMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* No Consensus */}
                  {!debateResult.consensus && (
                    <Card className="bg-amber-500/10 border-amber-500/30">
                      <CardContent className="p-3">
                        <div className="text-xs text-amber-400 mb-1">
                          No consensus — perspectives remain divergent
                        </div>
                        <div className="text-[11px] text-[var(--muted-foreground)]">
                          {debateResult.finalPositions.filter((p) => p.changedFromInitial).length} of{" "}
                          {debateResult.finalPositions.length} positions changed during debate
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Post-Debate Steering Actions (Improvement 1d) */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSteerAction("refork")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Run additional round
                    </button>
                    <button
                      onClick={() => setSteerAction("merge")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 rounded-lg transition-colors"
                    >
                      <Merge className="w-3.5 h-3.5" />
                      Synthesize debate
                    </button>
                  </div>
                </div>
              )}
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
                  Run 4 divergent reasoning paths on a complex decision.
                  Compare where they converge and diverge.
                </p>
                {/* Dynamic suggestions from session reasoning, or fallback examples */}
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {dynamicSuggestions.length > 0 ? (
                    <>
                      <p className="w-full text-[10px] text-violet-400/70 mb-0.5">
                        From your reasoning:
                      </p>
                      {dynamicSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setQuery(suggestion)}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-violet-500/20 text-violet-400/80 hover:border-violet-500/40 hover:text-violet-400 bg-violet-500/5 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 outline-none whitespace-normal break-words"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </>
                  ) : (
                    [
                      "Should a Series A startup pivot to enterprise?",
                      "Remote-first vs hybrid work policy?",
                      "Build in-house AI vs use third-party APIs?",
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => setQuery(example)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:border-violet-500/30 hover:text-violet-400 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 outline-none"
                      >
                        {example}
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-[var(--muted-foreground)]">
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
                <p className="text-[11px] text-[var(--muted-foreground)] mt-3">
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

// ============================================================
// Loading Progress (Improvement 1g - mode-aware messages)
// ============================================================

const FORK_LOADING_MESSAGES = [
  "Analyzing path 1 of 4...",
  "Analyzing path 2 of 4...",
  "Analyzing path 3 of 4...",
  "Analyzing path 4 of 4...",
  "Comparing convergence points...",
];

const DEBATE_LOADING_MESSAGES = [
  "Running initial analysis...",
  "Starting debate round 1...",
  "Perspectives are challenging each other...",
  "Evaluating counterpoints and concessions...",
  "Starting debate round 2...",
  "Positions are converging...",
  "Checking for consensus...",
];

function _LoadingProgress({ mode }: { mode: "fork" | "debate" }) {
  const [step, setStep] = useState(0);
  const messages = mode === "debate" ? DEBATE_LOADING_MESSAGES : FORK_LOADING_MESSAGES;

  useEffect(() => {
    setStep(0); // Reset when mode changes
  }, [mode]);

  useEffect(() => {
    const interval = setInterval(
      () => setStep((p) => (p + 1) % messages.length),
      mode === "debate" ? 3000 : 2500,
    );
    return () => clearInterval(interval);
  }, [messages.length, mode]);

  return (
    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
      {messages[step]}
    </p>
  );
}
