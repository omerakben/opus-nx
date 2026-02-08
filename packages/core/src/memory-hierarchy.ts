import { createLogger } from "@opus-nx/shared";
import type {
  MemoryEntry,
  MemoryTier,
  MainContext,
  MemoryOperation,
  MemoryStats,
  MemoryHierarchyConfig,
} from "./types/memory.js";

const logger = createLogger("MemoryHierarchy");

// ============================================================
// Memory Hierarchy Options
// ============================================================

export interface MemoryHierarchyOptions {
  config?: Partial<MemoryHierarchyConfig>;
  /** Callback when memory is evicted from working to archival */
  onEviction?: (entry: MemoryEntry) => void;
  /** Callback when memory is promoted from archival to working */
  onPromotion?: (entry: MemoryEntry) => void;
  /** Callback when memory stats change */
  onStatsUpdate?: (stats: MemoryStats) => void;
}

// ============================================================
// Memory Hierarchy
// ============================================================

/**
 * MemoryHierarchy implements the MemGPT-inspired tiered memory system.
 *
 * Based on "MemGPT: Towards LLMs as Operating Systems" (Packer et al., 2023),
 * this system manages three memory tiers:
 *
 * 1. **Main Context** (registers/L1): Always visible to the LLM.
 *    Contains system prompt, core memory (user/agent facts),
 *    and current working memory.
 *
 * 2. **Recall Storage** (RAM): Recent session history.
 *    Fast keyword/timestamp retrieval. Automatically populated
 *    from reasoning nodes and conversations.
 *
 * 3. **Archival Storage** (disk): Long-term knowledge.
 *    Semantic search via embeddings. Persisted across sessions.
 *
 * The key innovation: memory management is a first-class operation.
 * The LLM can insert, search, evict, and promote memories through
 * explicit operations — giving it control over its own context.
 *
 * Memory Paging Model:
 * - When main context approaches capacity, least-important
 *   entries are "paged out" (evicted) to archival storage.
 * - When the LLM needs information, it can "page in" (promote)
 *   entries from archival back to working memory.
 * - This enables effectively unbounded context.
 */
export class MemoryHierarchy {
  private config: MemoryHierarchyConfig;
  private options: MemoryHierarchyOptions;

  // Memory tiers
  private mainContext: MainContext;
  private recallStorage: MemoryEntry[] = [];
  private archivalStorage: MemoryEntry[] = [];

  // Statistics
  private stats: MemoryStats;

  constructor(options: MemoryHierarchyOptions = {}) {
    this.config = {
      maxMainContextTokens: options.config?.maxMainContextTokens ?? 100000,
      recallWindowSize: options.config?.recallWindowSize ?? 100,
      evictionThreshold: options.config?.evictionThreshold ?? 0.3,
      selfManaged: options.config?.selfManaged ?? true,
      summarizeOnEviction: options.config?.summarizeOnEviction ?? true,
      searchThreshold: options.config?.searchThreshold ?? 0.7,
    };
    this.options = options;

    this.mainContext = {
      systemPrompt: "",
      coreMemory: { humanFacts: [], agentFacts: [] },
      workingMemory: [],
      tokenCount: 0,
      maxTokens: this.config.maxMainContextTokens,
    };

    this.stats = {
      mainContextEntries: 0,
      recallStorageEntries: 0,
      archivalStorageEntries: 0,
      mainContextTokens: 0,
      mainContextCapacity: this.config.maxMainContextTokens,
      mainContextUtilization: 0,
      totalInserts: 0,
      totalSearches: 0,
      totalEvictions: 0,
      totalPromotions: 0,
    };

    logger.debug("MemoryHierarchy initialized", {
      maxMainTokens: this.config.maxMainContextTokens,
      recallWindow: this.config.recallWindowSize,
    });
  }

  // ============================================================
  // Memory Operations (MemGPT function call handlers)
  // ============================================================

  /**
   * Execute a memory operation (from LLM function calls or programmatic use).
   */
  async executeOperation(op: MemoryOperation): Promise<{
    success: boolean;
    results?: MemoryEntry[];
    message: string;
  }> {
    switch (op.operation) {
      case "archival_insert":
        return this.archivalInsert(op.content, op.tags, op.importance);
      case "archival_search":
        return this.archivalSearch(op.query, op.limit);
      case "recall_search":
        return this.recallSearch(op.query, op.limit);
      case "core_memory_append":
        return this.coreMemoryAppend(op.section, op.content);
      case "core_memory_replace":
        return this.coreMemoryReplace(op.section, op.oldContent, op.newContent);
      case "evict_to_archival":
        return this.evictToArchival(op.entryIds);
      case "promote_to_working":
        return this.promoteToWorking(op.entryIds);
    }
  }

  // ============================================================
  // Main Context Management
  // ============================================================

  /**
   * Add an entry to working memory (main context).
   * Triggers eviction if capacity is exceeded.
   */
  addToWorkingMemory(
    content: string,
    importance: number,
    source: MemoryEntry["source"],
    sourceId?: string
  ): MemoryEntry {
    const entry = this.createEntry(content, "main_context", importance, source, sourceId);
    this.mainContext.workingMemory.push({
      id: entry.id,
      content: entry.content,
      importance: entry.importance,
    });

    // Estimate token count (rough: 4 chars per token)
    this.mainContext.tokenCount += Math.ceil(content.length / 4);

    // Also add to recall storage for history
    this.addToRecall(entry);

    // Check if eviction is needed
    if (this.mainContext.tokenCount > this.mainContext.maxTokens) {
      this.autoEvict();
    }

    this.updateStats();
    return entry;
  }

  /**
   * Set the system prompt (always in main context).
   */
  setSystemPrompt(prompt: string): void {
    this.mainContext.systemPrompt = prompt;
    this.mainContext.tokenCount = this.estimateContextTokens();
    this.updateStats();
  }

  /**
   * Get the current main context as a formatted string for LLM injection.
   */
  getMainContextString(): string {
    const parts: string[] = [];

    // Core memory
    if (this.mainContext.coreMemory.humanFacts.length > 0) {
      parts.push("## Core Memory: Human");
      parts.push(this.mainContext.coreMemory.humanFacts.map((f) => `- ${f}`).join("\n"));
    }
    if (this.mainContext.coreMemory.agentFacts.length > 0) {
      parts.push("## Core Memory: Agent");
      parts.push(this.mainContext.coreMemory.agentFacts.map((f) => `- ${f}`).join("\n"));
    }

    // Working memory
    if (this.mainContext.workingMemory.length > 0) {
      parts.push("## Working Memory");
      parts.push(
        this.mainContext.workingMemory
          .sort((a, b) => b.importance - a.importance)
          .map((m) => `[importance: ${m.importance.toFixed(1)}] ${m.content}`)
          .join("\n\n")
      );
    }

    return parts.join("\n\n");
  }

  /**
   * Get the full main context state.
   */
  getMainContext(): Readonly<MainContext> {
    return this.mainContext;
  }

  // ============================================================
  // Archival Storage Operations
  // ============================================================

  /**
   * Insert content into archival storage.
   */
  private archivalInsert(
    content: string,
    tags?: string[],
    importance?: number
  ): { success: boolean; results?: MemoryEntry[]; message: string } {
    const entry = this.createEntry(
      content,
      "archival_storage",
      importance ?? 0.5,
      "knowledge_base"
    );
    entry.tags = tags ?? [];
    this.archivalStorage.push(entry);
    this.stats.totalInserts++;
    this.updateStats();

    logger.debug("Archival insert", { id: entry.id, tags: entry.tags });
    return {
      success: true,
      results: [entry],
      message: `Stored in archival memory: "${content.slice(0, 50)}..."`,
    };
  }

  /**
   * Search archival storage by keyword matching.
   * (In production, this would use vector similarity search)
   */
  private archivalSearch(
    query: string,
    limit?: number
  ): { success: boolean; results?: MemoryEntry[]; message: string } {
    const maxResults = limit ?? 10;
    this.stats.totalSearches++;

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    // Score each archival entry by relevance
    const scored = this.archivalStorage.map((entry) => {
      const contentLower = entry.content.toLowerCase();
      const tagLower = entry.tags.map((t) => t.toLowerCase());

      let termScore = 0;
      for (const term of queryTerms) {
        if (contentLower.includes(term)) termScore += 1;
        if (tagLower.some((t) => t.includes(term))) termScore += 0.5;
      }
      // Only boost by importance/recency if at least one term matched
      let score = termScore;
      if (termScore > 0) {
        score += entry.importance * 0.3;
        const ageMs = Date.now() - entry.lastAccessedAt.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        score -= ageDays * 0.01; // Slight penalty for old entries
      }

      return { entry, score };
    });

    const results = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((s) => {
        // Update access time
        s.entry.lastAccessedAt = new Date();
        s.entry.accessCount++;
        return s.entry;
      });

    return {
      success: true,
      results,
      message: results.length > 0
        ? `Found ${results.length} results for "${query}".`
        : `No results found for "${query}".`,
    };
  }

  // ============================================================
  // Recall Storage Operations
  // ============================================================

  /**
   * Add an entry to recall storage (recent history).
   */
  private addToRecall(entry: MemoryEntry): void {
    const recallEntry = { ...entry, tier: "recall_storage" as MemoryTier };
    this.recallStorage.push(recallEntry);

    // Enforce window size
    while (this.recallStorage.length > this.config.recallWindowSize) {
      const evicted = this.recallStorage.shift();
      if (evicted && evicted.importance > this.config.evictionThreshold) {
        // Important recall entries get archived instead of dropped
        evicted.tier = "archival_storage";
        this.archivalStorage.push(evicted);
      }
    }
  }

  /**
   * Search recall storage by keyword.
   */
  private recallSearch(
    query: string,
    limit?: number
  ): { success: boolean; results?: MemoryEntry[]; message: string } {
    const maxResults = limit ?? 10;
    this.stats.totalSearches++;

    const queryLower = query.toLowerCase();
    const results = this.recallStorage
      .filter((entry) => entry.content.toLowerCase().includes(queryLower))
      .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime())
      .slice(0, maxResults);

    return {
      success: true,
      results,
      message: results.length > 0
        ? `Found ${results.length} recent entries for "${query}".`
        : `No recent entries found for "${query}".`,
    };
  }

  // ============================================================
  // Core Memory Operations
  // ============================================================

  /**
   * Append a fact to core memory.
   */
  private coreMemoryAppend(
    section: "human" | "agent",
    content: string
  ): { success: boolean; message: string } {
    if (section === "human") {
      this.mainContext.coreMemory.humanFacts.push(content);
    } else {
      this.mainContext.coreMemory.agentFacts.push(content);
    }
    this.mainContext.tokenCount = this.estimateContextTokens();
    this.updateStats();

    return {
      success: true,
      message: `Added to core memory (${section}): "${content.slice(0, 50)}..."`,
    };
  }

  /**
   * Replace a fact in core memory.
   */
  private coreMemoryReplace(
    section: "human" | "agent",
    oldContent: string,
    newContent: string
  ): { success: boolean; message: string } {
    const facts = section === "human"
      ? this.mainContext.coreMemory.humanFacts
      : this.mainContext.coreMemory.agentFacts;

    const index = facts.indexOf(oldContent);
    if (index === -1) {
      return { success: false, message: `Could not find "${oldContent.slice(0, 30)}..." in core memory.` };
    }

    facts[index] = newContent;
    this.mainContext.tokenCount = this.estimateContextTokens();
    this.updateStats();

    return {
      success: true,
      message: `Updated core memory: "${newContent.slice(0, 50)}..."`,
    };
  }

  // ============================================================
  // Memory Paging (Eviction / Promotion)
  // ============================================================

  /**
   * Evict entries from working memory to archival storage.
   */
  private evictToArchival(
    entryIds: string[]
  ): { success: boolean; message: string } {
    let evicted = 0;

    for (const id of entryIds) {
      const wmIndex = this.mainContext.workingMemory.findIndex((m) => m.id === id);
      if (wmIndex === -1) continue;

      const wmEntry = this.mainContext.workingMemory[wmIndex];
      this.mainContext.workingMemory.splice(wmIndex, 1);

      // Move to archival storage
      const entry = this.createEntry(
        wmEntry.content,
        "archival_storage",
        wmEntry.importance,
        "compaction"
      );
      entry.id = id;
      this.archivalStorage.push(entry);
      this.options.onEviction?.(entry);

      evicted++;
      this.stats.totalEvictions++;
    }

    this.mainContext.tokenCount = this.estimateContextTokens();
    this.updateStats();

    return {
      success: true,
      message: `Evicted ${evicted} entries to archival storage.`,
    };
  }

  /**
   * Promote entries from archival storage to working memory.
   */
  private promoteToWorking(
    entryIds: string[]
  ): { success: boolean; results?: MemoryEntry[]; message: string } {
    const promoted: MemoryEntry[] = [];

    for (const id of entryIds) {
      const archIndex = this.archivalStorage.findIndex((e) => e.id === id);
      if (archIndex === -1) continue;

      const entry = this.archivalStorage[archIndex];
      this.archivalStorage.splice(archIndex, 1);

      // Move to working memory
      entry.tier = "main_context";
      entry.lastAccessedAt = new Date();
      entry.accessCount++;
      this.mainContext.workingMemory.push({
        id: entry.id,
        content: entry.content,
        importance: entry.importance,
      });

      promoted.push(entry);
      this.options.onPromotion?.(entry);
      this.stats.totalPromotions++;
    }

    this.mainContext.tokenCount = this.estimateContextTokens();

    // Check if eviction is needed after promotion
    if (this.mainContext.tokenCount > this.mainContext.maxTokens) {
      this.autoEvict();
    }

    this.updateStats();

    return {
      success: true,
      results: promoted,
      message: `Promoted ${promoted.length} entries to working memory.`,
    };
  }

  /**
   * Automatically evict least-important entries when context is full.
   * Implements the MemGPT "page out" mechanism.
   */
  private autoEvict(): void {
    // Sort working memory by importance (ascending — least important first)
    const sorted = [...this.mainContext.workingMemory]
      .sort((a, b) => a.importance - b.importance);

    const toEvict: string[] = [];
    let currentTokens = this.mainContext.tokenCount;
    const targetTokens = this.mainContext.maxTokens * 0.8; // Evict to 80% capacity

    for (const entry of sorted) {
      if (currentTokens <= targetTokens) break;
      toEvict.push(entry.id);
      currentTokens -= Math.ceil(entry.content.length / 4);
    }

    if (toEvict.length > 0) {
      logger.info("Auto-evicting memories", {
        count: toEvict.length,
        currentTokens: this.mainContext.tokenCount,
        targetTokens,
      });
      this.evictToArchival(toEvict);
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private createEntry(
    content: string,
    tier: MemoryTier,
    importance: number,
    source: MemoryEntry["source"],
    sourceId?: string
  ): MemoryEntry {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      tier,
      content,
      importance: Math.min(1, Math.max(0, importance)),
      lastAccessedAt: now,
      accessCount: 0,
      source,
      sourceId,
      tags: [],
      createdAt: now,
    };
  }

  private estimateContextTokens(): number {
    let tokens = Math.ceil(this.mainContext.systemPrompt.length / 4);

    for (const fact of this.mainContext.coreMemory.humanFacts) {
      tokens += Math.ceil(fact.length / 4);
    }
    for (const fact of this.mainContext.coreMemory.agentFacts) {
      tokens += Math.ceil(fact.length / 4);
    }
    for (const entry of this.mainContext.workingMemory) {
      tokens += Math.ceil(entry.content.length / 4);
    }

    return tokens;
  }

  private updateStats(): void {
    this.stats = {
      ...this.stats,
      mainContextEntries: this.mainContext.workingMemory.length,
      recallStorageEntries: this.recallStorage.length,
      archivalStorageEntries: this.archivalStorage.length,
      mainContextTokens: this.mainContext.tokenCount,
      mainContextCapacity: this.config.maxMainContextTokens,
      mainContextUtilization: this.mainContext.tokenCount / this.config.maxMainContextTokens,
    };
    this.options.onStatsUpdate?.(this.stats);
  }

  /**
   * Get current memory statistics.
   */
  getStats(): Readonly<MemoryStats> {
    return this.stats;
  }

  /**
   * Get all entries in a specific tier.
   */
  getEntriesByTier(tier: MemoryTier): readonly MemoryEntry[] {
    switch (tier) {
      case "main_context":
        return this.mainContext.workingMemory.map((wm) => ({
          id: wm.id,
          tier: "main_context" as MemoryTier,
          content: wm.content,
          importance: wm.importance,
          lastAccessedAt: new Date(),
          accessCount: 0,
          source: "thinking_node" as const,
          tags: [],
          createdAt: new Date(),
        }));
      case "recall_storage":
        return this.recallStorage;
      case "archival_storage":
        return this.archivalStorage;
    }
  }

  /**
   * Clear all memory tiers.
   */
  clear(): void {
    this.mainContext.workingMemory = [];
    this.mainContext.coreMemory = { humanFacts: [], agentFacts: [] };
    this.mainContext.tokenCount = Math.ceil(this.mainContext.systemPrompt.length / 4);
    this.recallStorage = [];
    this.archivalStorage = [];
    this.updateStats();
    logger.info("Memory hierarchy cleared");
  }
}

// ============================================================
// Factory
// ============================================================

export function createMemoryHierarchy(
  options?: MemoryHierarchyOptions
): MemoryHierarchy {
  return new MemoryHierarchy(options);
}
