"use client";

import { useState } from "react";
import { EDGE_COLORS, EDGE_LABELS, EDGE_ICONS, type EdgeType } from "@/lib/colors";
import { ChevronDown, ChevronUp } from "lucide-react";

const edgeTypes: EdgeType[] = [
  "influences",
  "supports",
  "refines",
  "supersedes",
  "contradicts",
];

export function GraphLegend() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-1.5 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm shadow-sm hover:bg-[var(--muted)] transition-colors"
      >
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          Edge Types
        </span>
        {isCollapsed ? (
          <ChevronUp className="w-3 h-3 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)]" />
        )}
      </button>
      {!isCollapsed && (
        <div className="mt-1 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm shadow-sm">
          <div className="space-y-1.5">
            {edgeTypes.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-6 h-0.5 rounded-full"
                  style={{ backgroundColor: EDGE_COLORS[type] }}
                />
                <span className="text-[11px] text-[var(--foreground)]">
                  {EDGE_ICONS[type]} {EDGE_LABELS[type]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
