import { z } from "zod";
import { MemoryHierarchy } from "@opus-nx/core";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

const MemoryOperationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("archival_insert"),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
  }),
  z.object({
    operation: z.literal("archival_search"),
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  z.object({
    operation: z.literal("recall_search"),
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  z.object({
    operation: z.literal("core_memory_append"),
    section: z.enum(["human", "agent"]),
    content: z.string().min(1),
  }),
  z.object({
    operation: z.literal("stats"),
  }),
]);

// Session-scoped memory instances with LRU eviction.
// NOTE: Module-level state does NOT survive across serverless invocations
// (e.g., Vercel Functions). Each cold start creates a fresh Map. For
// production persistence, replace with Redis or a database-backed store.
const memoryInstances = new Map<string, { memory: MemoryHierarchy; lastAccess: number }>();
const MAX_MEMORY_INSTANCES = 100;

function getOrCreateMemory(sessionId: string): MemoryHierarchy {
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
    if (lruKey) memoryInstances.delete(lruKey);
  }

  memoryInstances.set(sessionId, { memory, lastAccess: Date.now() });
  return memory;
}

/**
 * POST /api/memory
 * Execute memory operations against the hierarchical memory system
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const body = await request.json();
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "default";

    const parsed = MemoryOperationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError({
        status: 400,
        code: "INVALID_MEMORY_OPERATION",
        message: "Invalid memory operation",
        details: parsed.error.issues,
        correlationId,
        recoverable: true,
      });
    }

    const memory = getOrCreateMemory(sessionId);
    const op = parsed.data;

    if (op.operation === "stats") {
      const stats = memory.getStats();
      return jsonSuccess({ stats, sessionId }, { correlationId });
    }

    const result = await memory.executeOperation(op);

    return jsonSuccess(
      {
        ...result,
        stats: memory.getStats(),
        sessionId,
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Memory operation error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "MEMORY_OPERATION_FAILED",
      message: error instanceof Error ? error.message : "Memory operation failed",
      correlationId,
    });
  }
}
