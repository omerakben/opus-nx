"use client";

import { SessionCard } from "./SessionCard";
import { Button, Skeleton } from "@/components/ui";
import type { Session } from "@/lib/api";
import { Plus, RefreshCw } from "lucide-react";

interface SessionListProps {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRefresh: () => void;
}

export function SessionList({
  sessions,
  activeSessionId,
  isLoading,
  onSelectSession,
  onCreateSession,
  onRefresh,
}: SessionListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--foreground)]">
          Sessions
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-7 w-7"
            title="Refresh sessions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreateSession}
            className="h-7 w-7"
            title="New session"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--muted-foreground)] mb-3">
              No sessions yet
            </p>
            <Button onClick={onCreateSession} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Create Session
            </Button>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => onSelectSession(session.id)}
              displayName={session.displayName ?? undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
