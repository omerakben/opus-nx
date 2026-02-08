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
    <form onSubmit={handleSubmit} className={cn("flex gap-2", isLoading && "animate-pulse")}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        className="flex-1 focus:border-[var(--accent)]/50 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]"
      />
      <NeuralSubmitButton
        disabled={!query.trim()}
        isLoading={isLoading}
      />
    </form>
  );
}
