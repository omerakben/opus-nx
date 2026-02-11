"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const NODE_STATES = [
  { label: "Verified", color: "#10b981", bg: "bg-emerald-500/15" },
  { label: "Rejected", color: "#ef4444", bg: "bg-red-500/15" },
  { label: "Aggregated", color: "#ec4899", bg: "bg-pink-500/15" },
  { label: "Generated", color: "#3b82f6", bg: "bg-blue-500/15" },
];

const EDGE_TYPES = [
  { label: "Influences", color: "#3b82f6", dashed: false },
  { label: "Supports", color: "#ec4899", dashed: false },
  { label: "Best Path", color: "#f59e0b", dashed: false },
];

export function GoTLegend() {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="absolute top-4 left-4 z-10">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
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
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: isCollapsed ? 0 : 300, opacity: isCollapsed ? 0 : 1 }}
      >
        <div className="mt-1 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-sm shadow-sm min-w-[140px]">
          {/* Node States */}
          <div className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1.5">Thought States</div>
          <div className="space-y-1">
            {NODE_STATES.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-[11px] text-[var(--foreground)]">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Edge Types */}
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <div className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1.5">Edge Types</div>
            <div className="space-y-1">
              {EDGE_TYPES.map((e) => (
                <div key={e.label} className="flex items-center gap-2">
                  <svg width="20" height="6" viewBox="0 0 20 6" className="shrink-0">
                    <line
                      x1="0" y1="3" x2="20" y2="3"
                      stroke={e.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={e.dashed ? "4 3" : "none"}
                    />
                  </svg>
                  <span className="text-[11px] text-[var(--foreground)]">{e.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
