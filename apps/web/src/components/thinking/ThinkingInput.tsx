"use client";

import { useState, useCallback, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { Loader2, Send } from "lucide-react";

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
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        className="flex-1"
      />
      <Button
        type="submit"
        disabled={!query.trim() || isLoading}
        size="icon"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </form>
  );
}
