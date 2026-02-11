"use client";

import { SessionList, SessionStats } from "@/components/sessions";
import { Button } from "@/components/ui";
import type { Session } from "@/lib/api";
import type { GraphNode } from "@/lib/graph-utils";
import { PanelLeftOpen } from "lucide-react";

interface LeftPanelProps {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  nodes: GraphNode[];
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRefresh: () => void;
  onArchiveSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onShareSession?: (sessionId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
}

export function LeftPanel({
  sessions,
  activeSessionId,
  isLoading,
  nodes,
  onSelectSession,
  onCreateSession,
  onRefresh,
  onArchiveSession,
  onDeleteSession,
  onShareSession,
  isCollapsed = false,
  onToggleCollapse,
  isMobile,
}: LeftPanelProps) {
  // Mobile view - no collapse functionality
  if (isMobile) {
    return (
      <div className="h-full bg-[var(--background)] flex flex-col overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto pb-4">
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            isLoading={isLoading}
            onSelectSession={onSelectSession}
            onCreateSession={onCreateSession}
            onRefresh={onRefresh}
            onArchiveSession={onArchiveSession}
            onDeleteSession={onDeleteSession}
            onShareSession={onShareSession}
          />

          {nodes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <SessionStats nodes={nodes} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Collapsed view - show only expand button and stats
  if (isCollapsed) {
    return (
      <aside
        className="w-14 border-r border-[var(--border)] bg-[var(--card)] flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-out"
        role="complementary"
        aria-label="Session navigation"
      >
        {/* Expand button */}
        {onToggleCollapse && (
          <div className="p-2 flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-7 w-7"
              aria-expanded={false}
              aria-controls="sidebar-sessions"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats - always visible, centered */}
        {nodes.length > 0 && (
          <div
            className="border-t border-[var(--border)] p-2 flex justify-center"
            data-tour="session-stats"
          >
            <SessionStats nodes={nodes} isCompact />
          </div>
        )}

        {/* Screen reader announcement */}
        <div role="status" aria-live="polite" className="sr-only">
          Sidebar collapsed
        </div>
      </aside>
    );
  }

  // Expanded view
  return (
    <aside
      className="w-64 border-r border-[var(--border)] bg-[var(--card)] flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-out"
      role="complementary"
      aria-label="Session navigation"
    >
      {/* Sessions */}
      <div id="sidebar-sessions" className="flex-1 overflow-hidden p-4">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          isLoading={isLoading}
          onSelectSession={onSelectSession}
          onCreateSession={onCreateSession}
          onRefresh={onRefresh}
          onArchiveSession={onArchiveSession}
          onDeleteSession={onDeleteSession}
          onShareSession={onShareSession}
          onToggleCollapse={onToggleCollapse}
        />
      </div>

      {/* Stats - always visible */}
      {nodes.length > 0 && (
        <div
          className="border-t border-[var(--border)] p-4"
          data-tour="session-stats"
        >
          <SessionStats nodes={nodes} />
        </div>
      )}

      {/* Screen reader announcement */}
      <div role="status" aria-live="polite" className="sr-only">
        Sidebar expanded
      </div>
    </aside>
  );
}
