"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ThinkingStreamState {
  thinking: string;
  tokenCount: number;
  isStreaming: boolean;
  error: string | null;
}

interface UseThinkingStreamReturn extends ThinkingStreamState {
  start: (sessionId: string, query: string) => void;
  stop: () => void;
  clear: () => void;
}

export function useThinkingStream(): UseThinkingStreamReturn {
  const [state, setState] = useState<ThinkingStreamState>({
    thinking: "",
    tokenCount: 0,
    isStreaming: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const clear = useCallback(() => {
    stop();
    setState({
      thinking: "",
      tokenCount: 0,
      isStreaming: false,
      error: null,
    });
  }, [stop]);

  const start = useCallback(
    (sessionId: string, query: string) => {
      // Clean up any existing stream
      stop();

      setState({
        thinking: "",
        tokenCount: 0,
        isStreaming: true,
        error: null,
      });

      // First, POST to start the thinking process
      abortControllerRef.current = new AbortController();

      fetch("/api/thinking/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, query }),
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
                setState((prev) => ({ ...prev, isStreaming: false }));
                break;
              }

              const text = decoder.decode(value, { stream: true });
              const lines = text.split("\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === "thinking") {
                      setState((prev) => ({
                        ...prev,
                        thinking: prev.thinking + data.chunk,
                        tokenCount: data.tokenCount ?? prev.tokenCount,
                      }));
                    } else if (data.type === "done") {
                      setState((prev) => ({
                        ...prev,
                        isStreaming: false,
                        tokenCount: data.totalTokens ?? prev.tokenCount,
                      }));
                    } else if (data.type === "error") {
                      setState((prev) => ({
                        ...prev,
                        isStreaming: false,
                        error: data.message,
                      }));
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
              error: err.message,
            }));
          }
        });
    },
    [stop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    ...state,
    start,
    stop,
    clear,
  };
}
