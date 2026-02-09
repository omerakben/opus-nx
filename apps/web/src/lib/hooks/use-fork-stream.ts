"use client";

import { useCallback, useRef, useState } from "react";
import type { ForkBranch, ForkResponse, DebateResponse, DebateRound } from "@/lib/api";
import type { ForkStyle } from "@/lib/colors";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type ForkStreamPhase =
  | "idle"
  | "branches"
  | "comparison"
  | "debate_rounds"
  | "done"
  | "error";

export interface StreamingBranch {
  style: ForkStyle;
  status: "pending" | "thinking" | "complete" | "error";
  result: ForkBranch | null;
  error: string | null;
}

interface ForkStreamState {
  phase: ForkStreamPhase;
  mode: "fork" | "debate";
  /** Branch progress — keyed by style for O(1) updates */
  branches: Map<ForkStyle, StreamingBranch>;
  /** Ordered list of completed branch styles (arrival order) */
  completedBranches: ForkStyle[];
  /** Debate round entries as they arrive */
  debateRounds: DebateRound[];
  currentRound: number;
  totalRounds: number;
  /** Final authoritative results (set on done event) */
  result: ForkResponse | null;
  debateResult: DebateResponse | null;
  analysisId: string | null;
  isStreaming: boolean;
  error: string | null;
  elapsedMs: number;
}

export interface ForkStreamParams {
  query: string;
  sessionId?: string;
  styles?: ForkStyle[];
  effort?: "low" | "medium" | "high" | "max";
  branchGuidance?: Array<{ style: string; guidance: string }>;
}

export interface DebateStreamParams extends ForkStreamParams {
  debateRounds?: number;
}

interface UseForkStreamReturn extends ForkStreamState {
  startFork: (params: ForkStreamParams) => void;
  startDebate: (params: DebateStreamParams) => void;
  stop: () => void;
  clear: () => void;
}

// ────────────────────────────────────────────────────────────────
// Initial state
// ────────────────────────────────────────────────────────────────

const ALL_STYLES: ForkStyle[] = ["conservative", "aggressive", "balanced", "contrarian"];

function createInitialBranches(styles: ForkStyle[] = ALL_STYLES): Map<ForkStyle, StreamingBranch> {
  const map = new Map<ForkStyle, StreamingBranch>();
  for (const style of styles) {
    map.set(style, { style, status: "pending", result: null, error: null });
  }
  return map;
}

const INITIAL_STATE: ForkStreamState = {
  phase: "idle",
  mode: "fork",
  branches: createInitialBranches(),
  completedBranches: [],
  debateRounds: [],
  currentRound: 0,
  totalRounds: 0,
  result: null,
  debateResult: null,
  analysisId: null,
  isStreaming: false,
  error: null,
  elapsedMs: 0,
};

// ────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────

export function useForkStream(): UseForkStreamReturn {
  const [state, setState] = useState<ForkStreamState>(INITIAL_STATE);
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

  const startStream = useCallback(
    (body: Record<string, unknown>, mode: "fork" | "debate") => {
      // Abort any existing stream
      abortControllerRef.current?.abort();
      cleanup();

      const styles = (body.styles as ForkStyle[] | undefined) ?? ALL_STYLES;

      setState({
        ...INITIAL_STATE,
        mode,
        branches: createInitialBranches(styles),
        isStreaming: true,
        phase: "branches",
      });

      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedMs: Date.now() - startTimeRef.current,
        }));
      }, 500);

      abortControllerRef.current = new AbortController();

      fetch("/api/fork/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const text = await response.text();
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              phase: "error",
              error: `HTTP ${response.status}: ${text}`,
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
              error: "No response body",
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
              } catch (parseError) {
                console.warn("[useForkStream] Malformed SSE event, skipping:", {
                  rawLine: line.slice(0, 200),
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                });
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
                error: "Stream ended unexpectedly without a completion event.",
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
            error: err instanceof Error ? err.message : "Network error",
          }));
          cleanup();
        });
    },
    [cleanup],
  );

  const startFork = useCallback(
    (params: ForkStreamParams) => {
      startStream({ ...params, mode: "fork" }, "fork");
    },
    [startStream],
  );

  const startDebate = useCallback(
    (params: DebateStreamParams) => {
      startStream({ ...params, mode: "debate" }, "debate");
    },
    [startStream],
  );

  return { ...state, startFork, startDebate, stop, clear };
}

// ────────────────────────────────────────────────────────────────
// Event dispatcher
// ────────────────────────────────────────────────────────────────

function handleEvent(
  data: Record<string, unknown>,
  setState: React.Dispatch<React.SetStateAction<ForkStreamState>>,
) {
  const type = data.type as string;

  switch (type) {
    case "branch:start": {
      const style = data.style as ForkStyle;
      setState((prev) => {
        const branches = new Map(prev.branches);
        branches.set(style, { style, status: "thinking", result: null, error: null });
        return { ...prev, branches, phase: "branches" };
      });
      break;
    }

    case "branch:complete": {
      const style = data.style as ForkStyle;
      const result: ForkBranch = {
        style,
        conclusion: data.conclusion as string,
        confidence: data.confidence as number,
        keyInsights: data.keyInsights as string[],
        risks: data.risks as string[] | undefined,
        opportunities: data.opportunities as string[] | undefined,
        assumptions: data.assumptions as string[] | undefined,
      };
      setState((prev) => {
        const branches = new Map(prev.branches);
        branches.set(style, { style, status: "complete", result, error: null });
        return {
          ...prev,
          branches,
          completedBranches: [...prev.completedBranches, style],
        };
      });
      break;
    }

    case "branch:error": {
      const style = data.style as ForkStyle;
      setState((prev) => {
        const branches = new Map(prev.branches);
        branches.set(style, { style, status: "error", result: null, error: data.error as string });
        return { ...prev, branches };
      });
      break;
    }

    case "comparison:start":
      setState((prev) => ({ ...prev, phase: "comparison" }));
      break;

    case "comparison:complete":
      // Intermediate — the full result comes with `done`
      break;

    case "debate:start":
      setState((prev) => ({
        ...prev,
        phase: "debate_rounds",
        totalRounds: data.totalRounds as number,
        currentRound: 1,
      }));
      break;

    case "debate:entry_complete": {
      const entry: DebateRound = {
        style: data.style as string,
        round: data.round as number,
        response: data.response as string,
        confidence: data.confidence as number,
        positionChanged: data.positionChanged as boolean,
        keyCounterpoints: data.keyCounterpoints as string[],
        concessions: data.concessions as string[],
      };
      setState((prev) => ({
        ...prev,
        debateRounds: [...prev.debateRounds, entry],
      }));
      break;
    }

    case "debate:round_complete":
      setState((prev) => ({
        ...prev,
        currentRound: (data.round as number) + 1,
      }));
      break;

    case "done": {
      const result = data.result as Record<string, unknown>;
      const analysisId = (data.analysisId as string) ?? null;
      const persistenceError = (data.persistenceError as string) ?? null;

      setState((prev) => {
        const base = {
          phase: "done" as const,
          isStreaming: false,
          analysisId,
          // Surface persistence warning without blocking the result
          error: persistenceError,
        };

        // Determine if this is a fork or debate result
        if ("rounds" in result) {
          return {
            ...prev,
            ...base,
            debateResult: result as unknown as DebateResponse,
            // Also extract the initialFork as the fork result
            result: result.initialFork as unknown as ForkResponse,
          };
        }
        return {
          ...prev,
          ...base,
          result: result as unknown as ForkResponse,
        };
      });
      break;
    }

    case "error":
      setState((prev) => ({
        ...prev,
        phase: "error",
        isStreaming: false,
        error: (data.message as string) ?? "An unknown error occurred.",
      }));
      break;

    default:
      // Silently ignore known non-actionable events (fork:start, heartbeat, etc.)
      if (type && !type.startsWith("fork:") && type !== "debate:entry_start") {
        console.warn("[useForkStream] Unrecognized SSE event type:", type);
      }
      break;
  }
}
