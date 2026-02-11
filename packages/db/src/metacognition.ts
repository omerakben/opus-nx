import { getSupabase } from "./client.js";

// ============================================================
// String Utilities
// ============================================================

/**
 * Escape SQL LIKE pattern special characters to prevent injection
 * Characters: % (wildcard), _ (single char), \ (escape)
 */
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

// ============================================================
// Error Handling Utilities
// ============================================================

/**
 * Check if an error is a Supabase "not found" error (PGRST116)
 */
function isNotFoundError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "PGRST116"
  );
}

/**
 * Handle Supabase errors with consistent formatting
 */
function handleSupabaseError(error: unknown, context: string): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

// ============================================================
// Types
// ============================================================

export type InsightType = "bias_detection" | "pattern" | "improvement_hypothesis";

export interface EvidenceItem {
  nodeId: string;
  excerpt: string;
  relevance: number;
}

export interface MetacognitiveInsight {
  id: string;
  sessionId: string | null;
  thinkingNodesAnalyzed: string[];
  insightType: InsightType;
  insight: string;
  evidence: EvidenceItem[];
  confidence: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateMetacognitiveInsightInput {
  sessionId?: string | null;
  thinkingNodesAnalyzed: string[];
  insightType: InsightType;
  insight: string;
  evidence?: EvidenceItem[];
  confidence: number;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Create Operations
// ============================================================

/**
 * Create a new metacognitive insight
 */
export async function createMetacognitiveInsight(
  input: CreateMetacognitiveInsightInput
): Promise<MetacognitiveInsight> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("metacognitive_insights")
    .insert({
      session_id: input.sessionId ?? null,
      thinking_nodes_analyzed: input.thinkingNodesAnalyzed,
      insight_type: input.insightType,
      insight: input.insight,
      evidence: input.evidence ?? [],
      confidence: input.confidence,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create metacognitive insight");
  }

  return mapMetacognitiveInsight(data);
}

/**
 * Create multiple insights at once (batch insert)
 */
export async function createMetacognitiveInsights(
  inputs: CreateMetacognitiveInsightInput[]
): Promise<MetacognitiveInsight[]> {
  if (inputs.length === 0) return [];

  const supabase = getSupabase();

  const insertData = inputs.map((input) => ({
    session_id: input.sessionId ?? null,
    thinking_nodes_analyzed: input.thinkingNodesAnalyzed,
    insight_type: input.insightType,
    insight: input.insight,
    evidence: input.evidence ?? [],
    confidence: input.confidence,
    metadata: input.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from("metacognitive_insights")
    .insert(insertData)
    .select();

  if (error) {
    handleSupabaseError(error, "Failed to create metacognitive insights batch");
  }

  return (data ?? []).map(mapMetacognitiveInsight);
}

// ============================================================
// Read Operations
// ============================================================

/**
 * Get a metacognitive insight by ID
 */
export async function getMetacognitiveInsight(
  id: string
): Promise<MetacognitiveInsight | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("metacognitive_insights")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    handleSupabaseError(error, "Failed to get metacognitive insight");
  }

  return mapMetacognitiveInsight(data);
}

/**
 * Get all insights for a session
 */
export async function getSessionInsights(
  sessionId: string,
  options: {
    limit?: number;
    types?: InsightType[];
    minConfidence?: number;
  } = {}
): Promise<MetacognitiveInsight[]> {
  const supabase = getSupabase();
  const { limit = 50, types, minConfidence } = options;

  let query = supabase
    .from("metacognitive_insights")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (types && types.length > 0) {
    query = query.in("insight_type", types);
  }

  if (minConfidence !== undefined) {
    query = query.gte("confidence", minConfidence);
  }

  const { data, error } = await query;

  if (error) {
    handleSupabaseError(error, "Failed to get session insights");
  }

  return (data ?? []).map(mapMetacognitiveInsight);
}

/**
 * Get insights filtered by type
 */
export async function getInsightsByType(
  insightType: InsightType,
  options: {
    limit?: number;
    minConfidence?: number;
    sessionId?: string;
  } = {}
): Promise<MetacognitiveInsight[]> {
  const supabase = getSupabase();
  const { limit = 50, minConfidence, sessionId } = options;

  let query = supabase
    .from("metacognitive_insights")
    .select("*")
    .eq("insight_type", insightType)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (minConfidence !== undefined) {
    query = query.gte("confidence", minConfidence);
  }

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query;

  if (error) {
    handleSupabaseError(error, "Failed to get insights by type");
  }

  return (data ?? []).map(mapMetacognitiveInsight);
}

/**
 * Get recent insights across all sessions
 */
export async function getRecentInsights(
  options: {
    limit?: number;
    since?: Date;
    types?: InsightType[];
  } = {}
): Promise<MetacognitiveInsight[]> {
  const supabase = getSupabase();
  const { limit = 20, since, types } = options;

  let query = supabase
    .from("metacognitive_insights")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gte("created_at", since.toISOString());
  }

  if (types && types.length > 0) {
    query = query.in("insight_type", types);
  }

  const { data, error } = await query;

  if (error) {
    handleSupabaseError(error, "Failed to get recent insights");
  }

  return (data ?? []).map(mapMetacognitiveInsight);
}

/**
 * Search insights by text content
 */
export async function searchInsights(
  query: string,
  options: {
    limit?: number;
    sessionId?: string;
  } = {}
): Promise<MetacognitiveInsight[]> {
  const supabase = getSupabase();
  const { limit = 10, sessionId } = options;

  let dbQuery = supabase
    .from("metacognitive_insights")
    .select("*")
    .textSearch("insight", query, { type: "websearch" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sessionId) {
    dbQuery = dbQuery.eq("session_id", sessionId);
  }

  const { data, error } = await dbQuery;

  if (error) {
    // Full-text search may fail if tsvector index is missing or query syntax is invalid
    // Fall back to ILIKE which is slower but always works
    console.warn(
      `[metacognition-db] Full-text search failed (${error.message}), falling back to ILIKE`
    );

    let fallbackQuery = supabase
      .from("metacognitive_insights")
      .select("*")
      .ilike("insight", `%${escapeLikePattern(query)}%`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (sessionId) {
      fallbackQuery = fallbackQuery.eq("session_id", sessionId);
    }

    const fallbackResult = await fallbackQuery;
    if (fallbackResult.error) {
      handleSupabaseError(
        fallbackResult.error,
        "Failed to search insights (both full-text and ILIKE failed)"
      );
    }
    return (fallbackResult.data ?? []).map((row) => {
      const insight = mapMetacognitiveInsight(row);
      return {
        ...insight,
        metadata: {
          ...insight.metadata,
          searchMode: "ilike_fallback",
          searchQuality: "degraded",
        },
      };
    });
  }

  return (data ?? []).map((row) => {
    const insight = mapMetacognitiveInsight(row);
    return {
      ...insight,
      metadata: {
        ...insight.metadata,
        searchMode: "full_text",
        searchQuality: "standard",
      },
    };
  });
}

/**
 * Get insights that reference a specific thinking node
 */
export async function getInsightsForNode(
  nodeId: string,
  options: { limit?: number } = {}
): Promise<MetacognitiveInsight[]> {
  const supabase = getSupabase();
  const { limit = 20 } = options;

  const { data, error } = await supabase
    .from("metacognitive_insights")
    .select("*")
    .contains("thinking_nodes_analyzed", [nodeId])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    handleSupabaseError(error, "Failed to get insights for node");
  }

  return (data ?? []).map(mapMetacognitiveInsight);
}

// ============================================================
// Aggregation Queries
// ============================================================

/**
 * Get insight counts by type for a session
 */
export async function getInsightCountsByType(
  sessionId?: string
): Promise<Record<InsightType, number>> {
  const supabase = getSupabase();

  const types: InsightType[] = ["bias_detection", "pattern", "improvement_hypothesis"];
  const counts: Record<InsightType, number> = {
    bias_detection: 0,
    pattern: 0,
    improvement_hypothesis: 0,
  };

  // Use SQL count aggregation instead of fetching all rows
  await Promise.all(
    types.map(async (type) => {
      let query = supabase
        .from("metacognitive_insights")
        .select("id", { count: "exact", head: true })
        .eq("insight_type", type);

      if (sessionId) {
        query = query.eq("session_id", sessionId);
      }

      const { count, error } = await query;

      if (error) {
        handleSupabaseError(error, "Failed to get insight counts");
      }

      if (count !== null) {
        counts[type] = count;
      }
    })
  );

  return counts;
}

/**
 * Get average confidence for insights, selecting only the confidence column.
 */
export async function getAverageInsightConfidence(sessionId?: string): Promise<number> {
  const supabase = getSupabase();
  let query = supabase.from("metacognitive_insights").select("confidence");
  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }
  const { data, error } = await query;
  if (error || !data || data.length === 0) return 0;
  return data.reduce((sum, r) => sum + (r as { confidence: number }).confidence, 0) / data.length;
}

// ============================================================
// Mapper
// ============================================================

function mapMetacognitiveInsight(row: Record<string, unknown>): MetacognitiveInsight {
  return {
    id: row.id as string,
    sessionId: row.session_id as string | null,
    thinkingNodesAnalyzed: (row.thinking_nodes_analyzed as string[]) ?? [],
    insightType: row.insight_type as InsightType,
    insight: row.insight as string,
    evidence: (row.evidence as EvidenceItem[]) ?? [],
    confidence: row.confidence as number,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
  };
}
