import { getSupabase } from "./client.js";

export interface DecisionLogEntry {
  id: string;
  sessionId: string;
  taskPlanId?: string;
  decisionType: "task_routing" | "agent_selection" | "knowledge_retrieval" | "synthesis";
  inputContext: string;
  thinkingSummary?: string;
  thinkingSignature?: string;
  decisionOutput: Record<string, unknown>;
  tokensUsed?: {
    input: number;
    output: number;
    thinking?: number;
  };
  latencyMs?: number;
  createdAt: Date;
}

export interface CreateDecisionLogInput {
  sessionId: string;
  taskPlanId?: string;
  decisionType: DecisionLogEntry["decisionType"];
  inputContext: string;
  thinkingSummary?: string;
  thinkingSignature?: string;
  decisionOutput: Record<string, unknown>;
  tokensUsed?: DecisionLogEntry["tokensUsed"];
  latencyMs?: number;
}

/**
 * Log a decision made by the orchestrator
 */
export async function logDecision(input: CreateDecisionLogInput): Promise<DecisionLogEntry> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("decision_log")
    .insert({
      session_id: input.sessionId,
      task_plan_id: input.taskPlanId,
      decision_type: input.decisionType,
      input_context: input.inputContext,
      thinking_summary: input.thinkingSummary,
      thinking_signature: input.thinkingSignature,
      decision_output: input.decisionOutput,
      tokens_used: input.tokensUsed,
      latency_ms: input.latencyMs,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log decision: ${error.message}`);
  }

  return mapDecisionLogEntry(data);
}

/**
 * Get decision logs for a session
 */
export async function getSessionDecisions(
  sessionId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<DecisionLogEntry[]> {
  const supabase = getSupabase();
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from("decision_log")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get session decisions: ${error.message}`);
  }

  return (data ?? []).map(mapDecisionLogEntry);
}

/**
 * Get decision logs by type
 */
export async function getDecisionsByType(
  decisionType: DecisionLogEntry["decisionType"],
  options: { limit?: number; offset?: number } = {}
): Promise<DecisionLogEntry[]> {
  const supabase = getSupabase();
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from("decision_log")
    .select("*")
    .eq("decision_type", decisionType)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get decisions by type: ${error.message}`);
  }

  return (data ?? []).map(mapDecisionLogEntry);
}

// Helper to map database row to DecisionLogEntry
function mapDecisionLogEntry(row: Record<string, unknown>): DecisionLogEntry {
  const tokensUsed = row.tokens_used as Record<string, number> | null;

  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    taskPlanId: row.task_plan_id as string | undefined,
    decisionType: row.decision_type as DecisionLogEntry["decisionType"],
    inputContext: row.input_context as string,
    thinkingSummary: row.thinking_summary as string | undefined,
    thinkingSignature: row.thinking_signature as string | undefined,
    decisionOutput: row.decision_output as Record<string, unknown>,
    tokensUsed: tokensUsed
      ? {
          input: tokensUsed.input ?? 0,
          output: tokensUsed.output ?? 0,
          thinking: tokensUsed.thinking,
        }
      : undefined,
    latencyMs: row.latency_ms as number | undefined,
    createdAt: new Date(row.created_at as string),
  };
}
