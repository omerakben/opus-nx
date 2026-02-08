"use client";

import { useState } from "react";
import { EDGE_COLORS, EDGE_LABELS, type EdgeType } from "@/lib/colors";
import { ChevronDown, ChevronUp } from "lucide-react";

const edgeTypes: EdgeType[] = [
  "influences",
  "supports",
  "refines",
  "supersedes",
  "contradicts",
];

function EdgeMiniLine({ type }: { type: EdgeType }) {
  const color = EDGE_COLORS[type];
  const isDashed = type === "contradicts";
  return (
    <svg width="24" height="8" viewBox="0 0 24 8" className="shrink-0">
      <line
        x1="0"
        y1="4"
        x2="24"
        y2="4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={isDashed ? "4 3" : "none"}
      />
    </svg>
  );
}

export function GraphLegend() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="absolute bottom-14 left-4 z-10" data-tour="graph-legend">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        aria-controls="graph-legend-content"
        className="flex items-center gap-1.5 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-sm shadow-sm hover:bg-[var(--muted)] transition-colors"
      >
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          Edges
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)]/50 text-[var(--muted-foreground)]">
          {edgeTypes.length}
        </span>
        {isCollapsed ? (
          <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronUp className="w-3 h-3 text-[var(--muted-foreground)]" />
        )}
      </button>
      <div
        id="graph-legend-content"
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: isCollapsed ? 0 : 200, opacity: isCollapsed ? 0 : 1 }}
      >
        <div className="mt-1 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-sm shadow-sm">
          <div className="space-y-1.5">
            {edgeTypes.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <EdgeMiniLine type={type} />
                <span className="text-[11px] text-[var(--foreground)]">
                  {EDGE_LABELS[type]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
