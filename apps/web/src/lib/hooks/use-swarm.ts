/**
 * React hook for the Opus NX V2 multi-agent swarm.
 *
 * Provides:
 * - startSwarm() to launch a swarm analysis
 * - Live event stream with per-agent status tracking
 * - Automatic WebSocket subscription/cleanup
 * - Connection state tracking (connected/reconnecting/disconnected)
 * - Integration with the app event bus
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startSwarm as apiStartSwarm,
  subscribeSwarmEvents,
  type ConnectionState,
  type SwarmEventUnion,
  type SwarmSubscription,
} from "../swarm-client";
import {
  compareSwarmHypothesis,
  getSessionNodes,
  retainSwarmHypothesis,
  getSwarmHypothesisExperiments,
  type SwarmHypothesisExperiment,
  type SwarmHypothesisLifecycleInfo,
  type SwarmHypothesisRetentionDecision,
} from "../api";
import { appEvents } from "../events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentStatus {
  name: string;
  status: "pending" | "thinking" | "completed" | "error";
  effort: string;
  thinkingPreview: string;
  conclusion: string;
  confidence: number;
  tokensUsed: number;
}

export interface SwarmGraphNode {
  id: string;
  agent: string;
  content: string;
  confidence?: number;
}

export interface SwarmGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string; // challenges, verifies, etc.
}

export interface SwarmState {
  /** Overall swarm phase */
  phase: "idle" | "running" | "synthesis" | "complete" | "error";
  /** Per-agent status tracking */
  agents: Record<string, AgentStatus>;
  /** Live event log for the timeline */
  events: SwarmEventUnion[];
  /** Final synthesis text */
  synthesis: string | null;
  /** Synthesis confidence */
  synthesisConfidence: number | null;
  /** Metacognition insights */
  insights: Array<{ type: string; description: string; agents: string[] }>;
  /** Error message if swarm fails */
  error: string | null;
  /** Total tokens used across all agents */
  totalTokens: number;
  /** Total duration in seconds (from swarm_started to synthesis_ready) */
  totalDuration: number | null;
  /** Internal: timestamp when swarm started */
  startTimestamp: string | null;
  /** WebSocket connection state */
  connectionState: ConnectionState;
  /** Graph nodes for live SwarmGraph visualization */
  graphNodes: SwarmGraphNode[];
  /** Graph edges for live SwarmGraph visualization */
  graphEdges: SwarmGraphEdge[];
  /** Maestro decomposition plan */
  maestroDecomposition: {
    subtasks: string[];
    selectedAgents: string[];
    reasoning: string;
  } | null;
  /** Hypothesis lifecycle experiments for the session */
  experiments: SwarmHypothesisExperiment[];
  /** Loading flag for hypothesis experiment refresh/restoration */
  experimentsLoading: boolean;
  /** Lifecycle telemetry/degraded mode metadata */
  lifecycle: SwarmHypothesisLifecycleInfo | null;
}

const INITIAL_STATE: SwarmState = {
  phase: "idle",
  agents: {},
  events: [],
  synthesis: null,
  synthesisConfidence: null,
  insights: [],
  error: null,
  totalTokens: 0,
  totalDuration: null,
  startTimestamp: null,
  connectionState: "disconnected",
  graphNodes: [],
  graphEdges: [],
  maestroDecomposition: null,
  experiments: [],
  experimentsLoading: false,
  lifecycle: null,
};

/** Polling interval for connection state (ms) */
const CONNECTION_POLL_INTERVAL_MS = 2000;

/** Map swarm insight type strings to valid InsightType enum values */
function mapSwarmInsightType(swarmType: string): "bias_detection" | "pattern" | "improvement_hypothesis" {
  if (swarmType.includes("bias")) return "bias_detection";
  if (swarmType.includes("improvement") || swarmType.includes("hypothesis")) return "improvement_hypothesis";
  return "pattern";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mergeExperimentUpdate(
  existing: SwarmHypothesisExperiment[],
  event: Extract<SwarmEventUnion, { event: "hypothesis_experiment_updated" }>
): SwarmHypothesisExperiment[] {
  const index = existing.findIndex((exp) => exp.id === event.experiment_id);
  const current = index >= 0 ? existing[index] : null;
  const metadata = event.metadata ?? current?.metadata ?? {};
  const metadataRecord = asRecord(metadata) ?? {};

  const updated: SwarmHypothesisExperiment = current
    ? {
        ...current,
        status: event.status,
        comparisonResult:
          event.comparison_result !== undefined
            ? event.comparison_result
            : current.comparisonResult,
        retentionDecision:
          event.retention_decision !== undefined
            ? event.retention_decision
            : current.retentionDecision,
        metadata: metadataRecord,
        lastUpdated: event.timestamp,
      }
    : {
        id: event.experiment_id,
        sessionId: event.session_id,
        hypothesisNodeId: readString(metadataRecord.node_id) ?? "",
        promotedBy: readString(metadataRecord.promoted_by) ?? "human",
        alternativeSummary:
          readString(metadataRecord.alternative_summary) ??
          readString(metadataRecord.summary) ??
          "Awaiting hypothesis summary",
        status: event.status,
        preferredRunId: null,
        rerunRunId: null,
        comparisonResult: event.comparison_result ?? null,
        retentionDecision: event.retention_decision ?? null,
        metadata: metadataRecord,
        createdAt: event.timestamp,
        lastUpdated: event.timestamp,
      };

  const merged =
    index >= 0
      ? existing.map((exp, i) => (i === index ? updated : exp))
      : [updated, ...existing];

  return merged.sort(
    (a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSwarm(authSecret: string, sessionId: string | null) {
  const [state, setState] = useState<SwarmState>(INITIAL_STATE);
  const subscriptionRef = useRef<SwarmSubscription | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSessionIdRef = useRef<string | null>(sessionId);
  const activeSessionIdRef = useRef<string | null>(null);

  // Poll connection state from the subscription
  const startPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
    }

    pollTimerRef.current = setInterval(() => {
      const sub = subscriptionRef.current;
      if (!sub) return;

      const connState = sub.connectionState();
      setState((prev) => {
        if (prev.connectionState === connState) return prev;
        return { ...prev, connectionState: connState };
      });
    }, CONNECTION_POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const refreshExperiments = useCallback(async () => {
    if (!sessionId) {
      setState((prev) => ({
        ...prev,
        experiments: [],
        experimentsLoading: false,
        lifecycle: null,
      }));
      return;
    }

    setState((prev) => ({ ...prev, experimentsLoading: true }));
    const response = await getSwarmHypothesisExperiments(sessionId);

    setState((prev) => ({
      ...prev,
      experiments: response.data?.experiments ?? prev.experiments,
      lifecycle: response.data?.lifecycle ?? prev.lifecycle,
      experimentsLoading: false,
    }));
  }, [sessionId]);

  // Restore swarm state from DB when sessionId changes
  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    if (sessionChanged) {
      setState(INITIAL_STATE);
    }

    if (!sessionId) return;
    const currentSessionId = sessionId;

    let cancelled = false;
    setState((prev) => ({ ...prev, experimentsLoading: true }));

    async function restoreSwarmState() {
      try {
        const [nodesResponse, experimentsResponse] = await Promise.all([
          getSessionNodes(currentSessionId),
          getSwarmHypothesisExperiments(currentSessionId),
        ]);
        if (cancelled) return;

        const experiments = experimentsResponse.data?.experiments ?? [];
        const lifecycle = experimentsResponse.data?.lifecycle ?? null;

        if (nodesResponse.error || !nodesResponse.data) {
          setState((prev) => ({
            ...prev,
            experiments,
            lifecycle,
            experimentsLoading: false,
          }));
          return;
        }

        const { nodes, edges } = nodesResponse.data;

        // Filter swarm nodes by structuredReasoning.swarm flag
        const swarmNodes = nodes.filter(
          (n) => (n.structuredReasoning as Record<string, unknown>)?.swarm === true
        );
        if (swarmNodes.length === 0) {
          setState((prev) => ({
            ...prev,
            experiments,
            lifecycle,
            experimentsLoading: false,
          }));
          return;
        }

        // Build agent map
        const agents: Record<string, AgentStatus> = {};
        for (const node of swarmNodes) {
          const sr = node.structuredReasoning as Record<string, unknown>;
          const name = (sr?.agent as string) ?? "unknown";
          if (name === "synthesizer") continue; // handled separately
          agents[name] = {
            name,
            status: "completed",
            effort: "",
            thinkingPreview: node.reasoning ?? "",
            conclusion: node.response ?? "",
            confidence: node.confidenceScore ?? 0,
            tokensUsed: 0,
          };
        }

        // Extract synthesis from synthesizer node
        const synthNode = swarmNodes.find((n) => {
          const sr = n.structuredReasoning as Record<string, unknown>;
          return sr?.agent === "synthesizer";
        });

        // Build graph nodes/edges
        const swarmNodeIds = new Set(swarmNodes.map((n) => n.id));
        const graphNodes: SwarmGraphNode[] = swarmNodes.map((n) => {
          const sr = n.structuredReasoning as Record<string, unknown>;
          return {
            id: n.id,
            agent: (sr?.agent as string) ?? "unknown",
            content: n.response ?? n.reasoning ?? "",
            confidence: n.confidenceScore ?? undefined,
          };
        });

        const graphEdges: SwarmGraphEdge[] = edges
          .filter((e) => swarmNodeIds.has(e.sourceId) || swarmNodeIds.has(e.targetId))
          .map((e) => ({
            id: e.id,
            source: e.sourceId,
            target: e.targetId,
            type: e.edgeType,
          }));

        // Extract metacognition insights from swarm nodes
        const metacogNodes = swarmNodes.filter((n) => {
          const sr = n.structuredReasoning as Record<string, unknown>;
          return sr?.agent === "metacognition";
        });
        const insights = metacogNodes
          .map((n) => {
            const sr = n.structuredReasoning as Record<string, unknown>;
            return {
              type: (sr?.insight_type as string) ?? "pattern",
              description: n.response ?? n.reasoning ?? "",
              agents: (sr?.affected_agents as string[]) ?? [],
            };
          })
          .filter((i) => i.description);

        if (!cancelled) {
          setState({
            phase: "complete",
            agents,
            events: [],
            synthesis: synthNode?.response ?? null,
            synthesisConfidence: synthNode?.confidenceScore ?? null,
            insights,
            error: null,
            totalTokens: 0,
            totalDuration: null,
            startTimestamp: null,
            connectionState: "disconnected",
            graphNodes,
            graphEdges,
            maestroDecomposition: null,
            experiments,
            experimentsLoading: false,
            lifecycle,
          });
        }
      } catch {
        // Silent — restoration is best-effort
        if (!cancelled) {
          setState((prev) => ({ ...prev, experimentsLoading: false }));
        }
      }
    }

    restoreSwarmState();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleEvent = useCallback((event: SwarmEventUnion) => {
    setState((prev) => {
      const events = [...prev.events, event];

      switch (event.event) {
        case "swarm_started":
          return {
            ...prev,
            phase: "running",
            events,
            startTimestamp: event.timestamp,
            agents: Object.fromEntries(
              event.agents.map((name) => [
                name,
                {
                  name,
                  status: "pending" as const,
                  effort: "",
                  thinkingPreview: "",
                  conclusion: "",
                  confidence: 0,
                  tokensUsed: 0,
                },
              ])
            ),
          };

        case "agent_started":
          return {
            ...prev,
            events,
            agents: {
              ...prev.agents,
              [event.agent]: {
                ...(prev.agents[event.agent] ?? {
                  name: event.agent,
                  thinkingPreview: "",
                  conclusion: "",
                  confidence: 0,
                  tokensUsed: 0,
                }),
                status: "thinking",
                effort: event.effort,
              },
            },
          };

        case "agent_thinking":
          return {
            ...prev,
            events,
            agents: {
              ...prev.agents,
              [event.agent]: {
                ...prev.agents[event.agent],
                thinkingPreview:
                  (prev.agents[event.agent]?.thinkingPreview ?? "") +
                  event.delta,
              },
            },
          };

        case "agent_completed":
          return {
            ...prev,
            events,
            totalTokens: prev.totalTokens + (event.tokens_used ?? 0),
            agents: {
              ...prev.agents,
              [event.agent]: {
                ...prev.agents[event.agent],
                status: "completed",
                conclusion: event.conclusion_preview,
                confidence: event.confidence,
                tokensUsed: event.tokens_used,
              },
            },
          };

        case "synthesis_ready": {
          const duration = prev.startTimestamp
            ? Math.round(
                (new Date(event.timestamp).getTime() -
                  new Date(prev.startTimestamp).getTime()) /
                  1000
              )
            : null;
          return {
            ...prev,
            phase: "complete",
            events,
            synthesis: event.synthesis,
            synthesisConfidence: event.confidence,
            totalDuration: duration,
          };
        }

        case "metacognition_insight":
          return {
            ...prev,
            events,
            insights: [
              ...prev.insights,
              {
                type: event.insight_type,
                description: event.description,
                agents: event.affected_agents,
              },
            ],
          };

        case "graph_node_created":
          return {
            ...prev,
            events,
            graphNodes: [
              ...prev.graphNodes,
              {
                id: event.node_id,
                agent: event.agent,
                content: event.content_preview,
              },
            ],
          };

        case "agent_challenges":
          return {
            ...prev,
            events,
            graphEdges: [
              ...prev.graphEdges,
              {
                id: `edge-challenge-${prev.graphEdges.length}`,
                source: `challenger-${event.challenger}-${prev.graphNodes.length}`,
                target: event.target_node_id,
                type: "challenges",
              },
            ],
          };

        case "verification_score":
          return {
            ...prev,
            events,
            graphNodes: prev.graphNodes.map((n) =>
              n.id === event.node_id
                ? { ...n, confidence: event.score }
                : n
            ),
          };

        case "maestro_decomposition":
          return {
            ...prev,
            events,
            maestroDecomposition: {
              subtasks: event.subtasks,
              selectedAgents: event.selected_agents,
              reasoning: event.reasoning_preview,
            },
          };

        case "hypothesis_experiment_updated":
          return {
            ...prev,
            events,
            experiments: mergeExperimentUpdate(prev.experiments, event),
            experimentsLoading: false,
          };

        default:
          return { ...prev, events };
      }
    });
  }, []);

  // Wrapper that fires side effects for certain events (outside the reducer)
  const handleEventWithSideEffects = useCallback(
    (event: SwarmEventUnion) => {
      handleEvent(event);

      // Bridge metacognition insights to the insights table
      if (event.event === "metacognition_insight") {
        const sid = activeSessionIdRef.current;
        if (sid) {
          fetch("/api/insights/swarm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sid,
              insightType: mapSwarmInsightType(event.insight_type),
              insight: event.description,
              confidence: 0.75,
              agents: event.affected_agents,
            }),
          }).catch(() => { /* best-effort bridging */ });
        }
      }

      // Emit swarm:complete so Dashboard can reload insights
      if (event.event === "synthesis_ready") {
        const sid = activeSessionIdRef.current;
        if (sid) {
          appEvents.emit("swarm:complete", { sessionId: sid });
        }
      }
    },
    [handleEvent]
  );

  const start = useCallback(
    async (query: string, startSessionId: string) => {
      // Clean up previous subscription
      subscriptionRef.current?.close();
      stopPolling();

      // Track active session for side effects
      activeSessionIdRef.current = startSessionId;

      // Reset state
      setState((prev) => ({
        ...INITIAL_STATE,
        phase: "running",
        experiments: prev.experiments,
        experimentsLoading: prev.experimentsLoading,
        lifecycle: prev.lifecycle,
      }));

      try {
        // Subscribe to WebSocket events first
        subscriptionRef.current = subscribeSwarmEvents(
          startSessionId,
          authSecret,
          handleEventWithSideEffects,
          () => {
            setState((prev) => ({
              ...prev,
              phase: "error",
              error: "WebSocket connection failed",
              connectionState: "disconnected",
            }));
          },
          {
            onReconnect: () => {
              setState((prev) => ({
                ...prev,
                connectionState: "reconnecting",
              }));
            },
          }
        );

        // Start polling connection state
        startPolling();

        // Start the swarm (fire-and-forget on the backend)
        await apiStartSwarm(query, startSessionId);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: err instanceof Error ? err.message : "Failed to start swarm",
        }));
      }
    },
    [authSecret, handleEventWithSideEffects, startPolling, stopPolling]
  );

  const stop = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
    stopPolling();
    setState((prev) => ({ ...prev, connectionState: "disconnected" }));
  }, [stopPolling]);

  const retainExperiment = useCallback(
    async (experimentId: string, decision: SwarmHypothesisRetentionDecision) => {
      const response = await retainSwarmHypothesis(experimentId, {
        decision,
        performedBy: "human",
      });

      if (response.error || !response.data?.experiment) {
        return { ok: false as const, error: response.error?.message ?? "Failed to retain experiment" };
      }

      const updatedExperiment = response.data.experiment;
      setState((prev) => {
        const index = prev.experiments.findIndex((exp) => exp.id === updatedExperiment.id);
        const experiments =
          index >= 0
            ? prev.experiments.map((exp, i) => (i === index ? updatedExperiment : exp))
            : [updatedExperiment, ...prev.experiments];

        return {
          ...prev,
          experiments: experiments.sort(
            (a, b) =>
              new Date(b.lastUpdated).getTime() -
              new Date(a.lastUpdated).getTime()
          ),
        };
      });

      return { ok: true as const };
    },
    []
  );

  const compareExperiment = useCallback(
    async (experimentId: string) => {
      const response = await compareSwarmHypothesis(experimentId, {
        performedBy: "human",
        rerunIfMissing: true,
      });

      if (response.error || !response.data) {
        return {
          ok: false as const,
          error: response.error?.message ?? "Failed to compare experiment",
        };
      }

      const payload = response.data;
      setState((prev) => {
        if (!payload?.experimentId) return prev;
        const status =
          payload.status === "comparison_ready" ? "comparing" : "rerunning";
        const index = prev.experiments.findIndex(
          (exp) => exp.id === payload.experimentId
        );
        if (index < 0) return prev;

        const current = prev.experiments[index];
        const updated: SwarmHypothesisExperiment = {
          ...current,
          status,
          comparisonResult: payload.comparisonResult ?? current.comparisonResult,
          lastUpdated: new Date().toISOString(),
        };
        const experiments = prev.experiments.map((exp, i) =>
          i === index ? updated : exp
        );
        return { ...prev, experiments };
      });

      // For immediate compare responses, refresh to hydrate latest persisted row.
      // For compare_started responses, this remains best-effort while WS updates stream in.
      await refreshExperiments();

      return { ok: true as const };
    },
    [refreshExperiments]
  );

  return {
    state,
    start,
    stop,
    refreshExperiments,
    retainExperiment,
    compareExperiment,
  };
}
