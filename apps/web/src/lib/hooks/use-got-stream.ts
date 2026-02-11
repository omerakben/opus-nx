"use client";

import { useCallback, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type GoTStreamPhase =
  | "idle"
  | "running"
  | "done"
  | "error";

export interface StreamingThought {
  id: string;
  content: string;
  score: number | null;
  state: string;
  depth: number;
  parentIds: string[];
}

export interface GoTStreamStats {
  totalThoughts: number;
  thoughtsExplored: number;
  thoughtsPruned: number;
  aggregationsMade: number;
  refinementsMade: number;
  maxDepthReached: number;
  totalTokens: number;
  totalDurationMs: number;
  generationErrors: number;
  evaluationErrors: number;
}

export interface GoTStreamResult {
  answer: string;
  confidence: number;
  reasoningSummary: string;
  stats: GoTStreamStats;
  graphState: {
    thoughts: StreamingThought[];
    edges: Array<{ sourceId: string; targetId: string; type: string; weight: number }>;
    bestThoughts: string[];
    sessionId: string;
  };
}

interface GoTStreamState {
  phase: GoTStreamPhase;
  /** Thoughts indexed by ID for O(1) updates */
  thoughts: Map<string, StreamingThought>;
  /** Ordered list of thought IDs (arrival order) */
  thoughtOrder: string[];
  currentDepth: number;
  maxDepth: number;
  frontierSize: number;
  stats: GoTStreamStats | null;
  errors: Array<{ type: string; message: string }>;
  /** Final result (set on done event) */
  result: GoTStreamResult | null;
  isStreaming: boolean;
  elapsedMs: number;
}

export interface GoTStreamParams {
  problem: string;
  sessionId?: string;
  strategy?: "bfs" | "dfs" | "best_first";
  maxDepth?: number;
  branchingFactor?: number;
  maxThoughts?: number;
  enableAggregation?: boolean;
  effort?: "low" | "medium" | "high" | "max";
}

interface UseGoTStreamReturn extends GoTStreamState {
  start: (params: GoTStreamParams) => void;
  stop: () => void;
  clear: () => void;
  /** Restore a previously completed result (e.g. from sessionStorage cache) */
  restore: (result: GoTStreamResult, elapsedMs?: number) => void;
}

// ────────────────────────────────────────────────────────────────
// Initial state
// ────────────────────────────────────────────────────────────────

const INITIAL_STATE: GoTStreamState = {
  phase: "idle",
  thoughts: new Map(),
  thoughtOrder: [],
  currentDepth: 0,
  maxDepth: 0,
  frontierSize: 0,
  stats: null,
  errors: [],
  result: null,
  isStreaming: false,
  elapsedMs: 0,
};

// ────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────

export function useGoTStream(): UseGoTStreamReturn {
  const [state, setState] = useState<GoTStreamState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    cleanup();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, [cleanup]);

  const clear = useCallback(() => {
    stop();
    setState(INITIAL_STATE);
  }, [stop]);

  const restore = useCallback((cachedResult: GoTStreamResult, cachedElapsedMs = 0) => {
    // Rebuild thoughts Map from the result's graphState
    const thoughtsMap = new Map<string, StreamingThought>();
    const order: string[] = [];
    for (const t of cachedResult.graphState.thoughts as StreamingThought[]) {
      thoughtsMap.set(t.id, t);
      order.push(t.id);
    }
    setState({
      phase: "done",
      thoughts: thoughtsMap,
      thoughtOrder: order,
      currentDepth: cachedResult.stats.maxDepthReached,
      maxDepth: cachedResult.stats.maxDepthReached,
      frontierSize: 0,
      stats: cachedResult.stats,
      errors: [],
      result: cachedResult,
      isStreaming: false,
      elapsedMs: cachedElapsedMs,
    });
  }, []);

  const start = useCallback(
    (params: GoTStreamParams) => {
      // Abort any existing stream
      abortControllerRef.current?.abort();
      cleanup();

      setState({
        ...INITIAL_STATE,
        isStreaming: true,
        phase: "running",
      });

      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedMs: Date.now() - startTimeRef.current,
        }));
      }, 500);

      abortControllerRef.current = new AbortController();

      fetch("/api/got/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: abortControllerRef.current.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const text = await response.text();
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              phase: "error",
              errors: [{ type: "http", message: `HTTP ${response.status}: ${text}` }],
            }));
            cleanup();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              phase: "error",
              errors: [{ type: "stream", message: "No response body" }],
            }));
            cleanup();
            return;
          }

          const decoder = new TextDecoder();
          let pendingLine = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = pendingLine + decoder.decode(value, { stream: true });
            const lines = text.split("\n");
            pendingLine = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;

              let data: Record<string, unknown>;
              try {
                data = JSON.parse(line.slice(6));
              } catch {
                continue;
              }

              handleEvent(data, setState);
            }
          }

          // Stream finished — if no done/error event was received, treat as error
          setState((prev) => {
            if (prev.phase !== "done" && prev.phase !== "error") {
              return {
                ...prev,
                isStreaming: false,
                phase: "error",
                errors: [{ type: "stream", message: "Stream ended unexpectedly." }],
              };
            }
            return prev;
          });
          cleanup();
        })
        .catch((err) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            phase: "error",
            errors: [{ type: "network", message: err instanceof Error ? err.message : "Network error" }],
          }));
          cleanup();
        });
    },
    [cleanup],
  );

  return { ...state, start, stop, clear, restore };
}

// ────────────────────────────────────────────────────────────────
// Event dispatcher
// ────────────────────────────────────────────────────────────────

function handleEvent(
  data: Record<string, unknown>,
  setState: React.Dispatch<React.SetStateAction<GoTStreamState>>,
) {
  const type = data.type as string;

  switch (type) {
    case "got:depth_start": {
      setState((prev) => ({
        ...prev,
        currentDepth: data.depth as number,
        maxDepth: data.maxDepth as number,
        frontierSize: data.frontierSize as number,
      }));
      break;
    }

    case "thought:generated": {
      const thought: StreamingThought = {
        id: data.id as string,
        content: data.content as string,
        score: data.score as number | null,
        state: data.state as string,
        depth: data.depth as number,
        parentIds: data.parentIds as string[],
      };
      setState((prev) => {
        const thoughts = new Map(prev.thoughts);
        thoughts.set(thought.id, thought);
        return {
          ...prev,
          thoughts,
          thoughtOrder: [...prev.thoughtOrder, thought.id],
        };
      });
      break;
    }

    case "thought:scored": {
      const thoughtId = data.thoughtId as string;
      const score = data.score as number;
      const thoughtState = data.state as string;
      setState((prev) => {
        const thoughts = new Map(prev.thoughts);
        const existing = thoughts.get(thoughtId);
        if (existing) {
          thoughts.set(thoughtId, { ...existing, score, state: thoughtState });
        }
        return { ...prev, thoughts };
      });
      break;
    }

    case "aggregation:complete": {
      const thought = data.thought as StreamingThought;
      setState((prev) => {
        const thoughts = new Map(prev.thoughts);
        thoughts.set(thought.id, thought);
        return {
          ...prev,
          thoughts,
          thoughtOrder: [...prev.thoughtOrder, thought.id],
        };
      });
      break;
    }

    case "thought:generation_failed":
    case "thought:evaluation_failed":
    case "aggregation:failed": {
      const errorMsg = data.error as string;
      setState((prev) => ({
        ...prev,
        errors: [...prev.errors, { type, message: errorMsg }],
      }));
      break;
    }

    case "got:progress": {
      const stats = data.stats as GoTStreamStats;
      setState((prev) => ({ ...prev, stats }));
      break;
    }

    case "done": {
      const result = data.result as GoTStreamResult;
      setState((prev) => ({
        ...prev,
        phase: "done",
        isStreaming: false,
        result,
        stats: result.stats,
      }));
      break;
    }

    case "error": {
      setState((prev) => ({
        ...prev,
        phase: "error",
        isStreaming: false,
        errors: [...prev.errors, { type: "server", message: (data.message as string) ?? "Unknown error" }],
      }));
      break;
    }

    default:
      // Silently ignore known non-actionable events (got:start, heartbeat)
      break;
  }
}
