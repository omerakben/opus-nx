"use client";

import { useState, useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, Badge } from "@/components/ui";
import { FORK_COLORS, FORK_LABELS, type ForkStyle } from "@/lib/colors";
import type { ForkResponse } from "@/lib/api";
import { CheckCircle, XCircle, Circle, CheckCircle2, Sparkles, RotateCcw, Lightbulb, Check } from "lucide-react";

interface ConvergenceProps {
  convergence: ForkResponse["convergencePoints"];
  divergence: ForkResponse["divergencePoints"];
  onSelectAssumption?: (topic: string, style: string, position: string) => void;
  onReAnalyze?: (assumptions: Record<string, string>) => void;
}

/**
 * Convergence/Divergence Display
 *
 * This is THE key feature for the hackathon demo.
 * Shows where independent reasoning paths agree (convergence)
 * and disagree (divergence), allowing users to select which
 * assumption they want to proceed with.
 */
export function Convergence({ convergence, divergence, onSelectAssumption, onReAnalyze }: ConvergenceProps) {
  const [selectedAssumptions, setSelectedAssumptions] = useState<Record<string, { style: string; position: string }>>({});

  const handleSelectAssumption = (topic: string, style: string, position: string) => {
    setSelectedAssumptions((prev) => ({ ...prev, [topic]: { style, position } }));
    onSelectAssumption?.(topic, style, position);
  };

  const handleClearSelections = useCallback(() => {
    setSelectedAssumptions({});
  }, []);

  const handleArrowNav = useCallback((e: KeyboardEvent<HTMLButtonElement>, containerRef: HTMLDivElement | null) => {
    if (!containerRef) return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

    e.preventDefault();
    const buttons = Array.from(containerRef.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const currentIndex = buttons.indexOf(e.currentTarget);
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (e.key === "ArrowDown") {
      nextIndex = currentIndex + 1 < buttons.length ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : buttons.length - 1;
    }
    buttons[nextIndex]?.focus();
  }, []);

  const hasSelections = Object.keys(selectedAssumptions).length > 0;

  /** Build the flat style map for onReAnalyze (preserving the original callback signature) */
  const flatAssumptions = useMemo(() => {
    const flat: Record<string, string> = {};
    for (const [topic, { style }] of Object.entries(selectedAssumptions)) {
      flat[topic] = style;
    }
    return flat;
  }, [selectedAssumptions]);

  return (
    <div className="space-y-4">
      {/* Convergence points - where all paths agree */}
      {convergence.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-green-400 mb-2">
            <CheckCircle className="w-3.5 h-3.5" />
            Convergence ({convergence.length})
            <span className="text-[11px] text-[var(--muted-foreground)] ml-1">
              — paths agree
            </span>
          </div>
          <div className="space-y-2">
            {convergence.map((point, i) => (
              <Card
                key={i}
                className={cn(
                  "overflow-hidden relative",
                  point.agreementLevel === "full"
                    ? "border-l-4 border-green-500 bg-green-500/8"
                    : point.agreementLevel === "partial"
                    ? "border-l-2 border-green-400 bg-green-500/5"
                    : "border-l bg-green-500/3",
                  point.agreementLevel === "none" && "border-dashed border-green-300/50"
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    {/* Full agreement checkmark accent */}
                    {point.agreementLevel === "full" && (
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    )}
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
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        point.agreementLevel === "full" && "ring-1 ring-green-500/30"
                      )}
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
                        className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
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
        <div id="divergence-details">
          <div className="flex items-center gap-1.5 text-xs text-red-400 mb-2">
            <XCircle className="w-3.5 h-3.5" />
            Divergence ({divergence.length})
            <span className="text-[11px] text-[var(--muted-foreground)] ml-1">
              — select your preferred assumption
            </span>
          </div>
          <div className="space-y-3">
            {divergence.map((point, i) => {
              const isHigh = point.significance === "high";
              const isMedium = point.significance === "medium";

              return (
                <DivergenceCard
                  key={i}
                  point={point}
                  isHigh={isHigh}
                  isMedium={isMedium}
                  selectedStyle={selectedAssumptions[point.topic]?.style}
                  onSelect={handleSelectAssumption}
                  onArrowNav={handleArrowNav}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Summary when selections are made */}
      {hasSelections && (
        <Card className="bg-cyan-500/10 border-cyan-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-cyan-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Your Assumption Choices
              </div>
              <button
                type="button"
                onClick={handleClearSelections}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Clear selections
              </button>
            </div>
            <div className="space-y-1.5">
              {Object.entries(selectedAssumptions).map(([topic, { style, position }]) => (
                <div key={topic} className="text-[11px] text-[var(--foreground)]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: FORK_COLORS[style as ForkStyle] }}
                    />
                    <span className="text-[var(--muted-foreground)]">{topic}:</span>
                    <span className="font-medium" style={{ color: FORK_COLORS[style as ForkStyle] }}>
                      {FORK_LABELS[style as ForkStyle]}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--muted-foreground)] ml-4 mt-0.5 line-clamp-2 leading-relaxed">
                    {position}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-2">
              These selections represent your preferred assumptions. Use them to guide further analysis or re-reason with these constraints.
            </p>
            {onReAnalyze && (
              <button
                type="button"
                disabled={!hasSelections}
                onClick={() => onReAnalyze(flatAssumptions)}
                className={cn(
                  "w-full mt-3 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-xs font-medium",
                  "hover:from-violet-500 hover:to-cyan-500 transition-all flex items-center justify-center gap-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Re-analyze with these assumptions
              </button>
            )}
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

/**
 * Extracted DivergenceCard to hold a ref for keyboard navigation within each card.
 */
function DivergenceCard({
  point,
  isHigh,
  isMedium,
  selectedStyle,
  onSelect,
  onArrowNav,
}: {
  point: ForkResponse["divergencePoints"][number];
  isHigh: boolean;
  isMedium: boolean;
  selectedStyle: string | undefined;
  onSelect: (topic: string, style: string, position: string) => void;
  onArrowNav: (e: KeyboardEvent<HTMLButtonElement>, container: HTMLDivElement | null) => void;
}) {
  const radioGroupRef = useRef<HTMLDivElement>(null);

  /** Resolve the border color for the selected state to the branch's own color */
  const selectedBorderColor = selectedStyle
    ? FORK_COLORS[selectedStyle as ForkStyle]
    : undefined;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        !selectedStyle && (
          isHigh
            ? "border-red-500 bg-red-500/8"
            : isMedium
            ? "border-red-500 bg-red-500/5"
            : "border-red-500 bg-red-500/3"
        ),
        isHigh ? "border-l-4" : isMedium ? "border-l-2" : "border-l"
      )}
      style={
        selectedStyle
          ? {
              borderColor: `${selectedBorderColor}80`,
              backgroundColor: `${selectedBorderColor}08`,
            }
          : undefined
      }
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              "font-medium text-[var(--foreground)]",
              isHigh ? "text-sm" : "text-xs"
            )}
          >
            {point.topic}
          </span>
          <Badge
            variant={
              isHigh
                ? "destructive"
                : isMedium
                ? "warning"
                : "secondary"
            }
            className="text-[10px] px-1.5 py-0"
          >
            {point.significance} impact
          </Badge>
          {selectedStyle && (
            <Badge
              variant="default"
              className="text-[10px] px-1.5 py-0 ml-auto text-white"
              style={{ backgroundColor: FORK_COLORS[selectedStyle as ForkStyle] }}
            >
              <Sparkles className="w-2.5 h-2.5 mr-0.5" />
              Selected
            </Badge>
          )}
        </div>

        {/* Position cards - selectable radio group */}
        <div
          ref={radioGroupRef}
          role="radiogroup"
          aria-label={`Select preferred assumption for ${point.topic}`}
          className="space-y-2"
        >
          {point.positions.map((pos, j) => {
            const isSelected = selectedStyle === pos.style;
            const branchColor = FORK_COLORS[pos.style as ForkStyle];
            return (
              <button
                key={j}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelect(point.topic, pos.style, pos.position)}
                onKeyDown={(e) => onArrowNav(e, radioGroupRef.current)}
                className={cn(
                  "w-full text-left p-2 rounded-lg border transition-all",
                  !isSelected && "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]/30"
                )}
                style={
                  isSelected
                    ? {
                        borderColor: branchColor,
                        backgroundColor: `${branchColor}15`,
                        boxShadow: `0 0 0 1px ${branchColor}50`,
                      }
                    : undefined
                }
              >
                <div className="flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 transition-transform"
                    style={{
                      backgroundColor: branchColor,
                      ...(isSelected
                        ? {
                            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 1",
                            boxShadow: `0 0 6px 2px ${branchColor}60`,
                          }
                        : {}),
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-medium" style={{ color: branchColor }}>
                        {FORK_LABELS[pos.style as ForkStyle]}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {Math.round(pos.confidence * 100)}% confident
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--foreground)] leading-relaxed">
                      {pos.position}
                    </p>
                  </div>
                  <div className="flex-shrink-0 transition-all duration-200">
                    {isSelected ? (
                      <CheckCircle2
                        className="w-4 h-4 scale-110"
                        style={{ color: branchColor }}
                      />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--muted-foreground)]" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* AI recommendation hint */}
        {point.recommendation && (
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <div className="flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-[var(--muted-foreground)] leading-relaxed italic">
                AI suggests: {point.recommendation}
              </p>
            </div>
          </div>
        )}

        {/* Selected feedback */}
        {selectedStyle && (
          <div className={cn(
            "mt-2 pt-2 border-t border-[var(--border)]",
            point.recommendation && "mt-1.5 pt-1.5"
          )}>
            <p className="text-[11px] flex items-center gap-1.5" style={{ color: FORK_COLORS[selectedStyle as ForkStyle] }}>
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: FORK_COLORS[selectedStyle as ForkStyle] }}
              />
              You&apos;ve selected the {FORK_LABELS[selectedStyle as ForkStyle]} assumption for this divergence point.
              This will guide subsequent reasoning.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
