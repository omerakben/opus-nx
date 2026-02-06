import { z } from "zod";

// ============================================================
// Fork Reasoning Styles
// ============================================================

/**
 * The four reasoning styles for ThinkFork parallel analysis.
 * Each style uses a different system prompt to explore the problem space.
 */
export const ForkStyleSchema = z.enum([
  "conservative",  // Minimize risk, proven approaches, safety first
  "aggressive",    // Maximize optionality, explore edge cases, push boundaries
  "balanced",      // Tradeoff-aware, pragmatic, consider all factors
  "contrarian",    // Challenge assumptions, alternative frameworks, question consensus
]);

export type ForkStyle = z.infer<typeof ForkStyleSchema>;

/** Human-readable descriptions for each fork style */
export const FORK_STYLE_DESCRIPTIONS: Record<ForkStyle, string> = {
  conservative: "Minimize risk, prefer proven approaches, prioritize safety and reliability",
  aggressive: "Maximize optionality, explore edge cases, push boundaries for innovation",
  balanced: "Tradeoff-aware reasoning, pragmatic approach considering all factors",
  contrarian: "Challenge assumptions, explore alternative frameworks, question consensus",
};

// ============================================================
// Branch Result
// ============================================================

/**
 * Result from a single fork branch execution.
 */
export const ForkBranchResultSchema = z.object({
  style: ForkStyleSchema,
  conclusion: z.string(),
  confidence: z.number().min(0).max(1),
  keyInsights: z.array(z.string()),
  risks: z.array(z.string()).optional(),
  opportunities: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  thinkingTokensUsed: z.number(),
  durationMs: z.number(),
});

export type ForkBranchResult = z.infer<typeof ForkBranchResultSchema>;

// ============================================================
// Convergence/Divergence Analysis
// ============================================================

/**
 * Points where fork branches agree or disagree.
 */
export const ConvergencePointSchema = z.object({
  topic: z.string(),
  agreementLevel: z.enum(["full", "partial", "none"]),
  styles: z.array(ForkStyleSchema),
  summary: z.string(),
});

export type ConvergencePoint = z.infer<typeof ConvergencePointSchema>;

export const DivergencePointSchema = z.object({
  topic: z.string(),
  positions: z.array(z.object({
    style: ForkStyleSchema,
    position: z.string(),
    confidence: z.number(),
  })),
  significance: z.enum(["high", "medium", "low"]),
  recommendation: z.string().optional(),
});

export type DivergencePoint = z.infer<typeof DivergencePointSchema>;

// ============================================================
// Fork Analysis Result
// ============================================================

/**
 * Complete result from ThinkFork parallel analysis.
 */
export const ThinkForkResultSchema = z.object({
  query: z.string(),
  branches: z.array(ForkBranchResultSchema),
  convergencePoints: z.array(ConvergencePointSchema),
  divergencePoints: z.array(DivergencePointSchema),
  metaInsight: z.string(),
  recommendedApproach: z.object({
    style: ForkStyleSchema,
    rationale: z.string(),
    confidence: z.number(),
  }).optional(),
  totalTokensUsed: z.number(),
  totalDurationMs: z.number(),
});

export type ThinkForkResult = z.infer<typeof ThinkForkResultSchema>;

// ============================================================
// ThinkFork Options
// ============================================================

/**
 * Configuration options for ThinkFork analysis.
 */
export const ThinkForkOptionsSchema = z.object({
  /** Which fork styles to use (default: all four) */
  styles: z.array(ForkStyleSchema).min(2).default(["conservative", "aggressive", "balanced", "contrarian"]),
  /** Thinking effort level per branch */
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  /** Whether to run comparison analysis after branches complete */
  analyzeConvergence: z.boolean().default(true),
  /** Session ID for persistence */
  sessionId: z.string().uuid().optional(),
  /** Additional context to include in all branch prompts */
  additionalContext: z.string().optional(),
});

export type ThinkForkOptions = z.infer<typeof ThinkForkOptionsSchema>;

// ============================================================
// Tool Schemas for Structured Output
// ============================================================

/**
 * Tool for extracting structured branch conclusions.
 */
export const BRANCH_CONCLUSION_TOOL = {
  name: "record_conclusion",
  description: "Record your conclusion and key insights from analyzing the problem with your assigned reasoning style.",
  input_schema: {
    type: "object" as const,
    properties: {
      conclusion: {
        type: "string",
        description: "Your main conclusion (2-4 sentences)",
      },
      confidence: {
        type: "number",
        description: "Confidence in this conclusion (0.0-1.0)",
      },
      key_insights: {
        type: "array",
        items: { type: "string" },
        description: "Key insights from your analysis (3-5 points)",
      },
      risks: {
        type: "array",
        items: { type: "string" },
        description: "Potential risks or downsides identified",
      },
      opportunities: {
        type: "array",
        items: { type: "string" },
        description: "Opportunities or upsides identified",
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
        description: "Key assumptions underlying your analysis",
      },
    },
    required: ["conclusion", "confidence", "key_insights"],
  },
};

/**
 * Tool for analyzing convergence/divergence between branches.
 */
export const COMPARISON_TOOL = {
  name: "record_comparison",
  description: "Record points of agreement and disagreement between the different reasoning approaches.",
  input_schema: {
    type: "object" as const,
    properties: {
      convergence_points: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            agreement_level: { type: "string", enum: ["full", "partial", "none"] },
            styles: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
          required: ["topic", "agreement_level", "styles", "summary"],
        },
        description: "Topics where approaches agree",
      },
      divergence_points: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            positions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  style: { type: "string" },
                  position: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["style", "position", "confidence"],
              },
            },
            significance: { type: "string", enum: ["high", "medium", "low"] },
            recommendation: { type: "string" },
          },
          required: ["topic", "positions", "significance"],
        },
        description: "Topics where approaches disagree",
      },
      meta_insight: {
        type: "string",
        description: "Overall insight about what the different perspectives reveal",
      },
      recommended_approach: {
        type: "object",
        properties: {
          style: { type: "string" },
          rationale: { type: "string" },
          confidence: { type: "number" },
        },
        description: "Which approach seems most appropriate for this problem",
      },
    },
    required: ["convergence_points", "divergence_points", "meta_insight"],
  },
};
