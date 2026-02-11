"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  getSessions,
  createSession,
  archiveSession as archiveSessionApi,
  deleteSession as deleteSessionApi,
  restoreSession as restoreSessionApi,
  createSessionShareLink as createSessionShareLinkApi,
  type Session,
} from "@/lib/api";
import { toast } from "@/components/ui/sonner";

interface UseSessionReturn {
  sessions: Session[];
  activeSession: Session | null;
  isLoading: boolean;
  error: string | null;
  selectSession: (sessionId: string) => void;
  createNewSession: () => Promise<Session | null>;
  refreshSessions: () => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  deleteSessionWithUndo: (sessionId: string) => Promise<void>;
  shareSessionLink: (sessionId: string) => Promise<void>;
}

// Undo window duration in milliseconds
const UNDO_DELAY_MS = 5000;

export function useSession(): UseSessionReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);

  // Track pending deletions for undo functionality
  const pendingDeletions = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const refreshSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const response = await getSessions();

    if (response.error) {
      setError(response.error.message);
      setSessions([]);
    } else if (response.data) {
      setSessions(response.data);
      // Auto-select first session if none selected
      if (!activeSessionIdRef.current && response.data.length > 0) {
        setActiveSessionId(response.data[0].id);
      }
    }

    setIsLoading(false);
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const createNewSession = useCallback(async () => {
    const response = await createSession();

    if (response.error) {
      setError(response.error.message);
      return null;
    }

    if (response.data) {
      setSessions((prev) => [response.data!, ...prev]);
      setActiveSessionId(response.data.id);
      return response.data;
    }

    return null;
  }, []);

  const archiveSession = useCallback(
    async (sessionId: string) => {
      // Find the session to get its name for the toast
      const session = sessions.find((s) => s.id === sessionId);
      const sessionName = session?.displayName || "Session";

      // Optimistically remove from UI
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // If archived session was active, select next one
      if (activeSessionId === sessionId) {
        const remainingSessions = sessions.filter((s) => s.id !== sessionId);
        setActiveSessionId(remainingSessions[0]?.id ?? null);
      }

      // Call API
      const response = await archiveSessionApi(sessionId);

      if (response.error) {
        // Restore on error
        await refreshSessions();
        toast.error("Failed to archive session", {
          description: response.error.message,
        });
        return;
      }

      toast.success("Session archived", {
        description: sessionName,
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreSessionApi(sessionId);
            await refreshSessions();
          },
        },
        duration: UNDO_DELAY_MS,
      });
    },
    [sessions, activeSessionId, refreshSessions]
  );

  const deleteSessionWithUndo = useCallback(
    async (sessionId: string) => {
      // Find the session to get its name for the toast
      const session = sessions.find((s) => s.id === sessionId);
      const sessionName = session?.displayName || "Session";

      // Optimistically remove from UI
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // If deleted session was active, select next one
      if (activeSessionId === sessionId) {
        const remainingSessions = sessions.filter((s) => s.id !== sessionId);
        setActiveSessionId(remainingSessions[0]?.id ?? null);
      }

      // Set up delayed deletion
      const timeoutId = setTimeout(async () => {
        pendingDeletions.current.delete(sessionId);
        const response = await deleteSessionApi(sessionId);
        if (response.error) {
          console.error("Failed to delete session:", response.error);
        }
      }, UNDO_DELAY_MS);

      pendingDeletions.current.set(sessionId, timeoutId);

      toast.success("Session deleted", {
        description: sessionName,
        action: {
          label: "Undo",
          onClick: () => {
            // Cancel the pending deletion
            const timeout = pendingDeletions.current.get(sessionId);
            if (timeout) {
              clearTimeout(timeout);
              pendingDeletions.current.delete(sessionId);
            }
            // Restore to UI
            refreshSessions();
          },
        },
        duration: UNDO_DELAY_MS,
      });
    },
    [sessions, activeSessionId, refreshSessions]
  );

  const shareSessionLink = useCallback(
    async (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      const sessionName = session?.displayName || "Session";

      const response = await createSessionShareLinkApi(sessionId);
      if (response.error || !response.data) {
        toast.error("Failed to create share link", {
          description: response.error?.message ?? "Please try again.",
        });
        return;
      }

      const { shareUrl, expiresAt } = response.data;
      const expiresLabel = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(new Date(expiresAt));

      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Share link copied", {
          description: `${sessionName} · expires ${expiresLabel}`,
        });
      } catch {
        toast.success("Share link created", {
          description: "Clipboard access blocked. Open link from the action.",
          action: {
            label: "Open",
            onClick: () => {
              window.open(shareUrl, "_blank", "noopener,noreferrer");
            },
          },
        });
      }
    },
    [sessions]
  );

  // Cleanup pending deletions on unmount
  useEffect(() => {
    return () => {
      pendingDeletions.current.forEach((timeout) => clearTimeout(timeout));
      pendingDeletions.current.clear();
    };
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  return {
    sessions,
    activeSession,
    isLoading,
    error,
    selectSession,
    createNewSession,
    refreshSessions,
    archiveSession,
    deleteSessionWithUndo,
    shareSessionLink,
  };
}
