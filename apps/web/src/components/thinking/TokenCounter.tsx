"use client";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import { Zap } from "lucide-react";

interface TokenCounterProps {
  count: number;
  isStreaming?: boolean;
  className?: string;
}

export function TokenCounter({ count, isStreaming, className }: TokenCounterProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono",
        isStreaming
          ? "bg-green-500/20 text-green-400"
          : "bg-[var(--muted)] text-[var(--muted-foreground)]",
        className
      )}
    >
      <Zap
        className={cn(
          "w-3 h-3",
          isStreaming && "animate-pulse"
        )}
      />
      <span>{formatNumber(count)}</span>
      <span className="opacity-60">tokens</span>
    </div>
  );
}
