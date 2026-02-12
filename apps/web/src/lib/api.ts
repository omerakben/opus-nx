/**
 * Client-side API helpers for the Opus Nx dashboard.
 *
 * Opus 4.6 Cognitive Architecture:
 * - ThinkFork with human guidance per branch
 * - Branch steering (expand, merge, challenge, refork)
 * - Context compaction for infinite sessions
 */

// ============================================================
// Types
// ============================================================

export interface ApiError {
  message: string;
  code?: string;
  recoverable?: boolean;
  correlationId?: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// ============================================================
// Fetch Helpers
// ============================================================

async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        let parsedError: ApiError | undefined;
        try {
          const parsed = JSON.parse(errorBody);
          errorMessage = parsed.error?.message ?? parsed.message ?? errorMessage;
          parsedError = parsed.error
            ? {
                message: parsed.error.message ?? errorMessage,
                code: parsed.error.code ?? String(response.status),
                recoverable: parsed.error.recoverable,
                correlationId: parsed.error.correlationId,
                details: parsed.error.details,
              }
            : undefined;
        } catch {
          errorMessage = errorBody || errorMessage;
        }
        return {
          error: parsedError ?? { message: errorMessage, code: String(response.status) },
        };
      }

    const data = await response.json();
    return { data };
  } catch (err) {
    return {
      error: {
        message: err instanceof Error ? err.message : "Network error",
        code: "NETWORK_ERROR",
      },
    };
  }
}

// ============================================================
// Sessions API
// ============================================================

export interface Session {
  id: string;
  userId?: string;
  status: "active" | "completed" | "archived";
  currentPlan?: Record<string, unknown>;
  knowledgeContext?: string[];
  createdAt: string;
  updatedAt: string;
  /** Display name derived from first thinking query */
  displayName?: string | null;
  /** Whether this is a demo session seeded for showcase */
  isDemo?: boolean;
  /** Quality indicator for display name enrichment in sessions route */
  displayNameStatus?: "ok" | "degraded";
}

export async function getSessions(): Promise<ApiResponse<Session[]>> {
  return fetchApi<Session[]>("/api/sessions");
}

export async function createSession(): Promise<ApiResponse<Session>> {
  return fetchApi<Session>("/api/sessions", {
    method: "POST",
  });
}

export async function archiveSession(
  sessionId: string
): Promise<ApiResponse<Session>> {
  return fetchApi<Session>(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" }),
  });
}

export async function restoreSession(
  sessionId: string
): Promise<ApiResponse<Session>> {
  return fetchApi<Session>(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "active" }),
  });
}

export async function deleteSession(
  sessionId: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(`/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export interface SessionShareLink {
  shareUrl: string;
  expiresAt: string;
}

export async function createSessionShareLink(
  sessionId: string
): Promise<ApiResponse<SessionShareLink>> {
  return fetchApi<SessionShareLink>(`/api/sessions/${sessionId}/share`, {
    method: "POST",
  });
}

// ============================================================
// Thinking API
// ============================================================

export interface ThinkingRequest {
  query: string;
  sessionId?: string;
  effort?: "low" | "medium" | "high" | "max";
}

export interface ThinkingResponse {
  sessionId: string;
  nodeId: string;
  thinking: string;
  response: string;
  degraded?: boolean;
  degradation?: {
    persistenceIssues?: Array<{
      stage: string;
      message: string;
      stepNumber?: number;
    }>;
  };
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
  };
}

export async function startThinking(
  request: ThinkingRequest
): Promise<ApiResponse<ThinkingResponse>> {
  return fetchApi<ThinkingResponse>("/api/thinking", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================
// ThinkFork API
// ============================================================

export interface BranchGuidance {
  style: string;
  guidance: string;
}

export interface ForkRequest {
  query: string;
  sessionId?: string;
  styles?: string[];
  effort?: "low" | "medium" | "high" | "max";
  /** Human guidance per branch (cognitive co-piloting) */
  branchGuidance?: BranchGuidance[];
}

export interface ForkBranch {
  style: string;
  conclusion: string;
  confidence: number;
  keyInsights: string[];
  risks?: string[];
  opportunities?: string[];
  assumptions?: string[];
  error?: string;
}

export interface ForkResponse {
  query?: string;
  branches: ForkBranch[];
  convergencePoints: Array<{
    topic: string;
    agreementLevel: "full" | "partial" | "none";
    styles: string[];
    summary: string;
  }>;
  divergencePoints: Array<{
    topic: string;
    positions: Array<{ style: string; position: string; confidence: number }>;
    significance: "high" | "medium" | "low";
    recommendation?: string;
  }>;
  metaInsight: string;
  recommendedApproach?: {
    style: string;
    rationale: string;
    confidence: number;
  };
  appliedGuidance?: BranchGuidance[];
  analysisId?: string;
}

export async function runForkAnalysis(
  request: ForkRequest
): Promise<ApiResponse<ForkResponse>> {
  return fetchApi<ForkResponse>("/api/fork", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================
// Debate API
// ============================================================

export interface DebateRound {
  style: string;
  round: number;
  response: string;
  confidence: number;
  positionChanged: boolean;
  keyCounterpoints: string[];
  concessions: string[];
}

export interface DebateResponse {
  initialFork: ForkResponse;
  rounds: DebateRound[];
  finalPositions: Array<{
    style: string;
    conclusion: string;
    confidence: number;
    changedFromInitial: boolean;
  }>;
  consensus?: string;
  consensusConfidence?: number;
  totalRounds: number;
  totalTokensUsed: number;
  totalDurationMs: number;
  analysisId?: string;
}

export async function runDebateAnalysis(request: {
  query: string;
  sessionId?: string;
  styles?: string[];
  effort?: "low" | "medium" | "high" | "max";
  debateRounds?: number;
}): Promise<ApiResponse<DebateResponse>> {
  return fetchApi<DebateResponse>("/api/fork", {
    method: "POST",
    body: JSON.stringify({
      ...request,
      mode: "debate",
    }),
  });
}

// ============================================================
// Fork Steering API (Cognitive Co-Piloting)
// ============================================================

export type SteeringAction =
  | { action: "expand"; style: string; direction?: string }
  | { action: "merge"; styles: string[]; focusArea?: string }
  | { action: "challenge"; style: string; challenge: string }
  | { action: "refork"; newContext: string; keepOriginal?: boolean };

export interface SteeringResult {
  action: string;
  result: string;
  confidence: number;
  keyInsights: string[];
  synthesizedApproach?: string;
  expandedAnalysis?: string;
  challengeResponse?: string;
  tokensUsed: number;
  durationMs: number;
}

export async function steerForkAnalysis(
  originalResult: ForkResponse,
  action: SteeringAction,
  query?: string,
  analysisId?: string
): Promise<ApiResponse<SteeringResult>> {
  return fetchApi<SteeringResult>("/api/fork/steer", {
    method: "POST",
    body: JSON.stringify({ originalResult, action, query, analysisId }),
  });
}

// ============================================================
// Saved Fork Analyses API
// ============================================================

export interface SavedForkAnalysis {
  id: string;
  query: string;
  mode: "fork" | "debate";
  result: ForkResponse | DebateResponse;
  steeringHistory: SteeringResult[];
  createdAt: string;
}

export async function getSessionForkAnalyses(
  sessionId: string
): Promise<ApiResponse<{ analyses: SavedForkAnalysis[] }>> {
  return fetchApi<{ analyses: SavedForkAnalysis[] }>(`/api/fork?sessionId=${sessionId}`);
}

// ============================================================
// Insights API
// ============================================================

export interface Insight {
  id: string;
  sessionId: string | null;
  thinkingNodesAnalyzed: string[];
  insightType: "bias_detection" | "pattern" | "improvement_hypothesis";
  insight: string;
  evidence: Array<{
    nodeId: string;
    excerpt: string;
    relevance: number;
  }>;
  confidence: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function getSessionInsights(
  sessionId: string
): Promise<ApiResponse<Insight[]>> {
  return fetchApi<Insight[]>(`/api/insights?sessionId=${sessionId}`);
}

/**
 * Trigger metacognitive analysis for a session
 */
export interface InsightsAnalysisResult {
  insights: Insight[];
  nodesAnalyzed: number;
  summary: string | null;
  errors: string[];
  hallucinationCount: number;
  invalidNodeRefs: string[];
}

export async function runInsightsAnalysis(
  sessionId: string,
  options?: {
    nodeLimit?: number;
    focusAreas?: string[];
  }
): Promise<ApiResponse<InsightsAnalysisResult>> {
  return fetchApi<InsightsAnalysisResult>("/api/insights", {
    method: "POST",
    body: JSON.stringify({ sessionId, ...options }),
  });
}

export async function searchInsights(
  query: string,
  sessionId?: string
): Promise<ApiResponse<Insight[]>> {
  const params = new URLSearchParams({ q: query });
  if (sessionId) params.set("sessionId", sessionId);
  return fetchApi<Insight[]>(`/api/insights/search?${params}`);
}

export interface InsightStats {
  total: number;
  byType: Record<string, number>;
  averageConfidence: number;
}

export async function getInsightStats(
  sessionId?: string
): Promise<ApiResponse<InsightStats>> {
  const params = sessionId ? `?sessionId=${sessionId}` : "";
  return fetchApi<InsightStats>(`/api/insights/stats${params}`);
}

// ============================================================
// Thinking Nodes API
// ============================================================

export interface ThinkingNode {
  id: string;
  sessionId: string;
  parentNodeId: string | null;
  reasoning: string;
  /** Model's final output/response (the conclusion after thinking) */
  response: string | null;
  structuredReasoning: Record<string, unknown>;
  confidenceScore: number | null;
  tokenUsage: Record<string, unknown>;
  inputQuery: string | null;
  /** Node type: thinking, compaction, fork_branch, human_annotation */
  nodeType?: string;
  createdAt: string;
}

export interface ReasoningEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  weight: number;
  createdAt: string;
}

export async function getSessionNodes(
  sessionId: string,
  options?: { signal?: AbortSignal }
): Promise<ApiResponse<{ nodes: ThinkingNode[]; edges: ReasoningEdge[] }>> {
  return fetchApi<{ nodes: ThinkingNode[]; edges: ReasoningEdge[] }>(
    `/api/sessions/${sessionId}/nodes`,
    options?.signal ? { signal: options.signal } : undefined
  );
}

// ============================================================
// Swarm Hypothesis Experiments API
// ============================================================

export type SwarmHypothesisExperimentStatus =
  | "promoted"
  | "checkpointed"
  | "rerunning"
  | "comparing"
  | "retained"
  | "deferred"
  | "archived"
  | (string & {});

export type SwarmHypothesisRetentionDecision =
  | "retain"
  | "defer"
  | "archive"
  | (string & {});

export interface SwarmHypothesisExperiment {
  id: string;
  sessionId: string;
  hypothesisNodeId: string;
  promotedBy: string;
  alternativeSummary: string;
  status: SwarmHypothesisExperimentStatus;
  preferredRunId: string | null;
  rerunRunId: string | null;
  comparisonResult: Record<string, unknown> | null;
  retentionDecision: SwarmHypothesisRetentionDecision | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  lastUpdated: string;
}

export interface PersistenceCapabilities {
  configured: boolean;
  tables: Record<string, boolean>;
  rpc: Record<string, boolean>;
  lifecycleReady: boolean;
  rehydrationReady: boolean;
  probedAt?: string;
}

export interface RehydrationTelemetryDto {
  phase:
    | "embed_generation"
    | "semantic_search"
    | "candidate_selection"
    | "rehydration_audit_write";
  durationMs: number;
  success?: boolean;
  artifactCandidates?: number;
  hypothesisCandidates?: number;
  selectedCandidates?: number;
}

export interface SwarmHypothesisLifecycleInfo {
  degradedMode: boolean;
  degradedReason: string | null;
  capabilities?: PersistenceCapabilities | null;
  compareCompletionRate: number;
  retentionRatio: {
    retain: number;
    defer: number;
    archive: number;
  };
  compareRequests: number;
  compareCompleted: number;
}

export async function getSwarmHypothesisExperiments(
  sessionId: string
): Promise<ApiResponse<{ experiments: SwarmHypothesisExperiment[]; lifecycle: SwarmHypothesisLifecycleInfo | null }>> {
  return fetchApi<{ experiments: SwarmHypothesisExperiment[]; lifecycle: SwarmHypothesisLifecycleInfo | null }>(
    `/api/swarm/${encodeURIComponent(sessionId)}/experiments`
  );
}

export interface RetainSwarmHypothesisRequest {
  decision: SwarmHypothesisRetentionDecision;
  performedBy?: string;
}

export async function retainSwarmHypothesis(
  experimentId: string,
  request: RetainSwarmHypothesisRequest
): Promise<ApiResponse<{ experiment: SwarmHypothesisExperiment }>> {
  return fetchApi<{ experiment: SwarmHypothesisExperiment }>(
    `/api/swarm/experiments/${encodeURIComponent(experimentId)}/retain`,
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );
}

export interface CompareSwarmHypothesisRequest {
  performedBy?: string;
  rerunIfMissing?: boolean;
  forceRerun?: boolean;
  nodeId?: string;
  correction?: string;
}

export interface CompareSwarmHypothesisResponse {
  status: "comparison_ready" | "compare_started";
  experimentId: string;
  comparisonResult?: Record<string, unknown>;
  nodeId?: string;
  mode?: string;
}

export async function compareSwarmHypothesis(
  experimentId: string,
  request: CompareSwarmHypothesisRequest
): Promise<ApiResponse<CompareSwarmHypothesisResponse>> {
  return fetchApi<CompareSwarmHypothesisResponse>(
    `/api/swarm/experiments/${encodeURIComponent(experimentId)}/compare`,
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );
}

// ============================================================
// Checkpoint API (Human-in-the-Loop Reasoning Correction)
// ============================================================

export type CheckpointVerdict = "verified" | "questionable" | "disagree";

export interface CheckpointRequest {
  verdict: CheckpointVerdict;
  correction?: string;
}

export interface CheckpointAnnotation {
  id: string;
  verdict: CheckpointVerdict;
  correction: string | null;
  createdAt: string;
}

export interface AlternativeBranch {
  nodeId: string;
  reasoning: string;
  confidence: number;
}

export interface CheckpointResponse {
  annotation: CheckpointAnnotation;
  alternativeBranch: AlternativeBranch | null;
}

/**
 * Create a human checkpoint on a reasoning node.
 *
 * This enables human-in-the-loop reasoning correction:
 * - Verify: Mark a step as correct
 * - Questionable: Flag for review
 * - Disagree: Provide correction and trigger re-reasoning
 */
export async function createCheckpoint(
  nodeId: string,
  request: CheckpointRequest
): Promise<ApiResponse<CheckpointResponse>> {
  return fetchApi<CheckpointResponse>(`/api/reasoning/${nodeId}/checkpoint`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================
// Reasoning Detail API
// ============================================================

export interface ReasoningStep {
  stepNumber: number;
  content: string;
  type?: "analysis" | "hypothesis" | "evaluation" | "conclusion" | "consideration";
}

export interface DecisionPointDetail {
  id: string;
  thinkingNodeId: string;
  stepNumber: number;
  description: string;
  chosenPath: string;
  alternatives: Array<{ path: string; reasonRejected: string }>;
  confidence?: number;
  reasoningExcerpt?: string;
  createdAt: string;
}

export interface ReasoningDetailResponse {
  node: {
    id: string;
    sessionId: string;
    parentNodeId: string | null;
    reasoning: string;
    response: string | null;
    structuredReasoning: {
      steps: ReasoningStep[];
      decisionPoints: Array<{
        stepNumber: number;
        description: string;
        chosenPath: string;
        alternatives: Array<{ path: string; reasonRejected: string }>;
        confidence?: number;
        reasoningExcerpt?: string;
      }>;
      mainConclusion?: string;
      confidenceFactors?: string[];
      alternativesConsidered: number;
    };
    confidenceScore: number | null;
    tokenUsage: { inputTokens?: number; outputTokens?: number; thinkingTokens?: number };
    inputQuery: string | null;
    nodeType?: string;
    createdAt: string;
  };
  decisionPoints: DecisionPointDetail[];
  related: {
    incomingEdges: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      edgeType: string;
      weight: number;
      createdAt: string;
    }>;
    outgoingEdges: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      edgeType: string;
      weight: number;
      createdAt: string;
    }>;
  };
}

export async function getReasoningDetail(
  nodeId: string
): Promise<ApiResponse<ReasoningDetailResponse>> {
  return fetchApi<ReasoningDetailResponse>(`/api/reasoning/${nodeId}`);
}

// ============================================================
// Reasoning Search API
// ============================================================

export interface ReasoningSearchResult {
  nodeId: string;
  reasoning: string;
  confidenceScore: number | null;
  rank: number;
}

export async function searchReasoning(
  sessionId: string,
  query: string
): Promise<ApiResponse<{ results: ReasoningSearchResult[] }>> {
  return fetchApi<{ results: ReasoningSearchResult[] }>(
    `/api/reasoning/search?sessionId=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(query)}`
  );
}
