/**
 * Color utilities for the Opus Nx dashboard.
 * Centralized color system for confidence scores, edge types, and fork styles.
 */

// ============================================================
// Confidence Score Colors
// ============================================================

/**
 * Get color for a confidence score.
 * Red (low) → Yellow (medium) → Green (high)
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence < 0.3) return "#ef4444"; // red-500
  if (confidence < 0.5) return "#f97316"; // orange-500
  if (confidence < 0.7) return "#eab308"; // yellow-500
  if (confidence < 0.85) return "#22c55e"; // green-500
  return "#10b981"; // emerald-500
}

/**
 * Get Tailwind class for confidence background.
 */
export function getConfidenceBgClass(confidence: number): string {
  if (confidence < 0.3) return "bg-red-500/10";
  if (confidence < 0.5) return "bg-orange-500/10";
  if (confidence < 0.7) return "bg-yellow-500/10";
  if (confidence < 0.85) return "bg-green-500/10";
  return "bg-emerald-500/10";
}

/**
 * Get Tailwind class for confidence text.
 */
export function getConfidenceTextClass(confidence: number): string {
  if (confidence < 0.3) return "text-red-500";
  if (confidence < 0.5) return "text-orange-500";
  if (confidence < 0.7) return "text-yellow-500";
  if (confidence < 0.85) return "text-green-500";
  return "text-emerald-500";
}

// ============================================================
// Edge Type Colors
// ============================================================

export type EdgeType =
  | "influences"
  | "contradicts"
  | "supports"
  | "supersedes"
  | "refines";

export const EDGE_COLORS: Record<EdgeType, string> = {
  influences: "#3b82f6", // blue-500
  contradicts: "#ef4444", // red-500
  supports: "#22c55e", // green-500
  supersedes: "#f97316", // orange-500
  refines: "#8b5cf6", // violet-500
};

export const EDGE_LABELS: Record<EdgeType, string> = {
  influences: "Influences",
  contradicts: "Contradicts",
  supports: "Supports",
  supersedes: "Supersedes",
  refines: "Refines",
};

export const EDGE_ICONS: Record<EdgeType, string> = {
  influences: "→",
  contradicts: "⚡",
  supports: "✓",
  supersedes: "↑",
  refines: "◇",
};

/**
 * Get Tailwind class for edge type.
 */
export function getEdgeClass(edgeType: EdgeType): string {
  const classes: Record<EdgeType, string> = {
    influences: "stroke-blue-500",
    contradicts: "stroke-red-500",
    supports: "stroke-green-500",
    supersedes: "stroke-orange-500",
    refines: "stroke-violet-500",
  };
  return classes[edgeType];
}

// ============================================================
// Fork Style Colors
// ============================================================

export type ForkStyle = "conservative" | "aggressive" | "balanced" | "contrarian";

export const FORK_COLORS: Record<ForkStyle, string> = {
  conservative: "#64748b", // slate-500
  aggressive: "#ef4444", // red-500
  balanced: "#3b82f6", // blue-500
  contrarian: "#8b5cf6", // violet-500
};

export const FORK_ICONS: Record<ForkStyle, string> = {
  conservative: "🛡️",
  aggressive: "🚀",
  balanced: "⚖️",
  contrarian: "🔄",
};

export const FORK_LABELS: Record<ForkStyle, string> = {
  conservative: "Conservative",
  aggressive: "Aggressive",
  balanced: "Balanced",
  contrarian: "Contrarian",
};

export const FORK_DESCRIPTIONS: Record<ForkStyle, string> = {
  conservative: "Minimize risk, prefer proven approaches",
  aggressive: "Push boundaries, explore edge cases",
  balanced: "Tradeoff-aware, pragmatic approach",
  contrarian: "Challenge assumptions, question consensus",
};

/**
 * Get Tailwind classes for fork style card.
 */
export function getForkStyleClasses(style: ForkStyle): {
  border: string;
  bg: string;
  text: string;
} {
  const classes: Record<ForkStyle, { border: string; bg: string; text: string }> = {
    conservative: {
      border: "border-slate-500",
      bg: "bg-slate-500/10",
      text: "text-slate-500",
    },
    aggressive: {
      border: "border-red-500",
      bg: "bg-red-500/10",
      text: "text-red-500",
    },
    balanced: {
      border: "border-blue-500",
      bg: "bg-blue-500/10",
      text: "text-blue-500",
    },
    contrarian: {
      border: "border-violet-500",
      bg: "bg-violet-500/10",
      text: "text-violet-500",
    },
  };
  return classes[style];
}

// ============================================================
// Insight Type Colors
// ============================================================

export type InsightType = "bias_detection" | "pattern" | "improvement_hypothesis";

export const INSIGHT_COLORS: Record<InsightType, string> = {
  bias_detection: "#f59e0b", // amber-500
  pattern: "#06b6d4", // cyan-500
  improvement_hypothesis: "#10b981", // emerald-500
};

export const INSIGHT_ICONS: Record<InsightType, string> = {
  bias_detection: "⚠️",
  pattern: "🔍",
  improvement_hypothesis: "💡",
};

export const INSIGHT_LABELS: Record<InsightType, string> = {
  bias_detection: "Bias Detected",
  pattern: "Pattern Found",
  improvement_hypothesis: "Improvement",
};
