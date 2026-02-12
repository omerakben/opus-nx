import { getSupabase } from "./client.js";
import { throwSupabaseError } from "./supabase-error.js";

// ============================================================
// Types
// ============================================================

export type HypothesisExperimentStatusDB =
  | "promoted"
  | "checkpointed"
  | "rerunning"
  | "comparing"
  | "retained"
  | "deferred"
  | "archived";

export type HypothesisRetentionDecisionDB = "retain" | "defer" | "archive";

export type HypothesisExperimentActionTypeDB =
  | "promote"
  | "checkpoint"
  | "rerun"
  | "compare"
  | "retain";

export interface HypothesisExperimentRow {
  id: string;
  sessionId: string;
  hypothesisNodeId: string;
  promotedBy: string;
  alternativeSummary: string;
  status: HypothesisExperimentStatusDB;
  preferredRunId: string | null;
  rerunRunId: string | null;
  comparisonResult: Record<string, unknown> | null;
  retentionDecision: HypothesisRetentionDecisionDB | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastUpdated: Date;
}

export interface HypothesisExperimentActionRow {
  id: string;
  experimentId: string;
  sessionId: string;
  action: HypothesisExperimentActionTypeDB;
  performedBy: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateHypothesisExperimentInput {
  sessionId: string;
  hypothesisNodeId: string;
  alternativeSummary: string;
  promotedBy?: string;
  status?: HypothesisExperimentStatusDB;
  preferredRunId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateHypothesisExperimentInput {
  status?: HypothesisExperimentStatusDB;
  preferredRunId?: string;
  rerunRunId?: string;
  comparisonResult?: Record<string, unknown>;
  retentionDecision?: HypothesisRetentionDecisionDB;
  metadata?: Record<string, unknown>;
}

export interface CreateHypothesisExperimentActionInput {
  experimentId: string;
  sessionId: string;
  action: HypothesisExperimentActionTypeDB;
  performedBy?: string;
  details?: Record<string, unknown>;
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
// Experiment CRUD
// ============================================================

export async function createHypothesisExperiment(
  input: CreateHypothesisExperimentInput
): Promise<HypothesisExperimentRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("hypothesis_experiments")
    .insert({
      session_id: input.sessionId,
      hypothesis_node_id: input.hypothesisNodeId,
      promoted_by: input.promotedBy ?? "human",
      alternative_summary: input.alternativeSummary,
      status: input.status ?? "promoted",
      preferred_run_id: input.preferredRunId ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create hypothesis experiment");
  }

  return mapHypothesisExperiment(data);
}

export async function getHypothesisExperiment(
  id: string
): Promise<HypothesisExperimentRow | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("hypothesis_experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    handleSupabaseError(error, "Failed to get hypothesis experiment");
  }

  return mapHypothesisExperiment(data);
}

export async function getSessionHypothesisExperiments(
  sessionId: string,
  options: {
    status?: HypothesisExperimentStatusDB;
    limit?: number;
  } = {}
): Promise<HypothesisExperimentRow[]> {
  const supabase = getSupabase();

  let query = supabase
    .from("hypothesis_experiments")
    .select("*")
    .eq("session_id", sessionId)
    .order("last_updated", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    handleSupabaseError(error, "Failed to get session hypothesis experiments");
  }

  return (data ?? []).map(mapHypothesisExperiment);
}

export async function updateHypothesisExperiment(
  id: string,
  input: UpdateHypothesisExperimentInput
): Promise<HypothesisExperimentRow> {
  const supabase = getSupabase();

  const payload: Record<string, unknown> = {};

  if (input.status !== undefined) payload.status = input.status;
  if (input.preferredRunId !== undefined) payload.preferred_run_id = input.preferredRunId;
  if (input.rerunRunId !== undefined) payload.rerun_run_id = input.rerunRunId;
  if (input.comparisonResult !== undefined) payload.comparison_result = input.comparisonResult;
  if (input.retentionDecision !== undefined) payload.retention_decision = input.retentionDecision;
  if (input.metadata !== undefined) payload.metadata = input.metadata;

  if (Object.keys(payload).length === 0) {
    throw new Error("updateHypothesisExperiment requires at least one field to update");
  }

  const { data, error } = await supabase
    .from("hypothesis_experiments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to update hypothesis experiment");
  }

  return mapHypothesisExperiment(data);
}

// ============================================================
// Experiment Actions
// ============================================================

export async function createHypothesisExperimentAction(
  input: CreateHypothesisExperimentActionInput
): Promise<HypothesisExperimentActionRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("hypothesis_experiment_actions")
    .insert({
      experiment_id: input.experimentId,
      session_id: input.sessionId,
      action: input.action,
      performed_by: input.performedBy ?? null,
      details: input.details ?? {},
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create hypothesis experiment action");
  }

  return mapHypothesisExperimentAction(data);
}

export async function getHypothesisExperimentActions(
  experimentId: string
): Promise<HypothesisExperimentActionRow[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("hypothesis_experiment_actions")
    .select("*")
    .eq("experiment_id", experimentId)
    .order("created_at", { ascending: true });

  if (error) {
    handleSupabaseError(error, "Failed to get hypothesis experiment actions");
  }

  return (data ?? []).map(mapHypothesisExperimentAction);
}

// ============================================================
// Mappers
// ============================================================

function mapHypothesisExperiment(
  row: Record<string, unknown>
): HypothesisExperimentRow {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    hypothesisNodeId: row.hypothesis_node_id as string,
    promotedBy: row.promoted_by as string,
    alternativeSummary: row.alternative_summary as string,
    status: row.status as HypothesisExperimentStatusDB,
    preferredRunId: (row.preferred_run_id as string | null) ?? null,
    rerunRunId: (row.rerun_run_id as string | null) ?? null,
    comparisonResult: (row.comparison_result as Record<string, unknown> | null) ?? null,
    retentionDecision: (row.retention_decision as HypothesisRetentionDecisionDB | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
    lastUpdated: new Date(row.last_updated as string),
  };
}

function mapHypothesisExperimentAction(
  row: Record<string, unknown>
): HypothesisExperimentActionRow {
  return {
    id: row.id as string,
    experimentId: row.experiment_id as string,
    sessionId: row.session_id as string,
    action: row.action as HypothesisExperimentActionTypeDB,
    performedBy: (row.performed_by as string | null) ?? null,
    details: (row.details as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
  };
}
