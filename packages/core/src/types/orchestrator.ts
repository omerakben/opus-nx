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

export type ThinkingBlock = z.infer<typeof ThinkingBlockSchema>;
export type RedactedThinkingBlock = z.infer<typeof RedactedThinkingBlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ToolUseBlock = z.infer<typeof ToolUseBlockSchema>;
export type ContentBlock = ThinkingBlock | RedactedThinkingBlock | TextBlock | ToolUseBlock;

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

export const OrchestratorConfigSchema = z.object({
  model: z.string().default("claude-opus-4-6"),
  maxTokens: z.number().default(128000),
  thinking: ThinkingConfigSchema.default({}),
  streaming: z.boolean().default(true),
});

export type ThinkingConfig = z.infer<typeof ThinkingConfigSchema>;
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
  usage: TokenUsage;
}
