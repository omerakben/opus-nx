import { getSupabase } from "./client.js";

// Knowledge entry types
export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  source?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeSearchResult extends KnowledgeEntry {
  similarity: number;
}

export interface CreateKnowledgeInput {
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  source?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new knowledge entry with embedding
 */
export async function createKnowledgeEntry(
  input: CreateKnowledgeInput,
  embedding: number[]
): Promise<KnowledgeEntry> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("knowledge_entries")
    .insert({
      title: input.title,
      content: input.content,
      category: input.category,
      subcategory: input.subcategory,
      source: input.source,
      source_url: input.sourceUrl,
      metadata: input.metadata ?? {},
      embedding,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create knowledge entry: ${error.message}`);
  }

  return mapKnowledgeEntry(data);
}

/**
 * Semantic search for knowledge entries
 */
export async function searchKnowledge(
  queryEmbedding: number[],
  options: {
    threshold?: number;
    limit?: number;
    category?: string;
  } = {}
): Promise<KnowledgeSearchResult[]> {
  const supabase = getSupabase();
  const { threshold = 0.7, limit = 10, category } = options;

  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_category: category ?? null,
  });

  if (error) {
    throw new Error(`Failed to search knowledge: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    category: row.category as string,
    similarity: row.similarity as number,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

/**
 * Create a relation between two knowledge entries
 */
export async function createKnowledgeRelation(
  sourceId: string,
  targetId: string,
  relationType: string,
  weight = 1.0
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.from("knowledge_relations").insert({
    source_id: sourceId,
    target_id: targetId,
    relation_type: relationType,
    weight,
  });

  if (error) {
    throw new Error(`Failed to create knowledge relation: ${error.message}`);
  }
}

/**
 * Get related knowledge entries via graph traversal
 */
export async function getRelatedKnowledge(
  entryId: string,
  depth = 1
): Promise<
  Array<{
    id: string;
    title: string;
    relationType: string;
    weight: number;
    hopDistance: number;
  }>
> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("get_related_knowledge", {
    entry_id: entryId,
    depth,
  });

  if (error) {
    throw new Error(`Failed to get related knowledge: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    relationType: row.relation_type as string,
    weight: row.relation_weight as number,
    hopDistance: row.hop_distance as number,
  }));
}

/**
 * Get a knowledge entry by ID
 */
export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("knowledge_entries")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get knowledge entry: ${error.message}`);
  }

  return mapKnowledgeEntry(data);
}

/**
 * List knowledge entries by category
 */
export async function listKnowledgeByCategory(
  category: string,
  options: { limit?: number; offset?: number } = {}
): Promise<KnowledgeEntry[]> {
  const supabase = getSupabase();
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from("knowledge_entries")
    .select("*")
    .eq("category", category)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list knowledge: ${error.message}`);
  }

  return (data ?? []).map(mapKnowledgeEntry);
}

// Helper to map database row to KnowledgeEntry
function mapKnowledgeEntry(row: Record<string, unknown>): KnowledgeEntry {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    category: row.category as string,
    subcategory: row.subcategory as string | undefined,
    source: row.source as string | undefined,
    sourceUrl: row.source_url as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
