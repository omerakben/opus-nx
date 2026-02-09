"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================
// Types
// ============================================================

export type ReasoningStepType =
  | "analysis"
  | "hypothesis"
  | "evaluation"
  | "conclusion"
  | "consideration";

export interface ReasoningStep {
  stepNumber: number;
  content: string;
  type?: ReasoningStepType;
}

export interface DecisionPointAlternative {
  path: string;
  reasonRejected: string;
}

export interface DecisionPoint {
  stepNumber: number;
  description: string;
  chosenPath: string;
  alternatives: DecisionPointAlternative[];
  confidence?: number;
  reasoningExcerpt?: string;
}

export interface StructuredReasoning {
  steps: ReasoningStep[];
  decisionPoints: DecisionPoint[];
  mainConclusion?: string;
  confidenceFactors?: string[];
  alternativesConsidered: number;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
}

export interface ReasoningNode {
  id: string;
  sessionId: string;
  parentNodeId: string | null;
  reasoning: string;
  response: string | null;
  structuredReasoning: StructuredReasoning;
  confidenceScore: number | null;
  tokenUsage: TokenUsage;
  inputQuery: string | null;
  nodeType?: string;
  createdAt: string;
}

export type EdgeType =
  | "influences"
  | "contradicts"
  | "supports"
  | "supersedes"
  | "refines";

export interface ReasoningEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  weight: number;
  createdAt: string;
}

export interface PersistedDecisionPoint {
  id: string;
  thinkingNodeId: string;
  stepNumber: number;
  description: string;
  chosenPath: string;
  alternatives: DecisionPointAlternative[];
  confidence?: number;
  reasoningExcerpt?: string;
  createdAt: string;
}

export interface ReasoningDetailData {
  node: ReasoningNode;
  decisionPoints: PersistedDecisionPoint[];
  related: {
    incomingEdges: ReasoningEdge[];
    outgoingEdges: ReasoningEdge[];
  };
}

interface UseReasoningDetailReturn {
  data: ReasoningDetailData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================
// Hook
// ============================================================

/**
 * Fetch structured reasoning data for a single thinking node.
 *
 * The API at GET /api/reasoning/:id returns the node, its decision points,
 * and related reasoning edges. The response is unwrapped from the
 * jsonSuccess envelope automatically.
 */
export function useReasoningDetail(
  nodeId: string | null
): UseReasoningDetailReturn {
  const [data, setData] = useState<ReasoningDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!nodeId) {
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reasoning/${nodeId}`);

      if (!response.ok) {
        const body = await response.text();
        let message = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(body);
          message =
            parsed.error?.message ?? parsed.message ?? message;
        } catch {
          message = body || message;
        }
        setError(message);
        setData(null);
        setIsLoading(false);
        return;
      }

      const payload: ReasoningDetailData = await response.json();
      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch reasoning detail"
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchDetail,
  };
}
