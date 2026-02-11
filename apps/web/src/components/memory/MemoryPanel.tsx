"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, CardContent, Input, Skeleton, toast } from "@/components/ui";
import { appEvents } from "@/lib/events";

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
  source?: string;
  createdAt?: string;
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
// Helpers
// ============================================================

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function extractApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.message || data.error || fallback;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

// ============================================================
// Memory Panel
// ============================================================

interface MemoryPanelProps {
  sessionId: string | null;
}

export function MemoryPanel({ sessionId }: MemoryPanelProps) {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [insertContent, setInsertContent] = useState("");
  const [isInserting, setIsInserting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "search" | "insert">("overview");
  const [captureProgress, setCaptureProgress] = useState<{ current: number; total: number } | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [expandedSearchId, setExpandedSearchId] = useState<string | null>(null);
  const [insertTags, setInsertTags] = useState("");

  // Entry browser state
  const [recentEntries, setRecentEntries] = useState<MemoryEntry[]>([]);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  // Activity indicator state
  const [isMemoryActive, setIsMemoryActive] = useState(false);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset all state on session change
  const prevSessionIdRef = useRef(sessionId);

  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    if (sessionChanged) {
      setSearchQuery("");
      setSearchResults([]);
      setHasSearched(false);
      setInsertContent("");
      setInsertTags("");
      setError(null);
      setRecentEntries([]);
      setStats(null);
      setShowAllEntries(false);
      setActiveTab("overview");
      setExpandedEntryId(null);
      setExpandedSearchId(null);
      setCaptureProgress(null);
      prevStatsRef.current = null;
    }
  }, [sessionId]);

  // Track previous stats for eviction/promotion toast detection
  const prevStatsRef = useRef<MemoryStats | null>(null);

  // Detect eviction/promotion changes and show toasts
  const handleStatsUpdate = useCallback((newStats: MemoryStats) => {
    const prev = prevStatsRef.current;
    if (prev) {
      if (newStats.totalEvictions > prev.totalEvictions) {
        const count = newStats.totalEvictions - prev.totalEvictions;
        toast.warning(`Evicted ${count} ${count === 1 ? "entry" : "entries"} to archival`);
        setIsMemoryActive(true);
      }
      if (newStats.totalPromotions > prev.totalPromotions) {
        const count = newStats.totalPromotions - prev.totalPromotions;
        toast.success(`Promoted ${count} ${count === 1 ? "entry" : "entries"} to working memory`);
        setIsMemoryActive(true);
      }
      if (newStats.totalInserts > prev.totalInserts) {
        setIsMemoryActive(true);
      }
      // Clear activity indicator after 3s
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      activityTimerRef.current = setTimeout(() => setIsMemoryActive(false), 3000);
    }
    prevStatsRef.current = newStats;
    setStats(newStats);
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "stats", sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        handleStatsUpdate(data.stats);
      } else {
        setError(await extractApiError(res, "Failed to load memory stats"));
      }
    } catch {
      setError("Failed to load memory stats");
    }
  }, [sessionId, handleStatsUpdate]);

  // Load recent entries
  const loadEntries = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingEntries(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "list_entries", limit: 20, sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecentEntries(data.entries ?? []);
        if (data.stats) handleStatsUpdate(data.stats);
      }
    } catch {
      // Silently fail -- entries are supplementary
    } finally {
      setIsLoadingEntries(false);
    }
  }, [sessionId, handleStatsUpdate]);

  useEffect(() => {
    loadStats();
    loadEntries();
  }, [loadStats, loadEntries]);

  // Poll for updates every 5s when on overview tab
  useEffect(() => {
    if (activeTab !== "overview") return;
    const interval = setInterval(() => {
      loadStats();
      loadEntries();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, loadStats, loadEntries]);

  // Listen for real-time memory update events from the thinking stream
  useEffect(() => {
    const unsub = appEvents.on("memory:update", (payload) => {
      // Merge SSE stats (subset) into full MemoryStats shape
      setStats((prev) => ({
        mainContextEntries: payload.stats.mainContextEntries,
        recallStorageEntries: payload.stats.recallStorageEntries,
        archivalStorageEntries: payload.stats.archivalStorageEntries,
        mainContextTokens: prev?.mainContextTokens ?? 0,
        mainContextCapacity: prev?.mainContextCapacity ?? 0,
        mainContextUtilization: prev?.mainContextUtilization ?? 0,
        totalInserts: payload.stats.totalInserts,
        totalSearches: prev?.totalSearches ?? 0,
        totalEvictions: payload.stats.totalEvictions,
        totalPromotions: payload.stats.totalPromotions,
      }));
      // Trigger activity indicator
      setIsMemoryActive(true);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      activityTimerRef.current = setTimeout(() => setIsMemoryActive(false), 3000);
      // Refresh entries to pick up newly added content
      loadEntries();
    });
    return unsub;
  }, [loadEntries]);

  // Cleanup activity timer on unmount
  useEffect(() => {
    return () => {
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, []);

  // Search archival
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    setError(null);

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
        if (data.stats) handleStatsUpdate(data.stats);
      } else {
        setError(await extractApiError(res, "Search failed"));
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  }, [searchQuery, isSearching, sessionId, handleStatsUpdate]);

  // Insert to archival
  const handleInsert = useCallback(async () => {
    if (!insertContent.trim() || isInserting) return;
    setIsInserting(true);
    setError(null);

    try {
      const tags = insertTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "archival_insert",
          content: insertContent,
          tags: tags.length > 0 ? tags : undefined,
          sessionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        handleStatsUpdate(data.stats);
        setInsertContent("");
        setInsertTags("");
        toast.success("Stored in archival memory");
        loadEntries();
        setActiveTab("overview");
      } else {
        setError(await extractApiError(res, "Failed to store in archival memory"));
      }
    } catch {
      setError("Failed to store in archival memory");
    } finally {
      setIsInserting(false);
    }
  }, [insertContent, insertTags, isInserting, sessionId, handleStatsUpdate, loadEntries]);

  // Capture thinking nodes into archival memory
  const handleCaptureThinking = useCallback(async () => {
    if (!sessionId || isCapturing) return;
    setIsCapturing(true);
    setError(null);

    try {
      const nodesRes = await fetch(`/api/sessions/${sessionId}/nodes`);
      if (!nodesRes.ok) {
        setError(`Failed to fetch thinking nodes (HTTP ${nodesRes.status})`);
        return;
      }
      const nodesData = await nodesRes.json();
      const nodes = nodesData.nodes ?? nodesData ?? [];

      if (!Array.isArray(nodes) || nodes.length === 0) {
        toast.info("No thinking nodes found in this session");
        return;
      }

      setCaptureProgress({ current: 0, total: nodes.length });
      let stored = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const content = node.content ?? node.thinking ?? node.text;
        if (!content || typeof content !== "string") {
          skipped++;
          setCaptureProgress({ current: i + 1, total: nodes.length });
          continue;
        }

        try {
          const res = await fetch("/api/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operation: "archival_insert",
              content: content.slice(0, 2000),
              sessionId,
            }),
          });
          if (res.ok) stored++;
          else failed++;
        } catch {
          failed++;
        }
        setCaptureProgress({ current: i + 1, total: nodes.length });
      }

      if (stored > 0) {
        toast.success(
          `Captured ${stored} of ${nodes.length} thinking nodes${failed > 0 ? ` (${failed} failed)` : ""}${skipped > 0 ? ` (${skipped} skipped)` : ""}`
        );
        await loadStats();
        await loadEntries();
        setActiveTab("overview");
      } else {
        toast.info("No eligible thinking nodes to capture");
      }
    } catch {
      setError("Failed to capture thinking nodes");
    } finally {
      setIsCapturing(false);
      setCaptureProgress(null);
    }
  }, [sessionId, isCapturing, loadStats, loadEntries]);

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
        {/* Live / Idle indicator */}
        {isMemoryActive ? (
          <Badge
            variant="outline"
            className="ml-auto text-[10px] h-4 px-1.5 border-cyan-400/40 text-cyan-400 animate-pulse gap-1"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
            </span>
            Live
          </Badge>
        ) : (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]/40" />
            <span className="text-[10px] text-[var(--muted-foreground)]">Idle</span>
          </div>
        )}
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
            onClick={() => {
              setActiveTab(tab);
              if (tab === "overview") { loadStats(); loadEntries(); }
              if (tab === "search") { setSearchResults([]); setHasSearched(false); }
            }}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors capitalize",
              activeTab === tab
                ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-2 shrink-0">
            &times;
          </button>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-3 animate-fade-in">
          {stats === null && !error ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}

          {/* Recent Entries */}
          {recentEntries.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                  Recent Entries
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {recentEntries.length} total
                </span>
              </div>
              {(showAllEntries ? recentEntries : recentEntries.slice(0, 5)).map((entry) => {
                const tierKey = entry.tier as keyof typeof TIER_STYLES;
                const style = TIER_STYLES[tierKey] ?? TIER_STYLES.archival_storage;
                const isExpanded = expandedEntryId === entry.id;
                return (
                  <div
                    key={entry.id}
                    role="button"
                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                    className={cn(
                      "px-2.5 py-2 rounded-lg border cursor-pointer transition-colors",
                      style.border,
                      style.bg,
                    )}
                  >
                    <p className={cn(
                      "text-[11px] text-[var(--foreground)] leading-relaxed",
                      !isExpanded && "line-clamp-2"
                    )}>
                      {isExpanded ? entry.content : (
                        <>{entry.content.slice(0, 120)}{entry.content.length > 120 ? "..." : ""}</>
                      )}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] h-3.5 px-1 border-current", style.color)}
                        aria-label={`Memory tier: ${style.label}`}
                      >
                        {style.label}
                      </Badge>
                      <span className="text-[9px] text-[var(--muted-foreground)]">
                        imp: {entry.importance.toFixed(1)}
                      </span>
                      {entry.source && (
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                          {entry.source}
                        </Badge>
                      )}
                      {entry.createdAt && (
                        <span className="text-[9px] text-[var(--muted-foreground)] ml-auto">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      )}
                    </div>
                    {isExpanded && entry.tags.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        {entry.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[9px] h-3.5 px-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <span className="text-[9px] text-[var(--accent)] mt-1 block">
                      {isExpanded ? "Show less" : "Show more"}
                    </span>
                  </div>
                );
              })}
              {recentEntries.length > 5 && (
                <button
                  onClick={() => setShowAllEntries(!showAllEntries)}
                  className="w-full text-[10px] text-[var(--accent)] hover:underline py-1"
                >
                  {showAllEntries ? "Show less" : `Show ${recentEntries.length - 5} more`}
                </button>
              )}
            </div>
          )}

          {isLoadingEntries && recentEntries.length === 0 && (
            <Skeleton className="h-16 rounded-lg" />
          )}

          {/* Capture Thinking button */}
          {sessionId && (
            <Button
              onClick={handleCaptureThinking}
              disabled={isCapturing}
              variant="outline"
              className="w-full text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            >
              {isCapturing
                ? captureProgress
                  ? `Capturing ${captureProgress.current}/${captureProgress.total}...`
                  : "Capturing..."
                : "Capture Thinking into Memory"}
            </Button>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === "search" && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search archival memory..."
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              variant="outline"
              size="sm"
            >
              Search
            </Button>
          </div>

          {isSearching && <Skeleton className="h-20 rounded-lg" />}

          {searchResults.length > 0 && (
            <div className="space-y-1.5">
              {searchResults.map((entry) => {
                const tierKey = entry.tier as keyof typeof TIER_STYLES;
                const style = TIER_STYLES[tierKey] ?? TIER_STYLES.archival_storage;
                const isExpanded = expandedSearchId === entry.id;
                return (
                  <div
                    key={entry.id}
                    role="button"
                    onClick={() => setExpandedSearchId(isExpanded ? null : entry.id)}
                    className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] cursor-pointer transition-colors"
                  >
                    <p className={cn(
                      "text-xs text-[var(--foreground)] leading-relaxed",
                      !isExpanded && "line-clamp-3"
                    )}>
                      {entry.content}
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] h-3.5 px-1 border-current", style.color)}
                        aria-label={`Memory tier: ${style.label}`}
                      >
                        {style.label}
                      </Badge>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        importance: {entry.importance.toFixed(1)}
                      </span>
                      {entry.source && (
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                          {entry.source}
                        </Badge>
                      )}
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[9px] h-3.5 px-1">
                          {tag}
                        </Badge>
                      ))}
                      {entry.createdAt && (
                        <span className="text-[9px] text-[var(--muted-foreground)] ml-auto">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-[var(--accent)] mt-1 block">
                      {isExpanded ? "Show less" : "Show more"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {!isSearching && searchResults.length === 0 && hasSearched && (
            <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
              No matching memories found. Try inserting knowledge via the Insert tab first.
            </p>
          )}

          {!isSearching && !hasSearched && searchResults.length === 0 && (
            <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
              Search across archival memory using semantic similarity.
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
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 resize-none"
            rows={4}
            maxLength={2000}
          />
          <div className="flex justify-end">
            <span className={cn(
              "text-[10px]",
              insertContent.length > 1800 ? "text-red-400" :
              insertContent.length > 1500 ? "text-amber-400" :
              "text-[var(--muted-foreground)]"
            )}>
              {insertContent.length}/2000
            </span>
          </div>
          <Input
            value={insertTags}
            onChange={(e) => setInsertTags(e.target.value)}
            placeholder="Tags (comma-separated, optional)"
            className="text-xs"
          />
          <Button
            onClick={handleInsert}
            disabled={isInserting || !insertContent.trim()}
            className="w-full text-sm"
          >
            {isInserting ? "Storing..." : "Store in Archival Memory"}
          </Button>
        </div>
      )}
    </div>
  );
}
