import { z } from "zod";

// ============================================================
// Edge Types
// ============================================================

export const EdgeTypeSchema = z.enum([
  "influences",   // This reasoning influenced subsequent reasoning
  "contradicts",  // This reasoning contradicts another
  "supports",     // This reasoning supports/validates another
  "supersedes",   // This reasoning replaces/updates another
  "refines",      // This reasoning refines/elaborates another
]);

export type EdgeType = z.infer<typeof EdgeTypeSchema>;

// ============================================================
// Decision Point Types
// ============================================================

export const AlternativeSchema = z.object({
  path: z.string(),
  reasonRejected: z.string(),
});

export const DecisionPointSchema = z.object({
  id: z.string(),
  thinkingNodeId: z.string(),
  stepNumber: z.number(),
  description: z.string(),
  chosenPath: z.string(),
  alternatives: z.array(AlternativeSchema).default([]),
  confidence: z.number().min(0).max(1).optional(),
  reasoningExcerpt: z.string().optional(),
  createdAt: z.date(),
});

export type Alternative = z.infer<typeof AlternativeSchema>;
export type DecisionPoint = z.infer<typeof DecisionPointSchema>;

// ============================================================
// Structured Reasoning
// ============================================================

export const ReasoningStepSchema = z.object({
  stepNumber: z.number(),
  content: z.string(),
  type: z.enum(["analysis", "hypothesis", "evaluation", "conclusion", "consideration"]).optional(),
});

export const StructuredReasoningSchema = z.object({
  steps: z.array(ReasoningStepSchema).default([]),
  decisionPoints: z.array(DecisionPointSchema.omit({ id: true, thinkingNodeId: true, createdAt: true })).default([]),
  mainConclusion: z.string().optional(),
  confidenceFactors: z.array(z.string()).default([]),
  alternativesConsidered: z.number().default(0),
});

export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;
export type StructuredReasoning = z.infer<typeof StructuredReasoningSchema>;

// ============================================================
// Thinking Node Types
// ============================================================

export const TokenUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  thinkingTokens: z.number().optional(),
});

/** Node type distinguishes between regular thinking, compaction, and fork branch nodes */
export const NodeTypeSchema = z.enum([
  "thinking",          // Regular reasoning node
  "compaction",        // Memory consolidation from context compaction
  "fork_branch",       // Result from a ThinkFork branch
  "human_annotation",  // Human-added note or guidance
]);

export type NodeType = z.infer<typeof NodeTypeSchema>;

/** Human annotation on a decision point or node */
export const AnnotationSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["agree", "disagree", "explore", "note"]),
  text: z.string(),
  createdAt: z.date(),
});

export type Annotation = z.infer<typeof AnnotationSchema>;

export const ThinkingNodeSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  parentNodeId: z.string().uuid().nullable().optional(),
  reasoning: z.string(),
  structuredReasoning: StructuredReasoningSchema.default({}),
  confidenceScore: z.number().min(0).max(1).nullable().optional(),
  thinkingBudget: z.number().optional(),
  signature: z.string().optional(),
  inputQuery: z.string().optional(),
  tokenUsage: TokenUsageSchema.optional(),
  /** Type of node - determines visualization and behavior */
  nodeType: NodeTypeSchema.default("thinking"),
  /** Human annotations on this node */
  annotations: z.array(AnnotationSchema).optional(),
  createdAt: z.date(),
});

export type ThinkingNode = z.infer<typeof ThinkingNodeSchema>;

// ============================================================
// Reasoning Edge Types
// ============================================================

export const ReasoningEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  edgeType: EdgeTypeSchema,
  weight: z.number().min(0).max(1).default(1.0),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
});

export type ReasoningEdge = z.infer<typeof ReasoningEdgeSchema>;

// ============================================================
// Graph Traversal Result
// ============================================================

export const GraphNodeResultSchema = z.object({
  nodeId: z.string().uuid(),
  reasoning: z.string(),
  confidenceScore: z.number().nullable(),
  edgeType: EdgeTypeSchema.optional(),
  hopDistance: z.number(),
});

export const GraphTraversalResultSchema = z.object({
  startNodeId: z.string().uuid(),
  nodes: z.array(GraphNodeResultSchema),
  maxDepth: z.number(),
  edgeTypes: z.array(EdgeTypeSchema),
});

export type GraphNodeResult = z.infer<typeof GraphNodeResultSchema>;
export type GraphTraversalResult = z.infer<typeof GraphTraversalResultSchema>;

// ============================================================
// Reasoning Chain
// ============================================================

export const ReasoningChainNodeSchema = z.object({
  nodeId: z.string().uuid(),
  reasoning: z.string(),
  confidenceScore: z.number().nullable(),
  chainPosition: z.number(),
});

export const ReasoningChainSchema = z.object({
  targetNodeId: z.string().uuid(),
  chain: z.array(ReasoningChainNodeSchema),
  totalLength: z.number(),
});

export type ReasoningChainNode = z.infer<typeof ReasoningChainNodeSchema>;
export type ReasoningChain = z.infer<typeof ReasoningChainSchema>;

// ============================================================
// Input Types (for creating new records)
// ============================================================

export const CreateThinkingNodeInputSchema = z.object({
  sessionId: z.string().uuid(),
  parentNodeId: z.string().uuid().optional(),
  reasoning: z.string(),
  structuredReasoning: StructuredReasoningSchema.optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  thinkingBudget: z.number().optional(),
  signature: z.string().optional(),
  inputQuery: z.string().optional(),
  tokenUsage: TokenUsageSchema.optional(),
  nodeType: NodeTypeSchema.optional(),
});

export const CreateReasoningEdgeInputSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  edgeType: EdgeTypeSchema,
  weight: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateDecisionPointInputSchema = z.object({
  thinkingNodeId: z.string().uuid(),
  stepNumber: z.number(),
  description: z.string(),
  chosenPath: z.string(),
  alternatives: z.array(AlternativeSchema).optional(),
  confidence: z.number().min(0).max(1).optional(),
  reasoningExcerpt: z.string().optional(),
});

export type CreateThinkingNodeInput = z.infer<typeof CreateThinkingNodeInputSchema>;
export type CreateReasoningEdgeInput = z.infer<typeof CreateReasoningEdgeInputSchema>;
export type CreateDecisionPointInput = z.infer<typeof CreateDecisionPointInputSchema>;

// ============================================================
// Session Reasoning Context (for metacognition)
// ============================================================

export const SessionReasoningContextSchema = z.object({
  nodeId: z.string().uuid(),
  reasoning: z.string(),
  confidenceScore: z.number().nullable(),
  decisionCount: z.number(),
  inputQuery: z.string().nullable(),
  createdAt: z.date(),
});

export type SessionReasoningContext = z.infer<typeof SessionReasoningContextSchema>;

// ============================================================
// Search Results
// ============================================================

export const ReasoningSearchResultSchema = z.object({
  nodeId: z.string().uuid(),
  reasoning: z.string(),
  confidenceScore: z.number().nullable(),
  rank: z.number(),
});

export type ReasoningSearchResult = z.infer<typeof ReasoningSearchResultSchema>;
