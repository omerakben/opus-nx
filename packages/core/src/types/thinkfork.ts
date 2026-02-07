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
  /** Output tokens used (includes thinking + text + tool use) */
  outputTokensUsed: z.number(),
  durationMs: z.number(),
  /** Error message if branch execution failed */
  error: z.string().optional(),
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
// Human-in-the-Loop: Per-Branch Guidance
// ============================================================

/**
 * Human guidance for a specific fork branch.
 * Allows humans to steer individual reasoning perspectives.
 */
export const BranchGuidanceSchema = z.object({
  style: ForkStyleSchema,
  /** Human guidance injected into this branch's prompt */
  guidance: z.string().min(1).max(2000),
});

export type BranchGuidance = z.infer<typeof BranchGuidanceSchema>;

// ============================================================
// Fork Analysis Result
// ============================================================

/**
 * Complete result from ThinkFork concurrent analysis.
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
  /** Errors encountered during analysis */
  errors: z.array(z.string()).optional(),
  /** Styles that used fallback prompts instead of file-based prompts */
  fallbackPromptsUsed: z.array(ForkStyleSchema).optional(),
  /** Human guidance that was applied to branches */
  appliedGuidance: z.array(BranchGuidanceSchema).optional(),
});

export type ThinkForkResult = z.infer<typeof ThinkForkResultSchema>;

// ============================================================
// Steering Result (from post-analysis human actions)
// ============================================================

/**
 * Result from a steering action (expand, merge, challenge, refork).
 */
export const SteeringResultSchema = z.object({
  action: z.string(),
  result: z.string(),
  confidence: z.number().min(0).max(1),
  keyInsights: z.array(z.string()),
  /** If merge: the synthesized approach */
  synthesizedApproach: z.string().optional(),
  /** If expand: deeper analysis of the branch */
  expandedAnalysis: z.string().optional(),
  /** If challenge: the response to the challenge */
  challengeResponse: z.string().optional(),
  tokensUsed: z.number(),
  durationMs: z.number(),
});

export type SteeringResult = z.infer<typeof SteeringResultSchema>;

// ============================================================
// ThinkFork Options
// ============================================================

/**
 * Configuration options for ThinkFork analysis.
 */

// ============================================================
// Branch Steering Actions (Post-Analysis)
// ============================================================

/**
 * Actions humans can take after seeing initial fork results.
 * This is the "cognitive co-piloting" interface.
 */
export const BranchSteeringActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("expand"),
    /** Which branch to expand with deeper analysis */
    style: ForkStyleSchema,
    /** Additional context or direction for expansion */
    direction: z.string().optional(),
  }),
  z.object({
    action: z.literal("merge"),
    /** Branches to synthesize into a unified approach */
    styles: z.array(ForkStyleSchema).min(2),
    /** What aspect to focus the merger on */
    focusArea: z.string().optional(),
  }),
  z.object({
    action: z.literal("challenge"),
    /** Which branch's conclusion to challenge */
    style: ForkStyleSchema,
    /** The specific challenge or counter-argument */
    challenge: z.string(),
  }),
  z.object({
    action: z.literal("refork"),
    /** Re-run with new human-provided context across all branches */
    newContext: z.string(),
    /** Keep original results for comparison */
    keepOriginal: z.boolean().default(true),
  }),
]);

export type BranchSteeringAction = z.infer<typeof BranchSteeringActionSchema>;

// ============================================================
// ThinkFork Options
// ============================================================

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
  /** Human guidance per branch (cognitive co-piloting) */
  branchGuidance: z.array(BranchGuidanceSchema).optional(),
});

export type ThinkForkOptions = z.infer<typeof ThinkForkOptionsSchema>;

// ============================================================
// Debate Mode (Agent Teams-inspired competing hypotheses)
// ============================================================

/**
 * Options for debate mode: branches challenge each other's conclusions.
 * Inspired by Agent Teams' competing-hypotheses debugging pattern.
 */
export const DebateOptionsSchema = z.object({
  /** Number of debate rounds (each round = every branch responds to others) */
  rounds: z.number().min(1).max(5).default(2),
  /** Thinking effort for debate rounds */
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  /** Styles to participate in debate (min 2) */
  styles: z.array(ForkStyleSchema).min(2).default(["conservative", "aggressive", "balanced", "contrarian"]),
});

export type DebateOptions = z.infer<typeof DebateOptionsSchema>;

/**
 * A single debate round entry where one branch responds to others.
 */
export const DebateRoundEntrySchema = z.object({
  style: ForkStyleSchema,
  round: z.number(),
  response: z.string(),
  confidence: z.number().min(0).max(1),
  /** Whether this branch changed its position */
  positionChanged: z.boolean(),
  keyCounterpoints: z.array(z.string()),
  concessions: z.array(z.string()),
});

export type DebateRoundEntry = z.infer<typeof DebateRoundEntrySchema>;

/**
 * Complete result from a debate session.
 */
export const DebateResultSchema = z.object({
  query: z.string(),
  /** Initial fork results before debate */
  initialFork: ThinkForkResultSchema,
  /** All debate round entries */
  rounds: z.array(DebateRoundEntrySchema),
  /** Final positions after debate */
  finalPositions: z.array(z.object({
    style: ForkStyleSchema,
    conclusion: z.string(),
    confidence: z.number(),
    changedFromInitial: z.boolean(),
  })),
  /** Consensus conclusion if branches converged */
  consensus: z.string().optional(),
  /** Overall confidence in the debate outcome */
  consensusConfidence: z.number().min(0).max(1).optional(),
  totalRounds: z.number(),
  totalTokensUsed: z.number(),
  totalDurationMs: z.number(),
});

export type DebateResult = z.infer<typeof DebateResultSchema>;

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
