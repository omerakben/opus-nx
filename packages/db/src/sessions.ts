import { getSupabase } from "./client.js";

export interface Session {
  id: string;
  userId?: string;
  status: "active" | "completed" | "archived";
  currentPlan?: Record<string, unknown>;
  knowledgeContext?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionInput {
  userId?: string;
}

/**
 * Create a new session
 */
export async function createSession(input: CreateSessionInput = {}): Promise<Session> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: input.userId,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return mapSession(data);
}

/**
 * Get a session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return mapSession(data);
}

/**
 * Update session with current plan
 */
export async function updateSessionPlan(
  sessionId: string,
  plan: Record<string, unknown>
): Promise<Session> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("sessions")
    .update({
      current_plan: plan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update session plan: ${error.message}`);
  }

  return mapSession(data);
}

/**
 * Update session knowledge context
 */
export async function updateSessionContext(
  sessionId: string,
  context: string[]
): Promise<Session> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("sessions")
    .update({
      knowledge_context: context,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update session context: ${error.message}`);
  }

  return mapSession(data);
}

/**
 * Complete a session
 */
export async function completeSession(sessionId: string): Promise<Session> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete session: ${error.message}`);
  }

  return mapSession(data);
}

/**
 * Get active sessions for a user
 */
export async function getActiveSessions(userId?: string): Promise<Session[]> {
  const supabase = getSupabase();

  let query = supabase
    .from("sessions")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get active sessions: ${error.message}`);
  }

  return (data ?? []).map(mapSession);
}

// Helper to map database row to Session
function mapSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string | undefined,
    status: row.status as Session["status"],
    currentPlan: row.current_plan as Record<string, unknown> | undefined,
    knowledgeContext: row.knowledge_context as string[] | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
