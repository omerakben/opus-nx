import { z } from "zod";

// ============================================================
// Thinking Block Types (from Claude API)
// ============================================================

export const ThinkingBlockSchema = z.object({
  type: z.literal("thinking"),
  thinking: z.string(),
  signature: z.string(),
});

export const RedactedThinkingBlockSchema = z.object({
  type: z.literal("redacted_thinking"),
  data: z.string(),
});

export const TextBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const ToolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});

// Compaction block - returned when context compaction is triggered (Opus 4.6 beta)
export const CompactionBlockSchema = z.object({
  type: z.literal("compaction"),
  content: z.string(),
});

export type ThinkingBlock = z.infer<typeof ThinkingBlockSchema>;
export type RedactedThinkingBlock = z.infer<typeof RedactedThinkingBlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ToolUseBlock = z.infer<typeof ToolUseBlockSchema>;
export type CompactionBlock = z.infer<typeof CompactionBlockSchema>;
export type ContentBlock = ThinkingBlock | RedactedThinkingBlock | TextBlock | ToolUseBlock | CompactionBlock;

// ============================================================
// Task Types
// ============================================================

export const TaskStatusSchema = z.enum(["pending", "in_progress", "completed", "failed"]);

export const AgentNameSchema = z.enum([
  "research",
  "code",
  "knowledge",
  "planning",
  "communication",
]);

export const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  assignedAgent: AgentNameSchema,
  status: TaskStatusSchema,
  dependencies: z.array(z.string()).default([]),
  result: z.unknown().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

export const TaskPlanSchema = z.object({
  id: z.string(),
  goal: z.string(),
  tasks: z.array(TaskSchema),
  createdAt: z.date(),
  status: z.enum(["planning", "executing", "completed", "failed"]),
  thinkingSummary: z.string().optional(),
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type AgentName = z.infer<typeof AgentNameSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;

// ============================================================
// Orchestrator Configuration
// ============================================================

export const ThinkingConfigSchema = z.object({
  type: z.enum(["adaptive", "enabled"]).default("adaptive"),
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  budgetTokens: z.number().optional(),
});

// Compaction configuration for infinite reasoning sessions (Opus 4.6 beta)
export const CompactionConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Token threshold to trigger compaction (min 50000) */
  triggerTokens: z.number().min(50000).default(150000),
  /** Whether to pause after compaction for human review */
  pauseAfterCompaction: z.boolean().default(false),
  /** Custom summarization instructions for compaction */
  instructions: z.string().optional(),
});

// Dynamic effort routing: auto-selects effort level based on task complexity
export const EffortRoutingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Effort for simple/direct queries (greeting, factual, single-step) */
  simpleEffort: z.enum(["low", "medium", "high", "max"]).default("medium"),
  /** Effort for standard multi-step tasks */
  standardEffort: z.enum(["low", "medium", "high", "max"]).default("high"),
  /** Effort for complex reasoning (planning, analysis, debugging) */
  complexEffort: z.enum(["low", "medium", "high", "max"]).default("max"),
});

// Token budget enforcement for session-level cost control
export const TokenBudgetConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Maximum total output tokens across the entire session */
  maxSessionOutputTokens: z.number().default(500000),
  /** Maximum number of compaction cycles before session stops */
  maxCompactions: z.number().default(10),
  /** Callback mode when budget is approaching (warn at 80%) */
  warnAtPercent: z.number().min(0).max(100).default(80),
});

export const OrchestratorConfigSchema = z.object({
  model: z.string().default("claude-opus-4-6"),
  maxTokens: z.number().default(16384),
  thinking: ThinkingConfigSchema.default({}),
  streaming: z.boolean().default(true),
  /** Data residency: "global" (default) or "us" for US-only inference */
  inferenceGeo: z.enum(["global", "us"]).optional(),
  /** Context compaction for infinite reasoning sessions (Opus 4.6 beta) */
  compaction: CompactionConfigSchema.optional(),
  /** Dynamic effort routing based on task complexity */
  effortRouting: EffortRoutingConfigSchema.optional(),
  /** Token budget enforcement for session cost control */
  tokenBudget: TokenBudgetConfigSchema.optional(),
});

export type ThinkingConfig = z.infer<typeof ThinkingConfigSchema>;
export type CompactionConfig = z.infer<typeof CompactionConfigSchema>;
export type EffortRoutingConfig = z.infer<typeof EffortRoutingConfigSchema>;
export type TokenBudgetConfig = z.infer<typeof TokenBudgetConfigSchema>;
export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

// ============================================================
// Session State
// ============================================================

export interface OrchestratorSession {
  id: string;
  userId?: string;
  messages: ContentBlock[];
  thinkingHistory: ThinkingBlock[];
  currentPlan: TaskPlan | null;
  knowledgeContext: string[];
  /** Number of context compactions performed in this session */
  compactionCount: number;
  /** Last compaction summary (for continuity) */
  lastCompactionSummary?: string;
  /** Cumulative output tokens consumed in this session */
  cumulativeOutputTokens: number;
  /** Whether the session budget warning has been triggered */
  budgetWarningTriggered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Usage Tracking
// ============================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

export interface ThinkingResult {
  content: ContentBlock[];
  thinkingBlocks: (ThinkingBlock | RedactedThinkingBlock)[];
  textBlocks: TextBlock[];
  toolUseBlocks: ToolUseBlock[];
  compactionBlocks: CompactionBlock[];
  usage: TokenUsage;
  /** Whether compaction was triggered during this request */
  compacted: boolean;
  /** Stop reason from the API */
  stopReason?: string;
}
