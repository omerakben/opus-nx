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

// Session-scoped memory instances
const memoryInstances = new Map<string, MemoryHierarchy>();

function getOrCreateMemory(sessionId: string): MemoryHierarchy {
  let memory = memoryInstances.get(sessionId);
  if (!memory) {
    memory = new MemoryHierarchy();
    memoryInstances.set(sessionId, memory);
    // Limit cache size
    if (memoryInstances.size > 100) {
      const firstKey = memoryInstances.keys().next().value as string;
      memoryInstances.delete(firstKey);
    }
  }
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
