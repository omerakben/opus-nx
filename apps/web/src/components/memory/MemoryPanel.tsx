"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge, Card, CardContent, Skeleton } from "@/components/ui";

// ============================================================
// Types
// ============================================================

interface MemoryStats {
  mainContextEntries: number;
  recallStorageEntries: number;
  archivalStorageEntries: number;
  mainContextTokens: number;
  mainContextCapacity: number;
  mainContextUtilization: number;
  totalInserts: number;
  totalSearches: number;
  totalEvictions: number;
  totalPromotions: number;
}

interface MemoryEntry {
  id: string;
  tier: string;
  content: string;
  importance: number;
  tags: string[];
}

// ============================================================
// Memory Tier Styling
// ============================================================

const TIER_STYLES = {
  main_context: {
    label: "Main Context",
    sublabel: "Working Memory",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: "cpu",
  },
  recall_storage: {
    label: "Recall",
    sublabel: "Recent History",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: "clock",
  },
  archival_storage: {
    label: "Archival",
    sublabel: "Long-term Knowledge",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    icon: "database",
  },
} as const;

// ============================================================
// Memory Panel
// ============================================================

interface MemoryPanelProps {
  sessionId: string | null;
  isMobile?: boolean;
}

export function MemoryPanel({ sessionId, isMobile }: MemoryPanelProps) {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [insertContent, setInsertContent] = useState("");
  const [isInserting, setIsInserting] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "search" | "insert">("overview");

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "stats", sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch {
      // Silently fail for stats
    }
  }, [sessionId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Search archival
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);

    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "archival_search",
          query: searchQuery,
          limit: 10,
          sessionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results ?? []);
        setStats(data.stats);
      }
    } catch {
      // Handle error silently
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, isSearching, sessionId]);

  // Insert to archival
  const handleInsert = useCallback(async () => {
    if (!insertContent.trim() || isInserting) return;
    setIsInserting(true);

    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "archival_insert",
          content: insertContent,
          sessionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setInsertContent("");
      }
    } catch {
      // Handle error silently
    } finally {
      setIsInserting(false);
    }
  }, [insertContent, isInserting, sessionId]);

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="5" rx="1" />
          <rect x="2" y="11" width="20" height="5" rx="1" />
          <rect x="2" y="18" width="20" height="2" rx="1" />
        </svg>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Memory Hierarchy
        </h3>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-cyan-500/30 text-cyan-400">
          MemGPT
        </Badge>
      </div>

      <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
        Three-tier memory: working context, recall history, and archival storage
        with semantic search.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        {(["overview", "search", "insert"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors capitalize",
              activeTab === tab
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-3 animate-fade-in">
          {/* Memory Tiers */}
          {(Object.entries(TIER_STYLES) as Array<[keyof typeof TIER_STYLES, typeof TIER_STYLES[keyof typeof TIER_STYLES]]>).map(([tier, style]) => {
            const count = stats
              ? tier === "main_context"
                ? stats.mainContextEntries
                : tier === "recall_storage"
                ? stats.recallStorageEntries
                : stats.archivalStorageEntries
              : 0;

            return (
              <Card key={tier} className={cn("border", style.border)}>
                <CardContent className="px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={cn("text-xs font-semibold", style.color)}>
                        {style.label}
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">
                        {style.sublabel}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--foreground)]">
                        {count}
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">
                        entries
                      </div>
                    </div>
                  </div>

                  {/* Context utilization bar for main context */}
                  {tier === "main_context" && stats && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mb-0.5">
                        <span>{stats.mainContextTokens.toLocaleString()} tokens</span>
                        <span>{(stats.mainContextUtilization * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, stats.mainContextUtilization * 100)}%`,
                            backgroundColor: stats.mainContextUtilization > 0.8 ? "#ef4444" : "#22c55e",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Operation Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                <div className="text-[10px] text-[var(--muted-foreground)]">Insertions</div>
                <div className="text-sm font-semibold text-[var(--foreground)]">{stats.totalInserts}</div>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                <div className="text-[10px] text-[var(--muted-foreground)]">Searches</div>
                <div className="text-sm font-semibold text-[var(--foreground)]">{stats.totalSearches}</div>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                <div className="text-[10px] text-[var(--muted-foreground)]">Evictions</div>
                <div className="text-sm font-semibold text-[var(--foreground)]">{stats.totalEvictions}</div>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                <div className="text-[10px] text-[var(--muted-foreground)]">Promotions</div>
                <div className="text-sm font-semibold text-[var(--foreground)]">{stats.totalPromotions}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === "search" && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search archival memory..."
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </div>

          {isSearching && <Skeleton className="h-20 rounded-lg" />}

          {searchResults.length > 0 && (
            <div className="space-y-1.5">
              {searchResults.map((entry) => (
                <div
                  key={entry.id}
                  className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)]"
                >
                  <p className="text-xs text-[var(--foreground)] leading-relaxed">
                    {entry.content}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      importance: {entry.importance.toFixed(1)}
                    </span>
                    {entry.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[9px] h-3.5 px-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isSearching && searchResults.length === 0 && searchQuery && (
            <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
              No results found.
            </p>
          )}
        </div>
      )}

      {/* Insert Tab */}
      {activeTab === "insert" && (
        <div className="space-y-3 animate-fade-in">
          <textarea
            value={insertContent}
            onChange={(e) => setInsertContent(e.target.value)}
            placeholder="Enter knowledge to store in archival memory..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
            rows={4}
          />
          <button
            onClick={handleInsert}
            disabled={isInserting || !insertContent.trim()}
            className={cn(
              "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all",
              isInserting
                ? "bg-cyan-500/20 text-cyan-300 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90"
            )}
          >
            {isInserting ? "Storing..." : "Store in Archival Memory"}
          </button>
        </div>
      )}
    </div>
  );
}
