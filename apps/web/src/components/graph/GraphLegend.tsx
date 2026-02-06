"use client";

import { EDGE_COLORS, EDGE_LABELS, EDGE_ICONS, type EdgeType } from "@/lib/colors";

const edgeTypes: EdgeType[] = [
  "influences",
  "supports",
  "refines",
  "supersedes",
  "contradicts",
];

export function GraphLegend() {
  return (
    <div className="absolute top-4 right-4 z-10 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm">
      <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
        Edge Types
      </h4>
      <div className="space-y-1.5">
        {edgeTypes.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-8 h-0.5 rounded-full"
              style={{
                backgroundColor: EDGE_COLORS[type],
                opacity: type === "contradicts" ? 0.7 : 1,
              }}
            />
            <span className="text-xs text-[var(--foreground)]">
              {EDGE_ICONS[type]} {EDGE_LABELS[type]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
