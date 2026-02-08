"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { Maximize, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface GraphControlsProps {
  onReset?: () => void;
}

export function GraphControls({ onReset }: GraphControlsProps) {
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();

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
    <div className="absolute bottom-4 left-4 z-10 flex items-center rounded-full bg-[var(--card)]/90 backdrop-blur-sm border border-[var(--border)] shadow-lg overflow-hidden">
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
  );
}
