import { getSupabase } from "./client.js";
import { throwSupabaseError } from "./supabase-error.js";

// ============================================================
// Types
// ============================================================

export type ReasoningArtifactTypeDB =
  | "node"
  | "decision_point"
  | "hypothesis"
  | "chain_summary"
  | "metacognitive";

export interface ReasoningArtifactRow {
  id: string;
  sessionId: string;
  thinkingNodeId: string | null;
  artifactType: ReasoningArtifactTypeDB;
  title: string | null;
  content: string;
  snapshot: Record<string, unknown>;
  topicTags: string[];
  importanceScore: number;
  sourceConfidence: number | null;
  embedding: number[] | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

export interface SessionRehydrationRunRow {
  id: string;
  sessionId: string;
  queryText: string;
  queryEmbedding: number[] | null;
  selectedArtifactIds: string[];
  candidateCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateReasoningArtifactInput {
  id?: string;
  sessionId: string;
  thinkingNodeId?: string;
  artifactType: ReasoningArtifactTypeDB;
  title?: string;
  content: string;
  snapshot?: Record<string, unknown>;
  topicTags?: string[];
  importanceScore?: number;
  sourceConfidence?: number;
  embedding?: number[];
  createdBy?: string;
}

export interface CreateSessionRehydrationRunInput {
  sessionId: string;
  queryText: string;
  queryEmbedding?: number[];
  selectedArtifactIds?: string[];
  candidateCount?: number;
  metadata?: Record<string, unknown>;
}

export interface ReasoningArtifactMatchResult {
  id: string;
  sessionId: string;
  thinkingNodeId: string | null;
  artifactType: ReasoningArtifactTypeDB;
  content: string;
  importanceScore: number;
  sourceConfidence: number | null;
  lastUsedAt: Date | null;
  similarity: number;
}

// ============================================================
// Error Handling
// ============================================================

function handleSupabaseError(error: unknown, context: string): never {
  throwSupabaseError(error, context);
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
// Artifact CRUD
// ============================================================

export async function createReasoningArtifact(
  input: CreateReasoningArtifactInput
): Promise<ReasoningArtifactRow> {
  const supabase = getSupabase();

  const payload: Record<string, unknown> = {
    session_id: input.sessionId,
    thinking_node_id: input.thinkingNodeId ?? null,
    artifact_type: input.artifactType,
    title: input.title ?? null,
    content: input.content,
    snapshot: input.snapshot ?? {},
    topic_tags: input.topicTags ?? [],
    importance_score: input.importanceScore ?? 0.5,
    source_confidence: input.sourceConfidence ?? null,
    embedding: input.embedding ?? null,
    created_by: input.createdBy ?? null,
  };

  if (input.id) {
    payload.id = input.id;
  }

  const { data, error } = await supabase
    .from("reasoning_artifacts")
    .insert(payload)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create reasoning artifact");
  }

  return mapReasoningArtifact(data);
}

export async function upsertReasoningArtifact(
  input: CreateReasoningArtifactInput
): Promise<ReasoningArtifactRow> {
  const supabase = getSupabase();

  const payload: Record<string, unknown> = {
    session_id: input.sessionId,
    thinking_node_id: input.thinkingNodeId ?? null,
    artifact_type: input.artifactType,
    title: input.title ?? null,
    content: input.content,
    snapshot: input.snapshot ?? {},
    topic_tags: input.topicTags ?? [],
    importance_score: input.importanceScore ?? 0.5,
    source_confidence: input.sourceConfidence ?? null,
    embedding: input.embedding ?? null,
    created_by: input.createdBy ?? null,
  };

  if (input.id) {
    payload.id = input.id;
  }

  const { data, error } = await supabase
    .from("reasoning_artifacts")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to upsert reasoning artifact");
  }

  return mapReasoningArtifact(data);
}

export async function getReasoningArtifact(
  id: string
): Promise<ReasoningArtifactRow | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("reasoning_artifacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    handleSupabaseError(error, "Failed to get reasoning artifact");
  }

  return mapReasoningArtifact(data);
}

export async function getSessionReasoningArtifacts(
  sessionId: string,
  options: { artifactType?: ReasoningArtifactTypeDB; limit?: number } = {}
): Promise<ReasoningArtifactRow[]> {
  const supabase = getSupabase();

  let query = supabase
    .from("reasoning_artifacts")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (options.artifactType) {
    query = query.eq("artifact_type", options.artifactType);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    handleSupabaseError(error, "Failed to get session reasoning artifacts");
  }

  return (data ?? []).map(mapReasoningArtifact);
}

export async function updateReasoningArtifactEmbedding(
  id: string,
  embedding: number[]
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("reasoning_artifacts")
    .update({ embedding })
    .eq("id", id);

  if (error) {
    handleSupabaseError(error, "Failed to update reasoning artifact embedding");
  }
}

export async function markReasoningArtifactUsed(id: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("reasoning_artifacts")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    handleSupabaseError(error, "Failed to mark reasoning artifact as used");
  }
}

export async function searchReasoningArtifacts(
  queryEmbedding: number[],
  options: {
    threshold?: number;
    limit?: number;
    sessionId?: string;
    artifactType?: ReasoningArtifactTypeDB;
  } = {}
): Promise<ReasoningArtifactMatchResult[]> {
  const supabase = getSupabase();
  const { threshold = 0.65, limit = 10, sessionId, artifactType } = options;

  const { data, error } = await supabase.rpc("match_reasoning_artifacts", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_session_id: sessionId ?? null,
    filter_artifact_type: artifactType ?? null,
  });

  if (error) {
    handleSupabaseError(error, "Failed to search reasoning artifacts");
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    thinkingNodeId: (row.thinking_node_id as string) ?? null,
    artifactType: row.artifact_type as ReasoningArtifactTypeDB,
    content: row.content as string,
    importanceScore: row.importance_score as number,
    sourceConfidence: (row.source_confidence as number | null) ?? null,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : null,
    similarity: row.similarity as number,
  }));
}

// ============================================================
// Session Rehydration Runs
// ============================================================

export async function createSessionRehydrationRun(
  input: CreateSessionRehydrationRunInput
): Promise<SessionRehydrationRunRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("session_rehydration_runs")
    .insert({
      session_id: input.sessionId,
      query_text: input.queryText,
      query_embedding: input.queryEmbedding ?? null,
      selected_artifact_ids: input.selectedArtifactIds ?? [],
      candidate_count: input.candidateCount ?? 0,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create session rehydration run");
  }

  return mapSessionRehydrationRun(data);
}

export async function getSessionRehydrationRuns(
  sessionId: string,
  options: { limit?: number } = {}
): Promise<SessionRehydrationRunRow[]> {
  const supabase = getSupabase();
  const { limit = 20 } = options;

  const { data, error } = await supabase
    .from("session_rehydration_runs")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    handleSupabaseError(error, "Failed to get session rehydration runs");
  }

  return (data ?? []).map(mapSessionRehydrationRun);
}

// ============================================================
// Mappers
// ============================================================

function mapReasoningArtifact(row: Record<string, unknown>): ReasoningArtifactRow {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    thinkingNodeId: (row.thinking_node_id as string) ?? null,
    artifactType: row.artifact_type as ReasoningArtifactTypeDB,
    title: (row.title as string | null) ?? null,
    content: row.content as string,
    snapshot: (row.snapshot as Record<string, unknown>) ?? {},
    topicTags: (row.topic_tags as string[]) ?? [],
    importanceScore: row.importance_score as number,
    sourceConfidence: (row.source_confidence as number | null) ?? null,
    embedding: (row.embedding as number[]) ?? null,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    createdBy: (row.created_by as string | null) ?? null,
  };
}

function mapSessionRehydrationRun(
  row: Record<string, unknown>
): SessionRehydrationRunRow {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    queryText: row.query_text as string,
    queryEmbedding: (row.query_embedding as number[]) ?? null,
    selectedArtifactIds: (row.selected_artifact_ids as string[]) ?? [],
    candidateCount: row.candidate_count as number,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
  };
}
