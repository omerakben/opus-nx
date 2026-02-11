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
  "challenges",
  "verifies",
  "merges",
  "observes",
];

function EdgeMiniLine({ type }: { type: EdgeType }) {
  const color = EDGE_COLORS[type];
  const dashArray =
    type === "contradicts"
      ? "4 3"
      : type === "challenges"
        ? "6 2"
        : "none";
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
        strokeDasharray={dashArray}
      />
    </svg>
  );
}

export function GraphLegend() {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="absolute top-4 left-4 z-10" data-tour="graph-legend">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        aria-controls="graph-legend-content"
        className="flex items-center gap-1.5 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-sm shadow-sm hover:bg-[var(--muted)] transition-colors"
      >
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          Legend
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
        style={{ maxHeight: isCollapsed ? 0 : 400, opacity: isCollapsed ? 0 : 1 }}
      >
        <div className="mt-1 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-sm shadow-sm">
          <div className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1.5">Edge Types</div>
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

          {/* Node Types Section */}
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <div className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1.5">Node Types</div>
            <div className="space-y-1.5">
              {[
                { label: "Thinking", borderColor: "var(--border)", dashed: false },
                { label: "Compaction", borderColor: "#f59e0b", dashed: true },
                { label: "Human Note", borderColor: "#06b6d4", dashed: false },
                { label: "Fork Branch", borderColor: "#8b5cf6", dashed: false },
              ].map((node) => (
                <div key={node.label} className="flex items-center gap-2">
                  <div
                    className="w-5 h-3.5 rounded-sm border-2 shrink-0"
                    style={{
                      borderColor: node.borderColor,
                      borderStyle: node.dashed ? "dashed" : "solid",
                    }}
                  />
                  <span className="text-[11px] text-[var(--foreground)]">
                    {node.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
