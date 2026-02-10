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
};

/** Polling interval for connection state (ms) */
const CONNECTION_POLL_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSwarm(authSecret: string) {
  const [state, setState] = useState<SwarmState>(INITIAL_STATE);
  const subscriptionRef = useRef<SwarmSubscription | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

        default:
          return { ...prev, events };
      }
    });
  }, []);

  const start = useCallback(
    async (query: string, sessionId: string) => {
      // Clean up previous subscription
      subscriptionRef.current?.close();
      stopPolling();

      // Reset state
      setState({ ...INITIAL_STATE, phase: "running" });

      try {
        // Subscribe to WebSocket events first
        subscriptionRef.current = subscribeSwarmEvents(
          sessionId,
          authSecret,
          handleEvent,
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
        await apiStartSwarm(query, sessionId);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: err instanceof Error ? err.message : "Failed to start swarm",
        }));
      }
    },
    [authSecret, handleEvent, startPolling, stopPolling]
  );

  const stop = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
    stopPolling();
    setState((prev) => ({ ...prev, connectionState: "disconnected" }));
  }, [stopPolling]);

  return { state, start, stop };
}
