"use client";

import { SessionList, SessionStats } from "@/components/sessions";
import type { Session } from "@/lib/api";
import type { GraphNode } from "@/lib/graph-utils";

interface LeftPanelProps {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  nodes: GraphNode[];
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRefresh: () => void;
}

export function LeftPanel({
  sessions,
  activeSessionId,
  isLoading,
  nodes,
  onSelectSession,
  onCreateSession,
  onRefresh,
}: LeftPanelProps) {
  return (
    <div className="w-64 border-r border-[var(--border)] bg-[var(--card)] flex flex-col h-full overflow-hidden">
      {/* Sessions */}
      <div className="flex-1 p-4 overflow-y-auto">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          isLoading={isLoading}
          onSelectSession={onSelectSession}
          onCreateSession={onCreateSession}
          onRefresh={onRefresh}
        />
      </div>

      {/* Stats */}
      {nodes.length > 0 && (
        <div className="p-4 border-t border-[var(--border)]">
          <SessionStats nodes={nodes} />
        </div>
      )}
    </div>
  );
}
