"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { TourStep } from "@/lib/hooks/use-tour";

interface DemoTourProps {
  isActive: boolean;
  currentStep: TourStep | null;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function DemoTour({
  isActive,
  currentStep,
  currentIndex,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
}: DemoTourProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePositions = useCallback(() => {
    if (!currentStep) return;

    const target = document.querySelector(currentStep.target);
    if (!target) {
      // If target not found, show tooltip centered
      setSpotlight(null);
      setTooltipStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 8;

    setSpotlight({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Position tooltip based on placement
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (currentStep.placement) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
    }

    // Clamp to viewport
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));

    setTooltipStyle({ top, left, width: tooltipWidth });
  }, [currentStep]);

  useEffect(() => {
    if (!isActive || !currentStep) return;

    // Small delay to let DOM settle
    const timeout = setTimeout(updatePositions, 100);

    window.addEventListener("resize", updatePositions);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updatePositions);
    };
  }, [isActive, currentStep, updatePositions]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      else if (e.key === "ArrowLeft") onPrevious();
      else if (e.key === "Escape") onSkip();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onNext, onPrevious, onSkip]);

  if (!isActive || !currentStep) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay with spotlight cutout */}
      <div className="absolute inset-0 pointer-events-none">
        {spotlight ? (
          <div
            className="absolute rounded-lg transition-all duration-300 ease-out"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-black/75" />
        )}
      </div>

      {/* Click-through backdrop (dismiss on click outside tooltip) */}
      <div className="absolute inset-0" onClick={onNext} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-10 animate-fade-in-up"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-5">
          {/* Progress bar */}
          <div className="flex items-center gap-1 mb-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= currentIndex
                    ? "bg-gradient-to-r from-blue-500 to-violet-500"
                    : "bg-[var(--border)]"
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1.5">
            {currentStep.title}
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed mb-4">
            {currentStep.description}
          </p>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={onSkip}
              className="text-xs text-[var(--muted)] hover:text-[var(--muted-foreground)] transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--muted)]">
                {currentIndex + 1} / {totalSteps}
              </span>

              {currentIndex > 0 && (
                <button
                  onClick={onPrevious}
                  className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-[var(--foreground)]" />
                </button>
              )}

              <button
                onClick={onNext}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                {currentIndex === totalSteps - 1 ? "Done" : "Next"}
                {currentIndex < totalSteps - 1 && (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
