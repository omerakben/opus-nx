"use client";

import { cn } from "@/lib/utils";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { Badge } from "@/components/ui";
import type { Session } from "@/lib/api";
import { MessageSquare, Star } from "lucide-react";

interface SessionCardProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  /** Display name derived from first query */
  displayName?: string;
}

export function SessionCard({ session, isActive, onClick, displayName }: SessionCardProps) {
  const name = displayName || "New Session";
  const isDemo = session.isDemo === true;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        isActive
          ? "border-[var(--accent)] bg-[var(--accent)]/10"
          : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]",
        isDemo && !isActive && "border-violet-500/30 bg-violet-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isDemo ? (
            <Star className="w-4 h-4 text-violet-400 shrink-0" />
          ) : (
            <MessageSquare className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
          )}
          <span className="text-sm font-medium text-[var(--foreground)] truncate">
            {truncate(name, 30)}
          </span>
        </div>
        <Badge
          variant={session.status === "active" ? "success" : "secondary"}
          className="text-[10px] px-1.5 py-0 shrink-0"
        >
          {session.status}
        </Badge>
      </div>
      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
        {formatRelativeTime(new Date(session.createdAt))}
      </div>
    </button>
  );
}
