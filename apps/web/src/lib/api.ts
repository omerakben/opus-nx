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
}

export interface ForkResponse {
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
  }>;
  metaInsight: string;
  recommendedApproach?: {
    style: string;
    rationale: string;
    confidence: number;
  };
  appliedGuidance?: BranchGuidance[];
  fallbackPromptsUsed?: string[];
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
  action: SteeringAction
): Promise<ApiResponse<SteeringResult>> {
  return fetchApi<SteeringResult>("/api/fork/steer", {
    method: "POST",
    body: JSON.stringify({ originalResult, action }),
  });
}

// ============================================================
// Insights API
// ============================================================

export interface Insight {
  id: string;
  sessionId: string | null;
  insightType: "bias_detection" | "pattern" | "improvement_hypothesis";
  insight: string;
  evidence: Array<{
    nodeId: string;
    excerpt: string;
    relevance: number;
  }>;
  confidence: number;
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
export async function runInsightsAnalysis(
  sessionId: string
): Promise<ApiResponse<Insight[]>> {
  return fetchApi<Insight[]>("/api/insights", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

// ============================================================
// Thinking Nodes API
// ============================================================

export interface ThinkingNode {
  id: string;
  sessionId: string;
  parentNodeId: string | null;
  reasoning: string;
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
  sessionId: string
): Promise<ApiResponse<{ nodes: ThinkingNode[]; edges: ReasoningEdge[] }>> {
  return fetchApi<{ nodes: ThinkingNode[]; edges: ReasoningEdge[] }>(
    `/api/sessions/${sessionId}/nodes`
  );
}
