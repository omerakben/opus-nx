"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getConfidenceColor, getConfidenceTextClass } from "@/lib/colors";
import { Badge, Button, Card, CardContent } from "@/components/ui";

// ============================================================
// Types
// ============================================================

interface StepVerification {
  stepIndex: number;
  verdict: "correct" | "incorrect" | "neutral" | "uncertain";
  confidence: number;
  explanation: string;
  issues: Array<{
    type: string;
    description: string;
    severity: "critical" | "major" | "minor";
  }>;
  suggestedCorrection?: string;
  stepContent?: string;
}

interface VerificationResult {
  overallScore: number;
  isValid: boolean;
  firstErrorAt: number;
  summary: string;
  steps: StepVerification[];
  patterns: Array<{
    name: string;
    description: string;
    affectedSteps: number[];
  }>;
}

// ============================================================
// Verdict Styling
// ============================================================

const VERDICT_STYLES = {
  correct: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/20",
    icon: "check",
    label: "Correct",
  },
  incorrect: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    icon: "x",
    label: "Incorrect",
  },
  neutral: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/20",
    icon: "minus",
    label: "Neutral",
  },
  uncertain: {
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    border: "border-gray-500/20",
    icon: "question",
    label: "Uncertain",
  },
} as const;

const SEVERITY_STYLES = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  major: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  minor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
} as const;

// ============================================================
// Verification Panel
// ============================================================

interface VerificationPanelProps {
  sessionId: string | null;
  /** Pre-populate with steps from a thinking node */
  initialSteps?: Array<{ content: string; type?: string }>;
}

export function VerificationPanel({ sessionId, initialSteps }: VerificationPanelProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [steps, setSteps] = useState<Array<{ content: string; type?: string }>>(initialSteps ?? []);
  const [stepsInput, setStepsInput] = useState("");
  const [verifyingStep, setVerifyingStep] = useState(0);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, []);

  const handleVerify = useCallback(async (steps: Array<{ content: string; type?: string }>) => {
    if (isVerifying || steps.length === 0) return;
    setIsVerifying(true);
    setError(null);
    setVerifyingStep(0);

    stepIntervalRef.current = setInterval(() => {
      setVerifyingStep((prev) => Math.min(prev + 1, steps.length - 1));
    }, 3500);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: steps.map((s, i) => ({
            stepNumber: i + 1,
            content: s.content,
            type: s.type,
          })),
          effort: "high",
        }),
      });

      if (!res.ok) {
        let errorMessage = `Verification failed (${res.status})`;
        try {
          const data = await res.json();
          if (data.error?.message) errorMessage = data.error.message;
        } catch {
          // Response was not JSON (e.g., Vercel 502 HTML page)
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
      setIsVerifying(false);
    }
  }, [isVerifying]);

  const handleParseSteps = useCallback(() => {
    const parsed = stepsInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((content) => ({ content }));
    if (parsed.length > 0) {
      setSteps(parsed);
      setResult(null);
      setError(null);
    } else {
      setError("No steps found. Enter one reasoning step per line.");
    }
  }, [stepsInput]);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
    setExpandedStep(null);
  }, []);

  const handleLoadFromSession = useCallback(async () => {
    if (!sessionId || isLoadingSession) return;
    setIsLoadingSession(true);
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/nodes`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to load session nodes");
      }
      const data = await res.json();
      const nodes: Array<{ content: string; type?: string }> = (
        Array.isArray(data) ? data : data.nodes ?? []
      )
        .filter((n: { content?: string }) => n.content?.trim())
        .map((n: { content: string; type?: string }) => ({
          content: n.content,
          type: n.type,
        }));
      if (nodes.length === 0) {
        setError("No reasoning nodes found in this session");
      } else {
        setSteps(nodes);
        setStepsInput(nodes.map((n) => n.content).join("\n"));
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setIsLoadingSession(false);
    }
  }, [sessionId, isLoadingSession]);

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Step Verification
        </h3>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-blue-500/30 text-blue-400">
          PRM
        </Badge>
      </div>

      <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
        Verify reasoning chains step-by-step using process reward modeling.
        Each step is evaluated independently for correctness.
      </p>

      {/* Input Section */}
      {!result && (
        <div className="space-y-2">
          <textarea
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            placeholder="Enter reasoning steps, one per line..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 resize-none"
            rows={5}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleParseSteps}
              disabled={!stepsInput.trim()}
              variant="outline"
              className="flex-1 text-xs"
            >
              Parse Steps
            </Button>
            <Button
              onClick={handleLoadFromSession}
              disabled={!sessionId || isLoadingSession}
              variant="outline"
              className="flex-1 text-xs"
            >
              {isLoadingSession ? "Loading..." : "Load from Session"}
            </Button>
          </div>

          {/* Parsed steps count */}
          {steps.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--muted-foreground)]">
                {steps.length} step{steps.length !== 1 ? "s" : ""} ready to verify
              </span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-green-500/30 text-green-400">
                {steps.length}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Verify Button */}
      {steps.length > 0 && !result && (
        <Button
          onClick={() => handleVerify(steps)}
          disabled={isVerifying}
          className="w-full text-sm"
        >
          {isVerifying ? (
            <span className="flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              Verifying {steps.length} steps...
            </span>
          ) : (
            `Verify ${steps.length} Reasoning Steps`
          )}
        </Button>
      )}

      {/* Empty State */}
      {steps.length === 0 && !result && !error && !isVerifying && (
        <div className="px-3 py-4 rounded-lg border border-dashed border-[var(--border)] text-center">
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            Enter reasoning steps manually or load from a session to verify each step independently.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-2 shrink-0">
            &times;
          </button>
        </div>
      )}

      {/* Loading — progress indicator */}
      {isVerifying && (
        <div className="space-y-2">
          <div className="text-[11px] text-[var(--muted-foreground)]">
            Verifying step {verifyingStep + 1} of {steps.length}...{" "}
            ({Math.round(((verifyingStep + 1) / steps.length) * 100)}%)
          </div>
          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${((verifyingStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-medium transition-all duration-300",
                  i < verifyingStep
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : i === verifyingStep
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                      : "bg-[var(--muted)]/30 text-[var(--muted-foreground)] border border-[var(--border)]"
                )}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3 animate-fade-in">
          {/* Reset */}
          <div className="flex justify-end">
            <Button variant="outline" className="text-xs" onClick={handleReset}>
              New Verification
            </Button>
          </div>

          {/* Overall Score */}
          <Card className={cn(
            "border",
            result.isValid ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
          )}>
            <CardContent className="px-3 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    result.isValid ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {result.isValid ? "V" : "X"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      Chain {result.isValid ? "Valid" : "Invalid"}
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      {result.steps.filter((s) => s.verdict === "correct").length} correct,{" "}
                      {result.steps.filter((s) => s.verdict === "incorrect").length} incorrect
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "text-xl font-bold",
                  getConfidenceTextClass(result.overallScore)
                )}>
                  {(result.overallScore * 100).toFixed(0)}%
                </div>
              </div>

              {/* Score Bar */}
              <div className="mt-2 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${result.overallScore * 100}%`,
                    backgroundColor: getConfidenceColor(result.overallScore),
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {result.summary && (
            <details className="group">
              <summary className="text-[11px] text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors">
                View verification summary
              </summary>
              <div className="mt-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">
                {result.summary}
              </div>
            </details>
          )}

          {/* Step-by-Step Results */}
          <div className="space-y-1.5">
            {result.steps.map((step) => {
              const style = VERDICT_STYLES[step.verdict];
              const isExpanded = expandedStep === step.stepIndex;

              return (
                <button
                  key={step.stepIndex}
                  onClick={() => setExpandedStep(isExpanded ? null : step.stepIndex)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg border transition-all",
                    style.border,
                    isExpanded ? style.bg : "bg-transparent hover:bg-[var(--card)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        style.bg, style.text
                      )}>
                        {step.stepIndex + 1}
                      </span>
                      <span className={cn("text-[11px] font-medium", style.text)}>
                        {style.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {(step.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                      {step.stepContent && (
                        <div className="px-2 py-1.5 rounded bg-[var(--muted)]/30 text-[10px] text-[var(--foreground)] leading-relaxed italic">
                          {step.stepContent}
                        </div>
                      )}
                      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                        {step.explanation}
                      </p>

                      {step.issues.length > 0 && (
                        <div className="space-y-1">
                          {step.issues.map((issue, i) => (
                            <div
                              key={i}
                              className={cn(
                                "px-2 py-1 rounded text-[10px] border",
                                SEVERITY_STYLES[issue.severity]
                              )}
                            >
                              <span className="font-medium">{issue.severity}:</span>{" "}
                              {issue.description}
                            </div>
                          ))}
                        </div>
                      )}

                      {step.suggestedCorrection && (
                        <div className="px-2 py-1.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[10px] text-[var(--accent)]">
                          <span className="font-medium">Suggested fix:</span>{" "}
                          {step.suggestedCorrection}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Patterns */}
          {result.patterns.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-[var(--muted-foreground)]">
                Detected Patterns
              </div>
              {result.patterns.map((pattern, i) => (
                <div key={i} className="px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[10px]">
                  <div className="font-medium text-[var(--foreground)]">{pattern.name}</div>
                  <div className="text-[var(--muted-foreground)]">{pattern.description}</div>
                  {pattern.affectedSteps.length > 0 && (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <span className="text-[var(--muted-foreground)]">Steps:</span>
                      {pattern.affectedSteps.map((stepIdx) => (
                        <button
                          key={stepIdx}
                          onClick={() => setExpandedStep(expandedStep === stepIdx ? null : stepIdx)}
                          className="px-1.5 py-0.5 rounded bg-[var(--muted)]/50 text-[var(--foreground)] hover:bg-[var(--accent)]/20 transition-colors cursor-pointer"
                        >
                          {stepIdx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
