import { getSupabase } from "./client.js";

// ============================================================
// Types
// ============================================================

export type ForkAnalysisMode = "fork" | "debate";

export interface ForkAnalysis {
  id: string;
  sessionId: string;
  query: string;
  mode: ForkAnalysisMode;
  result: Record<string, unknown>;
  steeringHistory: Record<string, unknown>[];
  createdAt: Date;
}

export interface CreateForkAnalysisInput {
  sessionId: string;
  query: string;
  mode: ForkAnalysisMode;
  result: Record<string, unknown>;
}

// ============================================================
// Error Handling
// ============================================================

function handleSupabaseError(error: unknown, context: string): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

function isNotFoundError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "PGRST116"
  );
}

// ============================================================
// Create Operations
// ============================================================

/**
 * Create a new fork analysis record
 */
export async function createForkAnalysis(
  input: CreateForkAnalysisInput
): Promise<ForkAnalysis> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("fork_analyses")
    .insert({
      session_id: input.sessionId,
      query: input.query,
      mode: input.mode,
      result: input.result,
      steering_history: [],
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create fork analysis");
  }

  return mapForkAnalysis(data);
}

// ============================================================
// Read Operations
// ============================================================

/**
 * Get all fork analyses for a session, ordered by most recent first
 */
export async function getSessionForkAnalyses(
  sessionId: string
): Promise<ForkAnalysis[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("fork_analyses")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    handleSupabaseError(error, "Failed to get session fork analyses");
  }

  return (data ?? []).map(mapForkAnalysis);
}

/**
 * Get a single fork analysis by ID
 */
export async function getForkAnalysis(
  id: string
): Promise<ForkAnalysis | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("fork_analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    handleSupabaseError(error, "Failed to get fork analysis");
  }

  return mapForkAnalysis(data);
}

// ============================================================
// Update Operations
// ============================================================

/**
 * Append a steering result to the steering_history JSONB array.
 * Reads current array, appends in JS, writes back.
 */
export async function appendSteeringResult(
  analysisId: string,
  steeringResult: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase();

  // Read current steering history
  const { data: current, error: readError } = await supabase
    .from("fork_analyses")
    .select("steering_history")
    .eq("id", analysisId)
    .single();

  if (readError) {
    handleSupabaseError(readError, "Failed to read steering history");
  }

  const history = (current.steering_history as Record<string, unknown>[]) ?? [];
  history.push(steeringResult);

  // Write back with appended entry
  const { error: updateError } = await supabase
    .from("fork_analyses")
    .update({ steering_history: history })
    .eq("id", analysisId);

  if (updateError) {
    handleSupabaseError(updateError, "Failed to append steering result");
  }
}

// ============================================================
// Mapper
// ============================================================

function mapForkAnalysis(row: Record<string, unknown>): ForkAnalysis {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    query: row.query as string,
    mode: row.mode as ForkAnalysisMode,
    result: (row.result as Record<string, unknown>) ?? {},
    steeringHistory: (row.steering_history as Record<string, unknown>[]) ?? [],
    createdAt: new Date(row.created_at as string),
  };
}
