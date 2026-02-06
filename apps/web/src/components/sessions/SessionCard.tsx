"use client";

import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui";
import type { Session } from "@/lib/api";
import { MessageSquare } from "lucide-react";

interface SessionCardProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
}

export function SessionCard({ session, isActive, onClick }: SessionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        isActive
          ? "border-[var(--accent)] bg-[var(--accent)]/10"
          : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium text-[var(--foreground)] truncate">
            Session
          </span>
        </div>
        <Badge
          variant={session.status === "active" ? "success" : "secondary"}
          className="text-[10px] px-1.5 py-0"
        >
          {session.status}
        </Badge>
      </div>
      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
        {formatRelativeTime(new Date(session.createdAt))}
      </div>
      <div className="mt-1 text-[10px] text-[var(--muted-foreground)] font-mono truncate opacity-50">
        {session.id.slice(0, 8)}...
      </div>
    </button>
  );
}
