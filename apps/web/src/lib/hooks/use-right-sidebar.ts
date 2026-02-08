"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "opus-nx-right-sidebar-collapsed";

interface UseRightSidebarReturn {
  isCollapsed: boolean;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
}

export function useRightSidebar(): UseRightSidebarReturn {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") {
        setIsCollapsed(true);
      }
    }
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  const expand = useCallback(() => {
    setIsCollapsed(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "false");
    }
  }, []);

  return {
    isCollapsed,
    toggle,
    collapse,
    expand,
  };
}
