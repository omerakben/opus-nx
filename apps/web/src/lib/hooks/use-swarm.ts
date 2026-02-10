/**
 * React hook for the Opus NX V2 multi-agent swarm.
 *
 * Provides:
 * - startSwarm() to launch a swarm analysis
 * - Live event stream with per-agent status tracking
 * - Automatic WebSocket subscription/cleanup
 * - Integration with the app event bus
 */

"use client";

import { useCallback, useRef, useState } from "react";
import {
  startSwarm as apiStartSwarm,
  subscribeSwarmEvents,
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
}

const INITIAL_STATE: SwarmState = {
  phase: "idle",
  agents: {},
  events: [],
  synthesis: null,
  synthesisConfidence: null,
  insights: [],
  error: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSwarm(authSecret: string) {
  const [state, setState] = useState<SwarmState>(INITIAL_STATE);
  const subscriptionRef = useRef<SwarmSubscription | null>(null);

  const handleEvent = useCallback((event: SwarmEventUnion) => {
    setState((prev) => {
      const events = [...prev.events, event];

      switch (event.event) {
        case "swarm_started":
          return {
            ...prev,
            phase: "running",
            events,
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

        case "synthesis_ready":
          return {
            ...prev,
            phase: "complete",
            events,
            synthesis: event.synthesis,
            synthesisConfidence: event.confidence,
          };

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
            }));
          }
        );

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
    [authSecret, handleEvent]
  );

  const stop = useCallback(() => {
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
  }, []);

  return { state, start, stop };
}
