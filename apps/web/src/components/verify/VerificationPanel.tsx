"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getConfidenceColor, getConfidenceTextClass } from "@/lib/colors";
import { Badge, Button, Card, CardContent, Skeleton } from "@/components/ui";

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

export function VerificationPanel({ sessionId: _sessionId, initialSteps }: VerificationPanelProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const handleVerify = useCallback(async (steps: Array<{ content: string; type?: string }>) => {
    if (isVerifying || steps.length === 0) return;
    setIsVerifying(true);
    setError(null);

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
        const data = await res.json();
        throw new Error(data.error?.message || "Verification failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying]);

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

      {/* Verify Button */}
      {initialSteps && initialSteps.length > 0 && !result && (
        <Button
          onClick={() => handleVerify(initialSteps)}
          disabled={isVerifying}
          className="w-full text-sm"
        >
          {isVerifying ? (
            <span className="flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              Verifying {initialSteps.length} steps...
            </span>
          ) : (
            `Verify ${initialSteps.length} Reasoning Steps`
          )}
        </Button>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Loading */}
      {isVerifying && (
        <div className="space-y-2">
          {(initialSteps ?? []).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3 animate-fade-in">
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
