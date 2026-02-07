import { getSupabase } from "./client.js";

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

export interface ThinkingNode {
  id: string;
  sessionId: string;
  parentNodeId: string | null;
  reasoning: string;
  structuredReasoning: Record<string, unknown>;
  confidenceScore: number | null;
  thinkingBudget: number | null;
  signature: string | null;
  inputQuery: string | null;
  tokenUsage: Record<string, unknown>;
  createdAt: Date;
}

export interface ReasoningEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface DecisionPoint {
  id: string;
  thinkingNodeId: string;
  stepNumber: number;
  description: string;
  chosenPath: string;
  alternatives: Array<{ path: string; reasonRejected: string }>;
  confidence: number | null;
  reasoningExcerpt: string | null;
  createdAt: Date;
}

export interface CreateThinkingNodeInput {
  sessionId: string;
  parentNodeId?: string;
  reasoning: string;
  structuredReasoning?: Record<string, unknown>;
  confidenceScore?: number;
  thinkingBudget?: number;
  signature?: string;
  inputQuery?: string;
  tokenUsage?: Record<string, unknown>;
}

export interface CreateReasoningEdgeInput {
  sourceId: string;
  targetId: string;
  edgeType: "influences" | "contradicts" | "supports" | "supersedes" | "refines";
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateDecisionPointInput {
  thinkingNodeId: string;
  stepNumber: number;
  description: string;
  chosenPath: string;
  alternatives?: Array<{ path: string; reasonRejected: string }>;
  confidence?: number;
  reasoningExcerpt?: string;
}

export interface GraphTraversalResult {
  nodeId: string;
  reasoning: string;
  confidenceScore: number | null;
  edgeType: string;
  hopDistance: number;
}

export interface SessionReasoningContext {
  nodeId: string;
  reasoning: string;
  confidenceScore: number | null;
  decisionCount: number;
  inputQuery: string | null;
  createdAt: Date;
}

export interface ReasoningSearchResult {
  nodeId: string;
  reasoning: string;
  confidenceScore: number | null;
  rank: number;
}

export interface ReasoningChainNode {
  nodeId: string;
  reasoning: string;
  confidenceScore: number | null;
  chainPosition: number;
}

// ============================================================
// Thinking Node CRUD
// ============================================================

/**
 * Create a new thinking node
 */
export async function createThinkingNode(
  input: CreateThinkingNodeInput
): Promise<ThinkingNode> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("thinking_nodes")
    .insert({
      session_id: input.sessionId,
      parent_node_id: input.parentNodeId ?? null,
      reasoning: input.reasoning,
      structured_reasoning: input.structuredReasoning ?? {},
      confidence_score: input.confidenceScore ?? null,
      thinking_budget: input.thinkingBudget ?? null,
      signature: input.signature ?? null,
      input_query: input.inputQuery ?? null,
      token_usage: input.tokenUsage ?? {},
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create thinking node");
  }

  return mapThinkingNode(data);
}

/**
 * Get a thinking node by ID
 */
export async function getThinkingNode(id: string): Promise<ThinkingNode | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("thinking_nodes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    handleSupabaseError(error, "Failed to get thinking node");
  }

  return mapThinkingNode(data);
}

/**
 * Get all thinking nodes for a session
 */
export async function getSessionThinkingNodes(
  sessionId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ThinkingNode[]> {
  const supabase = getSupabase();
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from("thinking_nodes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    handleSupabaseError(error, "Failed to get session thinking nodes");
  }

  return (data ?? []).map(mapThinkingNode);
}

/**
 * Get the first (earliest) thinking node for each of the given session IDs.
 * Single query to avoid N+1 when loading display names for session lists.
 */
export async function getFirstNodePerSessions(
  sessionIds: string[]
): Promise<Map<string, ThinkingNode>> {
  if (sessionIds.length === 0) return new Map();

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("thinking_nodes")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });

  if (error) {
    handleSupabaseError(error, "Failed to get first nodes per session");
  }

  // Group by session_id, taking the first (earliest) node per session
  const result = new Map<string, ThinkingNode>();
  for (const row of data ?? []) {
    const node = mapThinkingNode(row);
    if (!result.has(node.sessionId)) {
      result.set(node.sessionId, node);
    }
  }

  return result;
}

/**
 * Get the most recent thinking node for a session
 */
export async function getLatestThinkingNode(
  sessionId: string
): Promise<ThinkingNode | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("thinking_nodes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    handleSupabaseError(error, "Failed to get latest thinking node");
  }

  return mapThinkingNode(data);
}

// ============================================================
// Reasoning Edge CRUD
// ============================================================

/**
 * Create a reasoning edge between two nodes
 */
export async function createReasoningEdge(
  input: CreateReasoningEdgeInput
): Promise<ReasoningEdge> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("reasoning_edges")
    .insert({
      source_id: input.sourceId,
      target_id: input.targetId,
      edge_type: input.edgeType,
      weight: input.weight ?? 1.0,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create reasoning edge");
  }

  return mapReasoningEdge(data);
}

/**
 * Get edges from a source node
 */
export async function getEdgesFromNode(
  sourceId: string
): Promise<ReasoningEdge[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("reasoning_edges")
    .select("*")
    .eq("source_id", sourceId);

  if (error) {
    handleSupabaseError(error, "Failed to get edges from node");
  }

  return (data ?? []).map(mapReasoningEdge);
}

/**
 * Get edges to a target node
 */
export async function getEdgesToNode(
  targetId: string
): Promise<ReasoningEdge[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("reasoning_edges")
    .select("*")
    .eq("target_id", targetId);

  if (error) {
    handleSupabaseError(error, "Failed to get edges to node");
  }

  return (data ?? []).map(mapReasoningEdge);
}

// ============================================================
// Decision Point CRUD
// ============================================================

/**
 * Create a decision point
 */
export async function createDecisionPoint(
  input: CreateDecisionPointInput
): Promise<DecisionPoint> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("decision_points")
    .insert({
      thinking_node_id: input.thinkingNodeId,
      step_number: input.stepNumber,
      description: input.description,
      chosen_path: input.chosenPath,
      alternatives: input.alternatives ?? [],
      confidence: input.confidence ?? null,
      reasoning_excerpt: input.reasoningExcerpt ?? null,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create decision point");
  }

  return mapDecisionPoint(data);
}

/**
 * Get decision points for a thinking node
 */
export async function getDecisionPoints(
  thinkingNodeId: string
): Promise<DecisionPoint[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("decision_points")
    .select("*")
    .eq("thinking_node_id", thinkingNodeId)
    .order("step_number", { ascending: true });

  if (error) {
    handleSupabaseError(error, "Failed to get decision points");
  }

  return (data ?? []).map(mapDecisionPoint);
}

/**
 * Create multiple decision points at once
 */
export async function createDecisionPoints(
  inputs: CreateDecisionPointInput[]
): Promise<DecisionPoint[]> {
  if (inputs.length === 0) return [];

  const supabase = getSupabase();

  const insertData = inputs.map((input) => ({
    thinking_node_id: input.thinkingNodeId,
    step_number: input.stepNumber,
    description: input.description,
    chosen_path: input.chosenPath,
    alternatives: input.alternatives ?? [],
    confidence: input.confidence ?? null,
    reasoning_excerpt: input.reasoningExcerpt ?? null,
  }));

  const { data, error } = await supabase
    .from("decision_points")
    .insert(insertData)
    .select();

  if (error) {
    handleSupabaseError(error, "Failed to create decision points");
  }

  return (data ?? []).map(mapDecisionPoint);
}

// ============================================================
// Graph Traversal (RPC functions)
// ============================================================

/**
 * Traverse the reasoning graph from a starting node
 */
export async function traverseReasoningGraph(
  startNodeId: string,
  options: {
    maxDepth?: number;
    edgeTypes?: string[];
  } = {}
): Promise<GraphTraversalResult[]> {
  const supabase = getSupabase();
  const { maxDepth = 3, edgeTypes = ["influences", "supports", "refines"] } = options;

  const { data, error } = await supabase.rpc("traverse_reasoning_graph", {
    start_node_id: startNodeId,
    max_depth: maxDepth,
    edge_types: edgeTypes,
  });

  if (error) {
    handleSupabaseError(error, "Failed to traverse reasoning graph");
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    nodeId: row.node_id as string,
    reasoning: row.reasoning as string,
    confidenceScore: row.confidence_score as number | null,
    edgeType: row.edge_type as string,
    hopDistance: row.hop_distance as number,
  }));
}

/**
 * Get session reasoning context for metacognition
 */
export async function getSessionReasoningContext(
  sessionId: string,
  limit = 20
): Promise<SessionReasoningContext[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("get_session_reasoning_context", {
    p_session_id: sessionId,
    node_limit: limit,
  });

  if (error) {
    handleSupabaseError(error, "Failed to get session reasoning context");
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    nodeId: row.node_id as string,
    reasoning: row.reasoning as string,
    confidenceScore: row.confidence_score as number | null,
    decisionCount: Number(row.decision_count),
    inputQuery: row.input_query as string | null,
    createdAt: new Date(row.created_at as string),
  }));
}

/**
 * Search reasoning nodes by text
 */
export async function searchReasoningNodes(
  query: string,
  options: {
    sessionId?: string;
    limit?: number;
  } = {}
): Promise<ReasoningSearchResult[]> {
  const supabase = getSupabase();
  const { sessionId, limit = 10 } = options;

  const { data, error } = await supabase.rpc("search_reasoning_nodes", {
    search_query: query,
    p_session_id: sessionId ?? null,
    result_limit: limit,
  });

  if (error) {
    handleSupabaseError(error, "Failed to search reasoning nodes");
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    nodeId: row.node_id as string,
    reasoning: row.reasoning as string,
    confidenceScore: row.confidence_score as number | null,
    rank: row.rank as number,
  }));
}

/**
 * Get the full reasoning chain from root to a node
 */
export async function getReasoningChain(
  targetNodeId: string
): Promise<ReasoningChainNode[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("get_reasoning_chain", {
    target_node_id: targetNodeId,
  });

  if (error) {
    handleSupabaseError(error, "Failed to get reasoning chain");
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    nodeId: row.node_id as string,
    reasoning: row.reasoning as string,
    confidenceScore: row.confidence_score as number | null,
    chainPosition: row.chain_position as number,
  }));
}

// ============================================================
// Mappers
// ============================================================

function mapThinkingNode(row: Record<string, unknown>): ThinkingNode {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    parentNodeId: row.parent_node_id as string | null,
    reasoning: row.reasoning as string,
    structuredReasoning: (row.structured_reasoning as Record<string, unknown>) ?? {},
    confidenceScore: row.confidence_score as number | null,
    thinkingBudget: row.thinking_budget as number | null,
    signature: row.signature as string | null,
    inputQuery: row.input_query as string | null,
    tokenUsage: (row.token_usage as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
  };
}

function mapReasoningEdge(row: Record<string, unknown>): ReasoningEdge {
  return {
    id: row.id as string,
    sourceId: row.source_id as string,
    targetId: row.target_id as string,
    edgeType: row.edge_type as string,
    weight: row.weight as number,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
  };
}

function mapDecisionPoint(row: Record<string, unknown>): DecisionPoint {
  return {
    id: row.id as string,
    thinkingNodeId: row.thinking_node_id as string,
    stepNumber: row.step_number as number,
    description: row.description as string,
    chosenPath: row.chosen_path as string,
    alternatives: (row.alternatives as Array<{ path: string; reasonRejected: string }>) ?? [],
    confidence: row.confidence as number | null,
    reasoningExcerpt: row.reasoning_excerpt as string | null,
    createdAt: new Date(row.created_at as string),
  };
}
