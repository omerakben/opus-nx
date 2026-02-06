import { getSupabase } from "./client.js";

export interface AgentRun {
  id: string;
  sessionId: string;
  taskId?: string;
  agentName: string;
  model: string;
  status: "running" | "completed" | "failed";
  inputContext?: string;
  outputResult?: Record<string, unknown>;
  errorMessage?: string;
  tokensUsed?: {
    input: number;
    output: number;
    thinking?: number;
  };
  startedAt: Date;
  completedAt?: Date;
}

export interface CreateAgentRunInput {
  sessionId: string;
  taskId?: string;
  agentName: string;
  model: string;
  inputContext?: string;
}

/**
 * Start tracking an agent run
 */
export async function startAgentRun(input: CreateAgentRunInput): Promise<AgentRun> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      session_id: input.sessionId,
      task_id: input.taskId,
      agent_name: input.agentName,
      model: input.model,
      status: "running",
      input_context: input.inputContext,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to start agent run: ${error.message}`);
  }

  return mapAgentRun(data);
}

/**
 * Complete an agent run with results
 */
export async function completeAgentRun(
  runId: string,
  result: {
    outputResult?: Record<string, unknown>;
    tokensUsed?: AgentRun["tokensUsed"];
  }
): Promise<AgentRun> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("agent_runs")
    .update({
      status: "completed",
      output_result: result.outputResult,
      tokens_used: result.tokensUsed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete agent run: ${error.message}`);
  }

  return mapAgentRun(data);
}

/**
 * Fail an agent run with error
 */
export async function failAgentRun(runId: string, errorMessage: string): Promise<AgentRun> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to fail agent run: ${error.message}`);
  }

  return mapAgentRun(data);
}

/**
 * Get agent runs for a session
 */
export async function getSessionAgentRuns(
  sessionId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<AgentRun[]> {
  const supabase = getSupabase();
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("session_id", sessionId)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get session agent runs: ${error.message}`);
  }

  return (data ?? []).map(mapAgentRun);
}

/**
 * Get agent runs by agent name
 */
export async function getAgentRunsByName(
  agentName: string,
  options: { limit?: number; offset?: number } = {}
): Promise<AgentRun[]> {
  const supabase = getSupabase();
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("agent_name", agentName)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get agent runs by name: ${error.message}`);
  }

  return (data ?? []).map(mapAgentRun);
}

// Helper to map database row to AgentRun
function mapAgentRun(row: Record<string, unknown>): AgentRun {
  const tokensUsed = row.tokens_used as Record<string, number> | null;

  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    taskId: row.task_id as string | undefined,
    agentName: row.agent_name as string,
    model: row.model as string,
    status: row.status as AgentRun["status"],
    inputContext: row.input_context as string | undefined,
    outputResult: row.output_result as Record<string, unknown> | undefined,
    errorMessage: row.error_message as string | undefined,
    tokensUsed: tokensUsed
      ? {
          input: tokensUsed.input ?? 0,
          output: tokensUsed.output ?? 0,
          thinking: tokensUsed.thinking,
        }
      : undefined,
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
  };
}
