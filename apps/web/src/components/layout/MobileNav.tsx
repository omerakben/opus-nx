"use client";

import { cn } from "@/lib/utils";
import { Network, Brain, MessageSquare, Lightbulb, Sparkles, CheckCircle, Users } from "lucide-react";

export type MobileView = "graph" | "think" | "sessions" | "insights" | "got" | "verify" | "swarm";

interface MobileNavProps {
  activeView: MobileView;
  onViewChange: (view: MobileView) => void;
  isStreaming?: boolean;
}

const NAV_ITEMS: { view: MobileView; icon: typeof Brain; label: string }[] = [
  { view: "graph", icon: Network, label: "Graph" },
  { view: "think", icon: Brain, label: "Think" },
  { view: "swarm", icon: Users, label: "Swarm" },
  { view: "got", icon: Sparkles, label: "GoT" },
  { view: "verify", icon: CheckCircle, label: "Verify" },
  { view: "sessions", icon: MessageSquare, label: "Sessions" },
  { view: "insights", icon: Lightbulb, label: "Insights" },
];

export function MobileNav({ activeView, onViewChange, isStreaming }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)] border-t border-[var(--border)] safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1 overflow-x-auto scrollbar-hide">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors",
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted-foreground)]"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--accent)]" />
              )}
              <span className="relative">
                <Icon className="w-5 h-5" />
                {view === "think" && isStreaming && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                )}
              </span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
