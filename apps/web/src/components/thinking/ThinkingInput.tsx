"use client";

import { useState, useCallback, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { Input, NeuralSubmitButton } from "@/components/ui";

interface ThinkingInputProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ThinkingInput({
  onSubmit,
  isLoading,
  placeholder = "Ask a complex question to trigger extended thinking...",
}: ThinkingInputProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (query.trim() && !isLoading) {
        onSubmit(query.trim());
        setQuery("");
      }
    },
    [query, isLoading, onSubmit]
  );

  return (
    <div className="thinking-input-border rounded-xl p-[3px] shadow-[0_0_20px_-4px_rgba(196,101,74,0.4),0_0_10px_-4px_rgba(123,163,190,0.25)] transition-shadow duration-300 focus-within:shadow-[0_0_28px_-2px_rgba(196,101,74,0.55),0_0_14px_-2px_rgba(123,163,190,0.35)]">
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex items-center gap-2 rounded-[9px] bg-[var(--card)] px-3 py-1.5",
          isLoading && "animate-pulse"
        )}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 h-10 border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <NeuralSubmitButton
          disabled={!query.trim()}
          isLoading={isLoading}
        />
      </form>
    </div>
  );
}
