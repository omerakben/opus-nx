"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, Badge } from "@/components/ui";
import { FORK_COLORS, FORK_LABELS, type ForkStyle } from "@/lib/colors";
import type { ForkResponse } from "@/lib/api";
import { CheckCircle, XCircle, ChevronRight, Sparkles } from "lucide-react";

interface ConvergenceProps {
  convergence: ForkResponse["convergencePoints"];
  divergence: ForkResponse["divergencePoints"];
  onSelectAssumption?: (topic: string, style: string, position: string) => void;
}

/**
 * Convergence/Divergence Display
 *
 * This is THE key feature for the hackathon demo.
 * Shows where independent reasoning paths agree (convergence)
 * and disagree (divergence), allowing users to select which
 * assumption they want to proceed with.
 */
export function Convergence({ convergence, divergence, onSelectAssumption }: ConvergenceProps) {
  const [selectedAssumptions, setSelectedAssumptions] = useState<Record<string, string>>({});

  const handleSelectAssumption = (topic: string, style: string, position: string) => {
    setSelectedAssumptions((prev) => ({ ...prev, [topic]: style }));
    onSelectAssumption?.(topic, style, position);
  };

  return (
    <div className="space-y-4">
      {/* Convergence points - where all paths agree */}
      {convergence.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-green-400 mb-2">
            <CheckCircle className="w-3.5 h-3.5" />
            Convergence ({convergence.length})
            <span className="text-[10px] text-[var(--muted-foreground)] ml-1">
              — paths agree
            </span>
          </div>
          <div className="space-y-2">
            {convergence.map((point, i) => (
              <Card key={i} className="border-l-2 border-green-500 bg-green-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium text-[var(--foreground)]">
                      {point.topic}
                    </span>
                    <Badge
                      variant={
                        point.agreementLevel === "full"
                          ? "success"
                          : point.agreementLevel === "partial"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[9px] px-1.5 py-0"
                    >
                      {point.agreementLevel === "full" ? "Full agreement" :
                       point.agreementLevel === "partial" ? "Partial" : "Minimal"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[var(--foreground)] leading-relaxed">
                    {point.summary}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    {point.styles.map((style) => (
                      <span
                        key={style}
                        className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${FORK_COLORS[style as ForkStyle]}20`,
                          color: FORK_COLORS[style as ForkStyle],
                        }}
                      >
                        {FORK_LABELS[style as ForkStyle]}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Divergence points - where paths disagree - THE KEY INTERACTION */}
      {divergence.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-red-400 mb-2">
            <XCircle className="w-3.5 h-3.5" />
            Divergence ({divergence.length})
            <span className="text-[10px] text-[var(--muted-foreground)] ml-1">
              — select your preferred assumption
            </span>
          </div>
          <div className="space-y-3">
            {divergence.map((point, i) => (
              <Card
                key={i}
                className={cn(
                  "border-l-2 overflow-hidden transition-all",
                  selectedAssumptions[point.topic]
                    ? "border-cyan-500 bg-cyan-500/5"
                    : "border-red-500 bg-red-500/5"
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-[var(--foreground)]">
                      {point.topic}
                    </span>
                    <Badge
                      variant={
                        point.significance === "high"
                          ? "destructive"
                          : point.significance === "medium"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[9px] px-1.5 py-0"
                    >
                      {point.significance} impact
                    </Badge>
                    {selectedAssumptions[point.topic] && (
                      <Badge variant="default" className="text-[9px] px-1.5 py-0 ml-auto bg-cyan-500">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                        Selected
                      </Badge>
                    )}
                  </div>

                  {/* Position cards - selectable */}
                  <div className="space-y-2">
                    {point.positions.map((pos, j) => {
                      const isSelected = selectedAssumptions[point.topic] === pos.style;
                      return (
                        <button
                          key={j}
                          type="button"
                          onClick={() => handleSelectAssumption(point.topic, pos.style, pos.position)}
                          className={cn(
                            "w-full text-left p-2 rounded-lg border transition-all",
                            isSelected
                              ? "border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/50"
                              : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]/30"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                              style={{
                                backgroundColor: FORK_COLORS[pos.style as ForkStyle],
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-medium" style={{ color: FORK_COLORS[pos.style as ForkStyle] }}>
                                  {FORK_LABELS[pos.style as ForkStyle]}
                                </span>
                                <span className="text-[9px] text-[var(--muted-foreground)]">
                                  {Math.round(pos.confidence * 100)}% confident
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--foreground)] leading-relaxed">
                                {pos.position}
                              </p>
                            </div>
                            <ChevronRight
                              className={cn(
                                "w-4 h-4 flex-shrink-0 transition-transform",
                                isSelected ? "text-cyan-400 rotate-90" : "text-[var(--muted-foreground)]"
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected feedback */}
                  {selectedAssumptions[point.topic] && (
                    <div className="mt-2 pt-2 border-t border-[var(--border)]">
                      <p className="text-[10px] text-cyan-400">
                        You&apos;ve selected the {FORK_LABELS[selectedAssumptions[point.topic] as ForkStyle]} assumption for this divergence point.
                        This will guide subsequent reasoning.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Summary when selections are made */}
      {Object.keys(selectedAssumptions).length > 0 && (
        <Card className="bg-cyan-500/10 border-cyan-500/30">
          <CardContent className="p-3">
            <div className="text-xs text-cyan-400 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Your Assumption Choices
            </div>
            <div className="space-y-1">
              {Object.entries(selectedAssumptions).map(([topic, style]) => (
                <div key={topic} className="text-[11px] text-[var(--foreground)] flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: FORK_COLORS[style as ForkStyle] }}
                  />
                  <span className="text-[var(--muted-foreground)]">{topic}:</span>
                  <span className="font-medium">{FORK_LABELS[style as ForkStyle]}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-[var(--muted-foreground)] mt-2">
              These selections represent your preferred assumptions. Use them to guide further analysis or re-reason with these constraints.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {convergence.length === 0 && divergence.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            No convergence or divergence points detected yet.
            Run an analysis to see where reasoning paths agree and disagree.
          </p>
        </div>
      )}
    </div>
  );
}
