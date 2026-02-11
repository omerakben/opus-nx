import { MemoryHierarchy } from "@opus-nx/core";

/**
 * Shared, session-scoped MemoryHierarchy instances with LRU eviction.
 *
 * NOTE: Module-level state does NOT survive across serverless invocations
 * (e.g., Vercel Functions). Each cold start creates a fresh Map. For
 * production persistence, replace with Redis or a database-backed store.
 */
const memoryInstances = new Map<string, { memory: MemoryHierarchy; lastAccess: number }>();
const MAX_MEMORY_INSTANCES = 100;

export function getOrCreateMemory(sessionId: string): MemoryHierarchy {
  const existing = memoryInstances.get(sessionId);
  if (existing) {
    // Update access time and move to end of Map (most recently used)
    existing.lastAccess = Date.now();
    memoryInstances.delete(sessionId);
    memoryInstances.set(sessionId, existing);
    return existing.memory;
  }

  const memory = new MemoryHierarchy();

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

  memoryInstances.set(sessionId, { memory, lastAccess: Date.now() });
  return memory;
}
