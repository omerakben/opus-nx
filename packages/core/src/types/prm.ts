import { z } from "zod";

// ============================================================
// Process Reward Model (PRM) Types
// ============================================================
// Based on: "Let's Verify Step by Step"
// (Lightman et al., 2023 — arXiv:2305.20050)
//
// PRMs evaluate each step in a reasoning chain independently,
// rather than only judging the final outcome. This provides:
// - Better error detection (catches wrong intermediate steps)
// - Improved alignment (rewards correct reasoning, not just answers)
// - Enhanced interpretability (know exactly which step failed)
//
// Our implementation uses Claude's own extended thinking to
// verify reasoning steps — a "self-PRM" approach where the
// model evaluates its own reasoning at each step.
// ============================================================

// ============================================================
// Step Verification
// ============================================================

/** Verdict for a single reasoning step */
export const StepVerdictSchema = z.enum([
  "correct",    // Step is logically sound
  "incorrect",  // Step contains an error
  "neutral",    // Step is neither clearly correct nor incorrect
  "uncertain",  // Cannot determine correctness
]);

export type StepVerdict = z.infer<typeof StepVerdictSchema>;

/** Verification result for a single reasoning step */
export const StepVerificationSchema = z.object({
  /** Index of the step being verified (0-based) */
  stepIndex: z.number().int().min(0),
  /** The content of the step being verified */
  stepContent: z.string(),
  /** Verdict on this step's correctness */
  verdict: StepVerdictSchema,
  /** Confidence in the verdict (0-1) */
  confidence: z.number().min(0).max(1),
  /** Explanation of why this verdict was given */
  explanation: z.string(),
  /** Specific issues found (if incorrect) */
  issues: z.array(z.object({
    type: z.enum([
      "logical_error",       // Flawed reasoning logic
      "factual_error",       // Incorrect factual claim
      "missing_context",     // Important context omitted
      "unsupported_claim",   // Claim without evidence
      "circular_reasoning",  // Reasoning that references itself
      "non_sequitur",        // Conclusion doesn't follow
      "overgeneralization",  // Too broad a claim from limited evidence
      "false_dichotomy",     // Presenting only 2 options when more exist
    ]),
    description: z.string(),
    severity: z.enum(["critical", "major", "minor"]),
  })).default([]),
  /** Suggested correction (if incorrect) */
  suggestedCorrection: z.string().optional(),
});

export type StepVerification = z.infer<typeof StepVerificationSchema>;

// ============================================================
// Chain Verification
// ============================================================

/** Complete verification of a reasoning chain */
export const ChainVerificationSchema = z.object({
  /** ID of the thinking node being verified */
  thinkingNodeId: z.string().uuid().optional(),
  /** Individual step verifications */
  steps: z.array(StepVerificationSchema),
  /** Overall chain score (product of step confidences for correct steps) */
  overallScore: z.number().min(0).max(1),
  /** Whether the chain is considered valid */
  isValid: z.boolean(),
  /** Index of the first incorrect step (-1 if all correct) */
  firstErrorAt: z.number().int().default(-1),
  /** Summary of the verification */
  summary: z.string(),
  /** Patterns detected across steps */
  patterns: z.array(z.object({
    name: z.string(),
    description: z.string(),
    affectedSteps: z.array(z.number().int()),
  })).default([]),
  /** Verification metadata */
  metadata: z.object({
    verificationModel: z.string().optional(),
    tokensUsed: z.number().optional(),
    durationMs: z.number().optional(),
    verifiedAt: z.date().optional(),
  }).default({}),
});

export type ChainVerification = z.infer<typeof ChainVerificationSchema>;

// ============================================================
// PRM Configuration
// ============================================================

/** Configuration for the Process Reward Model */
export const PRMConfigSchema = z.object({
  /** Minimum step confidence to consider the step correct */
  correctnessThreshold: z.number().min(0).max(1).default(0.7),
  /** Whether to provide suggested corrections for incorrect steps */
  suggestCorrections: z.boolean().default(true),
  /** Whether to detect reasoning patterns across steps */
  detectPatterns: z.boolean().default(true),
  /** Maximum steps to verify in a single chain */
  maxSteps: z.number().int().min(1).max(100).default(50),
  /** Effort level for verification */
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  /** Whether to use self-verification (same model) or external */
  verificationMode: z.enum(["self", "external"]).default("self"),
});

export type PRMConfig = z.infer<typeof PRMConfigSchema>;

// ============================================================
// PRM Tool Schema (for Claude tool_use)
// ============================================================

/** Tool for Claude to record step-level verification */
export const STEP_VERIFICATION_TOOL = {
  name: "verify_step",
  description: "Verify a single reasoning step for logical correctness, factual accuracy, and sound argumentation.",
  input_schema: {
    type: "object" as const,
    properties: {
      step_index: {
        type: "number",
        description: "Index of the step being verified (0-based)",
      },
      verdict: {
        type: "string",
        enum: ["correct", "incorrect", "neutral", "uncertain"],
        description: "Your verdict on this step's correctness",
      },
      confidence: {
        type: "number",
        description: "Your confidence in this verdict (0.0-1.0)",
      },
      explanation: {
        type: "string",
        description: "Brief explanation for your verdict (1-3 sentences)",
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "logical_error", "factual_error", "missing_context",
                "unsupported_claim", "circular_reasoning", "non_sequitur",
                "overgeneralization", "false_dichotomy",
              ],
            },
            description: { type: "string" },
            severity: { type: "string", enum: ["critical", "major", "minor"] },
          },
          required: ["type", "description", "severity"],
        },
        description: "Specific issues found (only if verdict is 'incorrect')",
      },
      suggested_correction: {
        type: "string",
        description: "How to fix this step (only if incorrect)",
      },
    },
    required: ["step_index", "verdict", "confidence", "explanation"],
  },
};
