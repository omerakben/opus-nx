"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Filter, Maximize, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { EDGE_COLORS, EDGE_LABELS, type EdgeType } from "@/lib/colors";

const EDGE_TYPES: EdgeType[] = [
  "influences",
  "contradicts",
  "supports",
  "supersedes",
  "refines",
  "challenges",
  "verifies",
  "merges",
  "observes",
];

interface GraphControlsProps {
  onReset?: () => void;
  activeEdgeTypes?: Set<string>;
  onEdgeFilterChange?: (edgeType: string) => void;
  confidenceThreshold?: number;
  onConfidenceFilterChange?: (value: number) => void;
}

export function GraphControls({
  onReset,
  activeEdgeTypes,
  onEdgeFilterChange,
  confidenceThreshold = 0,
  onConfidenceFilterChange,
}: GraphControlsProps) {
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 500 });
  }, [fitView]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
  }, [zoomOut]);

  const handleReset = useCallback(() => {
    setCenter(0, 0, { zoom: 1, duration: 500 });
    onReset?.();
  }, [setCenter, onReset]);

  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 items-start">
      {/* Filter panel (collapsible) */}
      {isFilterOpen && (
        <div className="p-3 rounded-lg bg-[var(--card)]/90 backdrop-blur-sm border border-[var(--border)] shadow-lg">
          {/* Edge type toggles */}
          <div className="text-[10px] font-medium text-[var(--muted-foreground)] mb-2">
            Edge Types
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {EDGE_TYPES.map((type) => {
              const isActive = activeEdgeTypes ? activeEdgeTypes.has(type) : true;
              return (
                <button
                  key={type}
                  onClick={() => onEdgeFilterChange?.(type)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border transition-colors ${
                    isActive
                      ? "bg-[var(--muted)] border-[var(--border)] text-[var(--foreground)]"
                      : "bg-transparent border-transparent text-[var(--muted-foreground)] opacity-50"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: EDGE_COLORS[type] }}
                  />
                  {EDGE_LABELS[type]}
                </button>
              );
            })}
          </div>

          {/* Confidence slider */}
          <div className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1.5">
            Min Confidence: {confidenceThreshold}%
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={confidenceThreshold}
            onChange={(e) =>
              onConfidenceFilterChange?.(Number(e.target.value))
            }
            className="w-full h-1 rounded-full appearance-none bg-[var(--border)] accent-violet-500"
          />
        </div>
      )}

      {/* Zoom controls + filter toggle */}
      <div className="flex items-center rounded-full bg-[var(--card)]/90 backdrop-blur-sm border border-[var(--border)] shadow-lg overflow-hidden">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          title="Toggle filters"
          className={`h-8 w-8 flex items-center justify-center transition-colors ${
            isFilterOpen
              ? "bg-violet-500/20 text-violet-400"
              : "hover:bg-[var(--muted)]"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-[var(--border)]" />
        <button
          onClick={handleZoomIn}
          title="Zoom in"
          className="h-8 w-8 flex items-center justify-center hover:bg-[var(--muted)] transition-colors"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-[var(--border)]" />
        <button
          onClick={handleZoomOut}
          title="Zoom out"
          className="h-8 w-8 flex items-center justify-center hover:bg-[var(--muted)] transition-colors"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-[var(--border)]" />
        <button
          onClick={handleFitView}
          title="Fit to view"
          className="h-8 w-8 flex items-center justify-center hover:bg-[var(--muted)] transition-colors"
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-[var(--border)]" />
        <button
          onClick={handleReset}
          title="Reset view"
          className="h-8 w-8 flex items-center justify-center hover:bg-[var(--muted)] transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
