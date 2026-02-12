import { getSupabase } from "./client.js";
import { throwSupabaseError } from "./supabase-error.js";

// ============================================================
// Types
// ============================================================

export type ReasoningStepTypeDB =
  | "analysis"
  | "hypothesis"
  | "evaluation"
  | "conclusion"
  | "consideration";

export type HypothesisStatusDB =
  | "proposed"
  | "tested"
  | "supported"
  | "rejected"
  | "superseded";

export interface StructuredReasoningStepRow {
  id: string;
  thinkingNodeId: string;
  stepNumber: number;
  stepType: ReasoningStepTypeDB;
  content: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface StructuredReasoningHypothesisRow {
  id: string;
  stepId: string;
  thinkingNodeId: string;
  hypothesisText: string;
  hypothesisTextHash: string | null;
  status: HypothesisStatusDB;
  confidence: number | null;
  evidence: unknown[];
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface StructuredReasoningHypothesisSearchResult {
  hypothesisId: string;
  thinkingNodeId: string;
  stepId: string;
  hypothesisText: string;
  status: HypothesisStatusDB;
  confidence: number | null;
  createdAt: Date;
  rank: number;
}

export interface StructuredReasoningHypothesisSemanticMatch {
  hypothesisId: string;
  sessionId: string;
  thinkingNodeId: string;
  stepId: string;
  hypothesisText: string;
  hypothesisTextHash: string | null;
  status: HypothesisStatusDB;
  confidence: number | null;
  createdAt: Date;
  importanceScore: number;
  retainedPolicyBonus: number;
  similarity: number;
}

export interface CreateStructuredReasoningStepInput {
  thinkingNodeId: string;
  stepNumber: number;
  stepType: ReasoningStepTypeDB;
  content: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateStructuredReasoningHypothesisInput {
  stepId: string;
  thinkingNodeId: string;
  hypothesisText: string;
  status?: HypothesisStatusDB;
  confidence?: number;
  evidence?: unknown[];
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

// ============================================================
// Error Handling
// ============================================================

function handleSupabaseError(error: unknown, context: string): never {
  throwSupabaseError(error, context);
}

// ============================================================
// Structured Reasoning Steps
// ============================================================

export async function createStructuredReasoningStep(
  input: CreateStructuredReasoningStepInput
): Promise<StructuredReasoningStepRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("structured_reasoning_steps")
    .insert({
      thinking_node_id: input.thinkingNodeId,
      step_number: input.stepNumber,
      step_type: input.stepType,
      content: input.content,
      confidence: input.confidence ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create structured reasoning step");
  }

  return mapStructuredReasoningStep(data);
}

export async function createStructuredReasoningSteps(
  inputs: CreateStructuredReasoningStepInput[]
): Promise<StructuredReasoningStepRow[]> {
  if (inputs.length === 0) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("structured_reasoning_steps")
    .insert(
      inputs.map((input) => ({
        thinking_node_id: input.thinkingNodeId,
        step_number: input.stepNumber,
        step_type: input.stepType,
        content: input.content,
        confidence: input.confidence ?? null,
        metadata: input.metadata ?? {},
      }))
    )
    .select();

  if (error) {
    handleSupabaseError(error, "Failed to create structured reasoning steps");
  }

  return (data ?? []).map(mapStructuredReasoningStep);
}

export async function getThinkingNodeStructuredReasoningSteps(
  thinkingNodeId: string
): Promise<StructuredReasoningStepRow[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("structured_reasoning_steps")
    .select("*")
    .eq("thinking_node_id", thinkingNodeId)
    .order("step_number", { ascending: true });

  if (error) {
    handleSupabaseError(error, "Failed to get structured reasoning steps");
  }

  return (data ?? []).map(mapStructuredReasoningStep);
}

// ============================================================
// Structured Hypotheses
// ============================================================

export async function createStructuredReasoningHypothesis(
  input: CreateStructuredReasoningHypothesisInput
): Promise<StructuredReasoningHypothesisRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("structured_reasoning_hypotheses")
    .insert({
      step_id: input.stepId,
      thinking_node_id: input.thinkingNodeId,
      hypothesis_text: input.hypothesisText,
      status: input.status ?? "proposed",
      confidence: input.confidence ?? null,
      evidence: input.evidence ?? [],
      embedding: input.embedding ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create structured reasoning hypothesis");
  }

  return mapStructuredReasoningHypothesis(data);
}

export async function createStructuredReasoningHypotheses(
  inputs: CreateStructuredReasoningHypothesisInput[]
): Promise<StructuredReasoningHypothesisRow[]> {
  if (inputs.length === 0) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("structured_reasoning_hypotheses")
    .insert(
      inputs.map((input) => ({
        step_id: input.stepId,
        thinking_node_id: input.thinkingNodeId,
        hypothesis_text: input.hypothesisText,
        status: input.status ?? "proposed",
        confidence: input.confidence ?? null,
        evidence: input.evidence ?? [],
        embedding: input.embedding ?? null,
        metadata: input.metadata ?? {},
      }))
    )
    .select();

  if (error) {
    handleSupabaseError(error, "Failed to create structured reasoning hypotheses");
  }

  return (data ?? []).map(mapStructuredReasoningHypothesis);
}

export async function getThinkingNodeStructuredReasoningHypotheses(
  thinkingNodeId: string
): Promise<StructuredReasoningHypothesisRow[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("structured_reasoning_hypotheses")
    .select("*")
    .eq("thinking_node_id", thinkingNodeId)
    .order("created_at", { ascending: false });

  if (error) {
    handleSupabaseError(error, "Failed to get structured reasoning hypotheses");
  }

  return (data ?? []).map(mapStructuredReasoningHypothesis);
}

export async function updateStructuredReasoningHypothesisStatus(
  hypothesisId: string,
  status: HypothesisStatusDB
): Promise<StructuredReasoningHypothesisRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("structured_reasoning_hypotheses")
    .update({ status })
    .eq("id", hypothesisId)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to update structured reasoning hypothesis status");
  }

  return mapStructuredReasoningHypothesis(data);
}

export async function updateStructuredReasoningHypothesisEmbedding(
  hypothesisId: string,
  embedding: number[]
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("structured_reasoning_hypotheses")
    .update({ embedding })
    .eq("id", hypothesisId);

  if (error) {
    handleSupabaseError(error, "Failed to update structured reasoning hypothesis embedding");
  }
}

export async function searchStructuredReasoningHypotheses(
  query: string,
  options: {
    sessionId?: string;
    status?: HypothesisStatusDB;
    limit?: number;
  } = {}
): Promise<StructuredReasoningHypothesisSearchResult[]> {
  const supabase = getSupabase();
  const { sessionId, status, limit = 20 } = options;

  const { data, error } = await supabase.rpc("search_structured_reasoning_hypotheses", {
    search_query: query,
    p_session_id: sessionId ?? null,
    p_status: status ?? null,
    result_limit: limit,
  });

  if (error) {
    handleSupabaseError(error, "Failed to search structured reasoning hypotheses");
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    hypothesisId: row.hypothesis_id as string,
    thinkingNodeId: row.thinking_node_id as string,
    stepId: row.step_id as string,
    hypothesisText: row.hypothesis_text as string,
    status: row.status as HypothesisStatusDB,
    confidence: row.confidence as number | null,
    createdAt: new Date(row.created_at as string),
    rank: Number(row.rank),
  }));
}

export async function matchStructuredReasoningHypotheses(
  queryEmbedding: number[],
  options: {
    threshold?: number;
    limit?: number;
    sessionId?: string;
    status?: HypothesisStatusDB;
  } = {}
): Promise<StructuredReasoningHypothesisSemanticMatch[]> {
  const supabase = getSupabase();
  const { threshold = 0.65, limit = 10, sessionId, status } = options;

  const { data, error } = await supabase.rpc("match_structured_reasoning_hypotheses", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_session_id: sessionId ?? null,
    filter_status: status ?? null,
  });

  if (error) {
    handleSupabaseError(error, "Failed to semantically match structured reasoning hypotheses");
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    hypothesisId: row.hypothesis_id as string,
    sessionId: row.session_id as string,
    thinkingNodeId: row.thinking_node_id as string,
    stepId: row.step_id as string,
    hypothesisText: row.hypothesis_text as string,
    hypothesisTextHash: (row.hypothesis_text_hash as string | null) ?? null,
    status: row.status as HypothesisStatusDB,
    confidence: (row.confidence as number | null) ?? null,
    createdAt: new Date(row.created_at as string),
    importanceScore: Number(row.importance_score ?? 0),
    retainedPolicyBonus: Number(row.retained_policy_bonus ?? 0),
    similarity: Number(row.similarity ?? 0),
  }));
}

// ============================================================
// Mappers
// ============================================================

function mapStructuredReasoningStep(
  row: Record<string, unknown>
): StructuredReasoningStepRow {
  return {
    id: row.id as string,
    thinkingNodeId: row.thinking_node_id as string,
    stepNumber: row.step_number as number,
    stepType: row.step_type as ReasoningStepTypeDB,
    content: row.content as string,
    confidence: row.confidence as number | null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
  };
}

function mapStructuredReasoningHypothesis(
  row: Record<string, unknown>
): StructuredReasoningHypothesisRow {
  return {
    id: row.id as string,
    stepId: row.step_id as string,
    thinkingNodeId: row.thinking_node_id as string,
    hypothesisText: row.hypothesis_text as string,
    hypothesisTextHash: (row.hypothesis_text_hash as string | null) ?? null,
    status: row.status as HypothesisStatusDB,
    confidence: row.confidence as number | null,
    evidence: (row.evidence as unknown[]) ?? [],
    embedding: (row.embedding as number[] | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
  };
}
