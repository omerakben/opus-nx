import { z } from "zod";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { getOrCreateMemoryAsync, persistFullSnapshot } from "@/lib/memory-store";

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
  z.object({
    operation: z.literal("list_entries"),
    limit: z.number().int().min(1).max(50).optional(),
  }),
]);

// Operations that mutate memory state and need to be persisted
const MUTATION_OPS = new Set([
  "archival_insert",
  "core_memory_append",
  "evict_to_archival",
  "promote_to_working",
]);

/**
 * POST /api/memory
 * Execute memory operations against the hierarchical memory system.
 * Uses async hydration to ensure memory state is loaded from DB on cold start.
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON", correlationId });
    }
    const sessionId = typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;

    if (!sessionId) {
      return jsonError({
        status: 400,
        code: "SESSION_ID_REQUIRED",
        message: "sessionId is required for memory operations",
        correlationId,
        recoverable: true,
      });
    }

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

    // Use async version to guarantee hydration from DB on cold start
    const memory = await getOrCreateMemoryAsync(sessionId);
    const op = parsed.data;

    if (op.operation === "stats") {
      const stats = memory.getStats();
      return jsonSuccess({ stats, sessionId }, { correlationId });
    }

    if (op.operation === "list_entries") {
      const limit = op.limit ?? 20;
      const tiers = ["main_context", "recall_storage", "archival_storage"] as const;
      const allEntries = tiers.flatMap((tier) =>
        memory.getEntriesByTier(tier).map((e) => ({
          id: e.id,
          tier: e.tier,
          content: e.content,
          importance: e.importance,
          tags: e.tags,
          source: e.source,
          createdAt: e.createdAt.toISOString(),
        }))
      );
      // Sort by creation date descending
      allEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return jsonSuccess(
        { entries: allEntries.slice(0, limit), stats: memory.getStats(), sessionId },
        { correlationId }
      );
    }

    const result = await memory.executeOperation(op);

    // Persist to Supabase after mutations (fire-and-forget to keep response fast)
    if (MUTATION_OPS.has(op.operation)) {
      persistFullSnapshot(sessionId, memory).catch((err) => {
        console.warn("[API] Memory persistence failed:", { correlationId, error: err });
      });
    }

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
