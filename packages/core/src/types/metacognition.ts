import { z } from "zod";

// ============================================================
// Insight Types
// ============================================================

/**
 * The three categories of metacognitive insights.
 * These match the database constraint in metacognitive_insights table.
 */
export const InsightTypeSchema = z.enum([
  "bias_detection",         // Identified reasoning bias (anchoring, confirmation, etc.)
  "pattern",                // Recurring reasoning pattern (structure, approach)
  "improvement_hypothesis", // Hypothesis for improving future reasoning
]);

export type InsightType = z.infer<typeof InsightTypeSchema>;

// ============================================================
// Evidence Types
// ============================================================

/**
 * Evidence linking an insight to a specific thinking node.
 * Enables traceability - every insight is grounded in actual reasoning.
 */
export const EvidenceItemSchema = z.object({
  nodeId: z.string().uuid(),
  excerpt: z.string().max(500),
  relevance: z.number().min(0).max(1),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// ============================================================
// Metacognitive Insight
// ============================================================

/**
 * A metacognitive insight extracted from reasoning analysis.
 * This is what makes Opus Nx unique - persistent, queryable self-reflection.
 */
export const MetacognitiveInsightSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  thinkingNodesAnalyzed: z.array(z.string().uuid()),
  insightType: InsightTypeSchema,
  insight: z.string(),
  evidence: z.array(EvidenceItemSchema),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
});

export type MetacognitiveInsight = z.infer<typeof MetacognitiveInsightSchema>;

// ============================================================
// Create Input Type
// ============================================================

/**
 * Input for creating a new metacognitive insight.
 * Used by the database layer.
 */
export const CreateMetacognitiveInsightInputSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  thinkingNodesAnalyzed: z.array(z.string().uuid()),
  insightType: InsightTypeSchema,
  insight: z.string(),
  evidence: z.array(EvidenceItemSchema).default([]),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateMetacognitiveInsightInput = z.infer<typeof CreateMetacognitiveInsightInputSchema>;

// ============================================================
// Analysis Focus Areas
// ============================================================

/**
 * Focus areas for metacognitive analysis.
 * Allows targeted analysis of specific reasoning aspects.
 */
export const FocusAreaSchema = z.enum([
  "decision_quality",       // Quality of decisions and alternatives considered
  "reasoning_patterns",     // Recurring structures in reasoning
  "confidence_calibration", // Match between stated confidence and reasoning depth
  "alternative_exploration",// Thoroughness of alternative exploration
  "bias_detection",         // Systematic biases affecting reasoning
]);

export type FocusArea = z.infer<typeof FocusAreaSchema>;

// ============================================================
// Analysis Scope
// ============================================================

/**
 * Scope of metacognitive analysis.
 */
export const AnalysisScopeSchema = z.enum([
  "session",       // Analyze single session
  "cross_session", // Analyze across recent sessions
  "global",        // Analyze all available reasoning
]);

export type AnalysisScope = z.infer<typeof AnalysisScopeSchema>;

// ============================================================
// Analysis Options
// ============================================================

/**
 * Options for configuring metacognitive analysis.
 */
export const MetacognitionOptionsSchema = z.object({
  sessionId: z.string().uuid().optional(),
  nodeLimit: z.number().min(5).max(50).default(15),
  analysisScope: AnalysisScopeSchema.default("session"),
  focusAreas: z.array(FocusAreaSchema).default(["reasoning_patterns", "bias_detection"]),
});

export type MetacognitionOptions = z.infer<typeof MetacognitionOptionsSchema>;

// ============================================================
// Analysis Result
// ============================================================

/**
 * Result from metacognitive analysis.
 * Includes all extracted insights plus metadata about the analysis.
 */
export const MetacognitionResultSchema = z.object({
  insights: z.array(MetacognitiveInsightSchema),
  nodesAnalyzed: z.number(),
  analysisTokensUsed: z.number().optional(),
  thinkingTokensUsed: z.number().optional(),
  summary: z.string().optional(),
});

export type MetacognitionResult = z.infer<typeof MetacognitionResultSchema>;

// ============================================================
// Tool Input Schema (for Claude tool_use)
// ============================================================

/**
 * Schema for the record_insight tool that Claude uses to output insights.
 * This ensures structured, validated output from the analysis.
 */
export const RecordInsightToolInputSchema = z.object({
  insight_type: InsightTypeSchema,
  insight: z.string(),
  evidence: z.array(z.object({
    nodeId: z.string(),
    excerpt: z.string(),
    relevance: z.number(),
  })),
  confidence: z.number(),
});

export type RecordInsightToolInput = z.infer<typeof RecordInsightToolInputSchema>;
