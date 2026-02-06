"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TokenCounter } from "./TokenCounter";
import { ThinkingInput } from "./ThinkingInput";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { Brain, Square } from "lucide-react";
import { Button } from "@/components/ui";

interface ThinkingStreamProps {
  thinking: string;
  tokenCount: number;
  isStreaming: boolean;
  error: string | null;
  onStart: (query: string) => void;
  onStop: () => void;
  onClear: () => void;
  sessionId: string | null;
}

export function ThinkingStream({
  thinking,
  tokenCount,
  isStreaming,
  error,
  onStart,
  onStop,
  onClear,
  sessionId,
}: ThinkingStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thinking, isStreaming]);

  const handleSubmit = (query: string) => {
    if (sessionId) {
      onStart(query);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-row items-center justify-between py-3 px-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Brain
            className={cn(
              "w-5 h-5",
              isStreaming ? "text-green-500 animate-pulse" : "text-[var(--muted-foreground)]"
            )}
          />
          <CardTitle className="text-base font-medium">
            Extended Thinking
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <TokenCounter count={tokenCount} isStreaming={isStreaming} />
          {isStreaming && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStop}
              className="h-7 px-2"
            >
              <Square className="w-3 h-3 mr-1" />
              Stop
            </Button>
          )}
          {thinking && !isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2 text-xs"
            >
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Stream display */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed bg-gray-900/50"
        >
          {error ? (
            <div className="text-red-400">
              Error: {error}
            </div>
          ) : thinking ? (
            <div className="text-green-400 whitespace-pre-wrap">
              {thinking}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
              )}
            </div>
          ) : (
            <div className="text-[var(--muted-foreground)] italic">
              {sessionId
                ? "Enter a query below to start extended thinking..."
                : "Select or create a session to begin"}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--border)]">
          <ThinkingInput
            onSubmit={handleSubmit}
            isLoading={isStreaming}
            placeholder={
              sessionId
                ? "Ask a complex question..."
                : "Select a session first"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
