"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface StreamingNode {
  id: string;
  reasoning: string;
  tokenCount: number;
  timestamp: Date;
  nodeType: "thinking" | "compaction";
}

interface ThinkingStreamState {
  thinking: string;
  tokenCount: number;
  isStreaming: boolean;
  error: string | null;
  /** Current thinking phase detected from content */
  phase: "analyzing" | "reasoning" | "deciding" | "concluding" | "compacting" | null;
  /** Compaction events during this stream */
  compactionCount: number;
  /** Last compaction summary */
  compactionSummary: string | null;
  /** Streaming nodes emitted during this session for live graph updates */
  streamingNodes: StreamingNode[];
  /** Elapsed time in ms since stream start */
  elapsedMs: number;
}

interface UseThinkingStreamReturn extends ThinkingStreamState {
  start: (sessionId: string, query: string, effort?: string) => void;
  stop: () => void;
  clear: () => void;
}

/** Detect thinking phase from accumulated text */
function detectPhase(text: string): ThinkingStreamState["phase"] {
  const lower = text.toLowerCase();
  const lastChunk = lower.slice(-500);

  if (lastChunk.includes("in conclusion") || lastChunk.includes("to summarize") || lastChunk.includes("my recommendation")) {
    return "concluding";
  }
  if (lastChunk.includes("i'll choose") || lastChunk.includes("going with") || lastChunk.includes("the best approach") || lastChunk.includes("decision:")) {
    return "deciding";
  }
  if (lastChunk.includes("let me think") || lastChunk.includes("considering") || lastChunk.includes("on the other hand") || lastChunk.includes("alternatively")) {
    return "reasoning";
  }
  if (lower.length < 200) {
    return "analyzing";
  }
  return "reasoning";
}

export function useThinkingStream(): UseThinkingStreamReturn {
  const [state, setState] = useState<ThinkingStreamState>({
    thinking: "",
    tokenCount: 0,
    isStreaming: false,
    error: null,
    phase: null,
    compactionCount: 0,
    compactionSummary: null,
    streamingNodes: [],
    elapsedMs: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false, phase: null }));
  }, []);

  const clear = useCallback(() => {
    stop();
    setState({
      thinking: "",
      tokenCount: 0,
      isStreaming: false,
      error: null,
      phase: null,
      compactionCount: 0,
      compactionSummary: null,
      streamingNodes: [],
      elapsedMs: 0,
    });
  }, [stop]);

  const start = useCallback(
    (sessionId: string, query: string, effort?: string) => {
      // Clean up any existing stream
      stop();

      startTimeRef.current = Date.now();

      setState({
        thinking: "",
        tokenCount: 0,
        isStreaming: true,
        error: null,
        phase: "analyzing",
        compactionCount: 0,
        compactionSummary: null,
        streamingNodes: [],
        elapsedMs: 0,
      });

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedMs: Date.now() - startTimeRef.current,
        }));
      }, 100);

      // POST to start the thinking process
      abortControllerRef.current = new AbortController();

      fetch("/api/thinking/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, query, effort: effort ?? "high" }),
        signal: abortControllerRef.current.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          if (!response.body) {
            throw new Error("No response body");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          const read = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                setState((prev) => ({ ...prev, isStreaming: false, phase: null }));
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                  timerRef.current = null;
                }
                break;
              }

              const text = decoder.decode(value, { stream: true });
              const lines = text.split("\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === "thinking") {
                      setState((prev) => {
                        const newThinking = prev.thinking + data.chunk;
                        return {
                          ...prev,
                          thinking: newThinking,
                          tokenCount: data.tokenCount ?? prev.tokenCount,
                          phase: detectPhase(newThinking),
                        };
                      });
                    } else if (data.type === "compaction") {
                      setState((prev) => ({
                        ...prev,
                        compactionCount: prev.compactionCount + 1,
                        compactionSummary: data.summary ?? "Context compacted",
                        phase: "compacting",
                        streamingNodes: [
                          ...prev.streamingNodes,
                          {
                            id: `compaction-${Date.now()}`,
                            reasoning: data.summary ?? "Context compacted for infinite session",
                            tokenCount: prev.tokenCount,
                            timestamp: new Date(),
                            nodeType: "compaction" as const,
                          },
                        ],
                      }));
                    } else if (data.type === "node") {
                      // New thinking node persisted - emit for live graph
                      setState((prev) => ({
                        ...prev,
                        streamingNodes: [
                          ...prev.streamingNodes,
                          {
                            id: data.nodeId ?? `node-${Date.now()}`,
                            reasoning: data.reasoning ?? prev.thinking.slice(-200),
                            tokenCount: data.tokenCount ?? prev.tokenCount,
                            timestamp: new Date(),
                            nodeType: "thinking" as const,
                          },
                        ],
                      }));
                    } else if (data.type === "done") {
                      setState((prev) => ({
                        ...prev,
                        isStreaming: false,
                        phase: null,
                        tokenCount: data.totalTokens ?? prev.tokenCount,
                        elapsedMs: Date.now() - startTimeRef.current,
                      }));
                      if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                      }
                    } else if (data.type === "error") {
                      setState((prev) => ({
                        ...prev,
                        isStreaming: false,
                        phase: null,
                        error: data.message,
                      }));
                      if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                      }
                    }
                  } catch {
                    // Ignore JSON parse errors from incomplete chunks
                  }
                }
              }
            }
          };

          read();
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              phase: null,
              error: err.message,
            }));
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        });
    },
    [stop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stop]);

  return {
    ...state,
    start,
    stop,
    clear,
  };
}
