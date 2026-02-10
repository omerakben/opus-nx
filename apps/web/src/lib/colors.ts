/**
 * Color utilities for the Opus Nx dashboard.
 * Centralized color system for confidence scores, edge types, and fork styles.
 */

import { AlertTriangle, Search, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  | "refines"
  | "challenges"
  | "verifies"
  | "merges"
  | "observes";

export const EDGE_COLORS: Record<EdgeType, string> = {
  influences: "#3b82f6", // blue-500
  contradicts: "#ef4444", // red-500
  supports: "#22c55e", // green-500
  supersedes: "#f97316", // orange-500
  refines: "#8b5cf6", // violet-500
  challenges: "#f59e0b", // amber-500
  verifies: "#06b6d4", // cyan-500
  merges: "#ec4899", // pink-500
  observes: "#6366f1", // indigo-500
};

export const EDGE_LABELS: Record<EdgeType, string> = {
  influences: "Influences",
  contradicts: "Contradicts",
  supports: "Supports",
  supersedes: "Supersedes",
  refines: "Refines",
  challenges: "Challenges",
  verifies: "Verifies",
  merges: "Merges",
  observes: "Observes",
};

export const EDGE_ICONS: Record<EdgeType, string> = {
  influences: "→",
  contradicts: "⚡",
  supports: "✓",
  supersedes: "↑",
  refines: "◇",
  challenges: "⚔",
  verifies: "✔",
  merges: "∪",
  observes: "👁",
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
    challenges: "stroke-amber-500",
    verifies: "stroke-cyan-500",
    merges: "stroke-pink-500",
    observes: "stroke-indigo-500",
  };
  return classes[edgeType];
}

// ============================================================
// Fork Style Colors (De-gimmicked: Path-based, not persona-based)
// ============================================================

/**
 * Fork styles now represent independent reasoning paths, not personas.
 * The API still uses these identifiers, but UI displays neutral labels.
 */
export type ForkStyle = "conservative" | "aggressive" | "balanced" | "contrarian";

/**
 * Map internal style names to neutral path identifiers.
 * Only 3 paths are used in the de-gimmicked UI.
 */
export const FORK_PATH_MAP: Record<ForkStyle, { pathId: string; index: number }> = {
  conservative: { pathId: "A", index: 0 },
  aggressive: { pathId: "B", index: 1 },
  balanced: { pathId: "C", index: 2 },
  contrarian: { pathId: "D", index: 3 }, // Excluded in 3-path mode
};

export const FORK_COLORS: Record<ForkStyle, string> = {
  conservative: "#3b82f6", // blue-500
  aggressive: "#8b5cf6", // violet-500
  balanced: "#06b6d4", // cyan-500
  contrarian: "#f59e0b", // amber-500
};

/**
 * Path-based icons (neutral, no personas)
 */
export const FORK_ICONS: Record<ForkStyle, string> = {
  conservative: "α",
  aggressive: "β",
  balanced: "γ",
  contrarian: "δ",
};

/**
 * Neutral path labels
 */
export const FORK_LABELS: Record<ForkStyle, string> = {
  conservative: "Path A",
  aggressive: "Path B",
  balanced: "Path C",
  contrarian: "Path D",
};

/**
 * Assumption-focused descriptions (not persona descriptions)
 */
export const FORK_DESCRIPTIONS: Record<ForkStyle, string> = {
  conservative: "Independent reasoning attempt with baseline assumptions",
  aggressive: "Independent reasoning attempt with alternative assumptions",
  balanced: "Independent reasoning attempt with hybrid assumptions",
  contrarian: "Independent reasoning attempt with inverted assumptions",
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
      border: "border-blue-500",
      bg: "bg-blue-500/10",
      text: "text-blue-500",
    },
    aggressive: {
      border: "border-violet-500",
      bg: "bg-violet-500/10",
      text: "text-violet-500",
    },
    balanced: {
      border: "border-cyan-500",
      bg: "bg-cyan-500/10",
      text: "text-cyan-500",
    },
    contrarian: {
      border: "border-amber-500",
      bg: "bg-amber-500/10",
      text: "text-amber-500",
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

export const INSIGHT_ICONS: Record<InsightType, LucideIcon> = {
  bias_detection: AlertTriangle,
  pattern: Search,
  improvement_hypothesis: Lightbulb,
};

export const INSIGHT_LABELS: Record<InsightType, string> = {
  bias_detection: "Bias Detected",
  pattern: "Pattern Found",
  improvement_hypothesis: "Improvement",
};
