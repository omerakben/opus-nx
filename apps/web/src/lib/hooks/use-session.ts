"use client";

import { useCallback, useState, useEffect } from "react";
import { getSessions, createSession, type Session } from "@/lib/api";

interface UseSessionReturn {
  sessions: Session[];
  activeSession: Session | null;
  isLoading: boolean;
  error: string | null;
  selectSession: (sessionId: string) => void;
  createNewSession: () => Promise<Session | null>;
  refreshSessions: () => Promise<void>;
}

export function useSession(): UseSessionReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (!activeSessionId && response.data.length > 0) {
        setActiveSessionId(response.data[0].id);
      }
    }

    setIsLoading(false);
  }, [activeSessionId]);

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
  };
}
