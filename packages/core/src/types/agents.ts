/**
 * @scope future - Post-hackathon roadmap
 */
import { z } from "zod";

// ============================================================
// [Future Scope] Agent Model Configuration
// ============================================================

export const AgentModelSchema = z.enum([
  "claude-opus-4-6",
]);

// ============================================================
// Agent Tools
// ============================================================

export const AgentToolSchema = z.enum([
  // Research tools
  "web_search",
  "paper_analysis",
  "fact_verification",
  // Code tools
  "code_generation",
  "repo_management",
  "debugging",
  // Knowledge tools
  "categorization",
  "cross_reference",
  "retrieval",
  // Planning tools
  "task_decomposition",
  "scheduling",
  "dependency_analysis",
  // Communication tools
  "email_draft",
  "message_format",
  "report_generation",
]);

export type AgentModel = z.infer<typeof AgentModelSchema>;
export type AgentTool = z.infer<typeof AgentToolSchema>;

// ============================================================
// Agent Configuration
// ============================================================

export const AgentConfigSchema = z.object({
  name: z.string(),
  model: AgentModelSchema,
  maxTokens: z.number(),
  tools: z.array(AgentToolSchema),
  systemPromptPath: z.string(),
  temperature: z.number().default(0.7),
  description: z.string(),
});

export const AgentsConfigSchema = z.object({
  agents: z.record(AgentConfigSchema),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

// ============================================================
// Agent Runtime State
// ============================================================

export interface AgentRunState {
  agentName: string;
  taskId: string;
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  tokensUsed: {
    input: number;
    output: number;
    thinking?: number;
  };
  result?: unknown;
  error?: string;
}

// ============================================================
// Agent Invocation
// ============================================================

export interface AgentInvocation {
  agentName: string;
  input: string;
  context?: string;
  taskId?: string;
}

export interface AgentResult {
  agentName: string;
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  durationMs: number;
}
