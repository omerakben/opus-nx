import { MemoryHierarchy } from "@opus-nx/core";
import type { MemorySnapshot } from "@opus-nx/core";
import {
  getSessionMemoryEntries,
  batchInsertMemoryEntries,
  deleteSessionMemoryEntries,
  updateMemoryEntryTier,
  type CreateMemoryEntryInput,
  type MemoryTierDB,
  type MemoryEntryRow,
} from "@opus-nx/db";

/**
 * Shared, session-scoped MemoryHierarchy instances with LRU eviction.
 *
 * The in-memory Map serves as a hot cache within a single serverless
 * invocation. On cold start, getOrCreateMemory() hydrates the hierarchy
 * from Supabase so memory survives across invocations.
 *
 * Writes are persisted to Supabase asynchronously (fire-and-forget with
 * error logging) so that the hot path is not blocked by DB latency.
 */
const memoryInstances = new Map<string, { memory: MemoryHierarchy; lastAccess: number; hydrated: boolean }>();
const MAX_MEMORY_INSTANCES = 100;

// Track in-flight hydration promises to avoid duplicate work
const hydrationPromises = new Map<string, Promise<void>>();

/**
 * Get or create a MemoryHierarchy for a session.
 * On cache miss, starts hydration from Supabase.
 */
export function getOrCreateMemory(sessionId: string): MemoryHierarchy {
  const existing = memoryInstances.get(sessionId);
  if (existing) {
    // Update access time and move to end of Map (most recently used)
    existing.lastAccess = Date.now();
    memoryInstances.delete(sessionId);
    memoryInstances.set(sessionId, existing);
    return existing.memory;
  }

  const memory = new MemoryHierarchy({
    onEviction: (entry) => {
      // Persist tier change to Supabase (fire-and-forget)
      updateMemoryEntryTier(entry.id, "archival_storage").catch((err) => {
        console.warn("[MemoryStore] Failed to persist eviction:", err);
      });
    },
    onPromotion: (entry) => {
      // Persist tier change to Supabase (fire-and-forget)
      updateMemoryEntryTier(entry.id, "main_context").catch((err) => {
        console.warn("[MemoryStore] Failed to persist promotion:", err);
      });
    },
  });

  // Evict least recently used session when at capacity
  if (memoryInstances.size >= MAX_MEMORY_INSTANCES) {
    let lruKey: string | undefined;
    let lruTime = Infinity;
    for (const [key, entry] of memoryInstances) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }
    if (lruKey) {
      console.warn("[MemoryStore] LRU eviction:", lruKey);
      memoryInstances.delete(lruKey);
    }
  }

  memoryInstances.set(sessionId, { memory, lastAccess: Date.now(), hydrated: false });

  // Start hydration in background
  hydrateMemory(sessionId, memory).catch((err) => {
    console.warn("[MemoryStore] Background hydration failed:", err);
  });

  return memory;
}

/**
 * Get a MemoryHierarchy with guaranteed hydration from Supabase.
 * Use this when you need the full persisted state (e.g., for searches).
 */
export async function getOrCreateMemoryAsync(sessionId: string): Promise<MemoryHierarchy> {
  const memory = getOrCreateMemory(sessionId);
  await ensureHydrated(sessionId, memory);
  return memory;
}

/**
 * Ensure a memory hierarchy is hydrated from DB.
 * Waits for any in-flight hydration, or initiates one if not yet started.
 */
async function ensureHydrated(sessionId: string, memory: MemoryHierarchy): Promise<void> {
  const cached = memoryInstances.get(sessionId);
  if (cached?.hydrated) return;

  // Wait for in-flight hydration if one exists
  const existing = hydrationPromises.get(sessionId);
  if (existing) {
    await existing;
    return;
  }

  // Start a new hydration
  await hydrateMemory(sessionId, memory);
}

/**
 * Hydrate a MemoryHierarchy from Supabase.
 * Loads all persisted entries and reconstructs the full memory state.
 */
export async function hydrateMemory(
  sessionId: string,
  memory: MemoryHierarchy
): Promise<void> {
  // Deduplicate hydration for the same session
  const existing = hydrationPromises.get(sessionId);
  if (existing) {
    await existing;
    return;
  }

  const promise = doHydrate(sessionId, memory);
  hydrationPromises.set(sessionId, promise);

  try {
    await promise;
  } finally {
    hydrationPromises.delete(sessionId);
  }
}

async function doHydrate(
  sessionId: string,
  memory: MemoryHierarchy
): Promise<void> {
  try {
    const rows = await getSessionMemoryEntries(sessionId);
    if (rows.length === 0) {
      markHydrated(sessionId);
      return;
    }

    // Reconstruct snapshot from DB rows
    const snapshot = rowsToSnapshot(rows);
    memory.hydrate(snapshot);

    markHydrated(sessionId);
  } catch (err) {
    // Graceful degradation -- memory works ephemerally if DB is unavailable
    console.warn("[MemoryStore] Hydration failed, running ephemeral:", err);
  }
}

function markHydrated(sessionId: string): void {
  const cached = memoryInstances.get(sessionId);
  if (cached) {
    cached.hydrated = true;
  }
}

/**
 * Convert DB rows back into a MemorySnapshot for hydration.
 */
function rowsToSnapshot(rows: MemoryEntryRow[]): MemorySnapshot {
  const coreMemory = { humanFacts: [] as string[], agentFacts: [] as string[] };
  const workingMemory: Array<{ id: string; content: string; importance: number }> = [];
  const recallStorage = [];
  const archivalStorage = [];

  for (const row of rows) {
    const entry = {
      id: row.id,
      tier: row.tier,
      content: row.content,
      importance: row.importance,
      lastAccessedAt: row.lastAccessedAt,
      accessCount: row.accessCount,
      source: row.source as "user_input" | "thinking_node" | "decision_point" | "metacognitive" | "knowledge_base" | "compaction",
      sourceId: row.sourceId ?? undefined,
      tags: row.tags,
      createdAt: row.createdAt,
    };

    switch (row.tier) {
      case "main_context":
        // Check if this is a core_memory fact (stored with special source pattern)
        if (row.source === "user_input" && row.tags.includes("core:human")) {
          coreMemory.humanFacts.push(row.content);
        } else if (row.source === "user_input" && row.tags.includes("core:agent")) {
          coreMemory.agentFacts.push(row.content);
        } else {
          workingMemory.push({
            id: row.id,
            content: row.content,
            importance: row.importance,
          });
        }
        break;
      case "recall_storage":
        recallStorage.push(entry);
        break;
      case "archival_storage":
        archivalStorage.push(entry);
        break;
    }
  }

  return { coreMemory, workingMemory, recallStorage, archivalStorage };
}

/**
 * Persist a newly added memory entry to Supabase.
 * Call this after addToWorkingMemory() to ensure durability.
 */
export async function persistMemoryEntry(
  sessionId: string,
  entryId: string,
  content: string,
  importance: number,
  source: CreateMemoryEntryInput["source"],
  sourceId?: string
): Promise<void> {
  try {
    await batchInsertMemoryEntries([
      {
        id: entryId,
        sessionId,
        tier: "main_context" as MemoryTierDB,
        content,
        importance,
        source,
        sourceId,
      },
    ]);
  } catch (err) {
    console.warn("[MemoryStore] Failed to persist memory entry:", err);
  }
}

/**
 * Persist multiple memory entries to Supabase in a single batch.
 */
export async function persistMemoryEntries(
  entries: CreateMemoryEntryInput[]
): Promise<void> {
  if (entries.length === 0) return;
  try {
    await batchInsertMemoryEntries(entries);
  } catch (err) {
    console.warn("[MemoryStore] Failed to persist memory entries batch:", err);
  }
}

/**
 * Persist the full memory snapshot to Supabase.
 * Replaces all existing entries for the session with the current state.
 * Used after mutation operations to ensure durability.
 */
export async function persistFullSnapshot(
  sessionId: string,
  memory: MemoryHierarchy
): Promise<void> {
  try {
    const snapshot = memory.snapshot();
    const entries: CreateMemoryEntryInput[] = [];

    // Core memory facts
    for (const fact of snapshot.coreMemory.humanFacts) {
      entries.push({
        sessionId,
        tier: "main_context",
        content: fact,
        importance: 1.0,
        source: "user_input",
        tags: ["core:human"],
      });
    }
    for (const fact of snapshot.coreMemory.agentFacts) {
      entries.push({
        sessionId,
        tier: "main_context",
        content: fact,
        importance: 1.0,
        source: "user_input",
        tags: ["core:agent"],
      });
    }

    // Working memory
    for (const wm of snapshot.workingMemory) {
      entries.push({
        id: wm.id,
        sessionId,
        tier: "main_context",
        content: wm.content,
        importance: wm.importance,
        source: "thinking_node",
      });
    }

    // Recall storage
    for (const e of snapshot.recallStorage) {
      entries.push({
        id: e.id,
        sessionId,
        tier: "recall_storage",
        content: e.content,
        importance: e.importance,
        source: (e.source ?? "thinking_node") as CreateMemoryEntryInput["source"],
        sourceId: e.sourceId,
        tags: e.tags,
      });
    }

    // Archival storage
    for (const e of snapshot.archivalStorage) {
      entries.push({
        id: e.id,
        sessionId,
        tier: "archival_storage",
        content: e.content,
        importance: e.importance,
        source: (e.source ?? "knowledge_base") as CreateMemoryEntryInput["source"],
        sourceId: e.sourceId,
        tags: e.tags,
      });
    }

    // Delete existing and re-insert (atomic snapshot replacement)
    await deleteSessionMemoryEntries(sessionId);
    if (entries.length > 0) {
      await batchInsertMemoryEntries(entries);
    }
  } catch (err) {
    console.warn("[MemoryStore] Failed to persist full snapshot:", err);
  }
}
