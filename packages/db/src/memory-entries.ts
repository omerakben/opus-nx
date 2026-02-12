import { getSupabase } from "./client.js";
import { throwSupabaseError } from "./supabase-error.js";

// ============================================================
// Types
// ============================================================

export type MemoryTierDB = "main_context" | "recall_storage" | "archival_storage";
export type MemorySourceDB =
  | "user_input"
  | "thinking_node"
  | "decision_point"
  | "metacognitive"
  | "knowledge_base"
  | "compaction";

export interface MemoryEntryRow {
  id: string;
  sessionId: string;
  tier: MemoryTierDB;
  content: string;
  importance: number;
  source: MemorySourceDB;
  sourceId: string | null;
  tags: string[];
  accessCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
}

export interface CreateMemoryEntryInput {
  id?: string;
  sessionId: string;
  tier: MemoryTierDB;
  content: string;
  importance: number;
  source: MemorySourceDB;
  sourceId?: string;
  tags?: string[];
}

// ============================================================
// Error Handling
// ============================================================

function handleSupabaseError(error: unknown, context: string): never {
  throwSupabaseError(error, context);
}

// ============================================================
// Create Operations
// ============================================================

/**
 * Upsert a single memory entry (insert or update on conflict).
 */
export async function upsertMemoryEntry(
  input: CreateMemoryEntryInput
): Promise<MemoryEntryRow> {
  const supabase = getSupabase();

  const row: Record<string, unknown> = {
    session_id: input.sessionId,
    tier: input.tier,
    content: input.content,
    importance: input.importance,
    source: input.source,
    source_id: input.sourceId ?? null,
    tags: input.tags ?? [],
  };

  if (input.id) {
    row.id = input.id;
  }

  const { data, error } = await supabase
    .from("memory_entries")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to upsert memory entry");
  }

  return mapRow(data);
}

/**
 * Batch insert memory entries for a session.
 */
export async function batchInsertMemoryEntries(
  entries: CreateMemoryEntryInput[]
): Promise<MemoryEntryRow[]> {
  if (entries.length === 0) return [];

  const supabase = getSupabase();

  const rows = entries.map((input) => ({
    ...(input.id ? { id: input.id } : {}),
    session_id: input.sessionId,
    tier: input.tier,
    content: input.content,
    importance: input.importance,
    source: input.source,
    source_id: input.sourceId ?? null,
    tags: input.tags ?? [],
  }));

  const { data, error } = await supabase
    .from("memory_entries")
    .upsert(rows, { onConflict: "id" })
    .select();

  if (error) {
    handleSupabaseError(error, "Failed to batch insert memory entries");
  }

  return (data ?? []).map(mapRow);
}

// ============================================================
// Read Operations
// ============================================================

/**
 * Get all memory entries for a session, grouped by tier.
 */
export async function getSessionMemoryEntries(
  sessionId: string,
  options?: { tier?: MemoryTierDB; limit?: number }
): Promise<MemoryEntryRow[]> {
  const supabase = getSupabase();

  let query = supabase
    .from("memory_entries")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (options?.tier) {
    query = query.eq("tier", options.tier);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    handleSupabaseError(error, "Failed to get session memory entries");
  }

  return (data ?? []).map(mapRow);
}

// ============================================================
// Update Operations
// ============================================================

/**
 * Update the tier of a memory entry (used for eviction/promotion).
 */
export async function updateMemoryEntryTier(
  id: string,
  tier: MemoryTierDB
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("memory_entries")
    .update({ tier, last_accessed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    handleSupabaseError(error, "Failed to update memory entry tier");
  }
}

// ============================================================
// Delete Operations
// ============================================================

/**
 * Delete a memory entry by ID.
 */
export async function deleteMemoryEntry(id: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("memory_entries")
    .delete()
    .eq("id", id);

  if (error) {
    handleSupabaseError(error, "Failed to delete memory entry");
  }
}

/**
 * Delete all memory entries for a session.
 */
export async function deleteSessionMemoryEntries(
  sessionId: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("memory_entries")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    handleSupabaseError(error, "Failed to delete session memory entries");
  }
}

// ============================================================
// Mapper
// ============================================================

function mapRow(row: Record<string, unknown>): MemoryEntryRow {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    tier: row.tier as MemoryTierDB,
    content: row.content as string,
    importance: row.importance as number,
    source: row.source as MemorySourceDB,
    sourceId: (row.source_id as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    accessCount: (row.access_count as number) ?? 0,
    lastAccessedAt: new Date(row.last_accessed_at as string),
    createdAt: new Date(row.created_at as string),
  };
}
