"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui";
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
    <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
      <Button
        variant="outline"
        size="icon"
        onClick={handleZoomIn}
        title="Zoom in"
        className="h-8 w-8 bg-[var(--card)]"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleZoomOut}
        title="Zoom out"
        className="h-8 w-8 bg-[var(--card)]"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleFitView}
        title="Fit to view"
        className="h-8 w-8 bg-[var(--card)]"
      >
        <Maximize className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleReset}
        title="Reset view"
        className="h-8 w-8 bg-[var(--card)]"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
