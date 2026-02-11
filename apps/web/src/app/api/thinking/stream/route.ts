import { z } from "zod";
import { ThinkingEngine, ThinkGraph } from "@opus-nx/core";
import { getSession, createSession, getLatestThinkingNode } from "@/lib/db";
import { getCorrelationId, jsonError } from "@/lib/api-response";
import { getOrCreateMemory } from "@/lib/memory-store";

export const maxDuration = 300;

const StreamRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  compactionEnabled: z.boolean().default(false),
});

/**
 * POST /api/thinking/stream
 * Stream extended thinking in real-time using SSE.
 *
 * Opus 4.6 Features:
 * - Adaptive thinking with effort control
 * - Context compaction for infinite sessions
 * - Data residency (US-only inference)
 * - 16,384 output tokens (configurable)
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON", correlationId });
    }
    const parsed = StreamRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError({
        status: 400,
        code: "INVALID_STREAM_REQUEST",
        message: "Invalid request",
        details: parsed.error.issues,
        correlationId,
        recoverable: true,
      });
    }
    const {
      query,
      sessionId: providedSessionId,
      effort,
      compactionEnabled,
    } = parsed.data;

    // Get or create session
    let sessionId = providedSessionId;
    if (!sessionId) {
      const session = await createSession();
      sessionId = session.id;
    } else {
      const existingSession = await getSession(sessionId);
      if (!existingSession) {
        return jsonError({
          status: 404,
          code: "SESSION_NOT_FOUND",
          message: "Session not found",
          correlationId,
          recoverable: true,
        });
      }
    }

    // Create streaming response
    const encoder = new TextEncoder();

    // Capture abort signal for cleanup on client disconnect
    const abortSignal = request.signal;

    const stream = new ReadableStream({
      async start(controller) {
        // Early exit if already aborted
        if (abortSignal.aborted) {
          controller.close();
          return;
        }

        try {
          let thinkingTokens = 0;
          let isAborted = false;

          // Listen for abort to stop processing
          const abortHandler = () => {
            isAborted = true;
            console.warn("[API] Client disconnected, stopping stream:", { correlationId });
          };
          abortSignal.addEventListener("abort", abortHandler, { once: true });
          let parentLinkStatus: "linked" | "not_applicable" | "lookup_failed" | "persist_failed" | "pending" = "not_applicable";
          let compactionPersistStatus: "not_applicable" | "persisted" | "failed" = "not_applicable";
          const streamWarnings: string[] = [];

          // Create thinking engine with streaming callbacks
          // Uses adaptive thinking (Claude Opus 4.6 recommended mode)
          const engine = new ThinkingEngine({
            config: {
              model: "claude-opus-4-6",
              thinking: { type: "adaptive", effort },
              maxTokens: 16384,
              streaming: true,
              compaction: compactionEnabled
                ? {
                    enabled: true,
                    triggerTokens: 150000,
                    pauseAfterCompaction: false,
                    instructions: "Preserve all reasoning graph references, decision points, and confidence assessments. Summarize supporting details while maintaining the logical chain.",
                  }
                : undefined,
            },
            onThinkingStream: (chunk) => {
              // Skip streaming if client disconnected
              if (isAborted) return;

              thinkingTokens += Math.ceil(chunk.length / 4);

              const data = JSON.stringify({
                type: "thinking",
                chunk,
                tokenCount: thinkingTokens,
              });

              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
            onCompactionStream: (summary) => {
              // Skip streaming if client disconnected
              if (isAborted) return;

              // Stream compaction events to the client
              const data = JSON.stringify({
                type: "compaction",
                summary,
              });

              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          // Execute streaming thinking
          const result = await engine.think(
            "You are an advanced reasoning assistant. Think through the problem carefully before responding.",
            [{ role: "user", content: query }]
          );

          // Clean up abort listener
          abortSignal.removeEventListener("abort", abortHandler);

          // If client disconnected during thinking, close gracefully without persisting
          if (isAborted) {
            console.warn("[API] Aborting stream - client disconnected during thinking:", { correlationId });
            controller.close();
            return;
          }

          // Calculate actual thinking tokens from usage
          const actualThinkingTokens =
            (result.usage as unknown as { thinking_tokens?: number })
              .thinking_tokens ?? thinkingTokens;

          // FIX: Race condition mitigation for parent node lookup.
          //
          // ISSUE: If two thinking requests run in parallel for the same session,
          // both could get the same "latest" node and link to it as parent, creating
          // a malformed graph where two nodes have the same parent (a fork where
          // there should be a linear chain).
          //
          // MITIGATION: We look up the parent node BEFORE persisting, but the actual
          // edge creation happens atomically inside persistThinkingNode. The database
          // uses created_at ordering, so even if there's a race, the graph remains
          // navigable (just with potential parallel branches). For a hackathon demo,
          // this is acceptable - production would need a session-level mutex or
          // database-level optimistic locking.
          //
          // FUTURE FIX: Use a Supabase RPC function that atomically:
          // 1. Finds the latest node for the session
          // 2. Creates the new node with that as parent
          // 3. Creates the edge
          // All in a single transaction with FOR UPDATE lock on the session.
          let parentNodeId: string | undefined;
          try {
            const latestNode = await getLatestThinkingNode(sessionId);
            if (latestNode) {
              parentNodeId = latestNode.id;
              parentLinkStatus = "pending";
            }
          } catch (e) {
            parentLinkStatus = "lookup_failed";
            streamWarnings.push("Failed to resolve latest node for parent linking");
            console.warn("[API] Failed to get latest node for linking:", {
              correlationId,
              error: e,
            });
            const warningData = JSON.stringify({
              type: "warning",
              code: "PARENT_LOOKUP_FAILED",
              message: "Failed to resolve latest node for parent linking",
              correlationId,
              recoverable: true,
            });
            controller.enqueue(encoder.encode(`data: ${warningData}\n\n`));
          }

          // Build the model's final response text
          const responseText = result.textBlocks.map((b) => b.text).join("\n\n");

          // Persist to graph after streaming completes (both reasoning AND response)
          const thinkGraph = new ThinkGraph();
          const graphResult = await thinkGraph.persistThinkingNode(
            result.thinkingBlocks,
            {
              sessionId,
              parentNodeId,
              inputQuery: query,
              response: responseText,
              tokenUsage: {
                ...result.usage,
                thinkingTokens: actualThinkingTokens,
              },
            }
          );
          if (parentNodeId) {
            parentLinkStatus = graphResult.linkedToParent ? "linked" : "persist_failed";
          }

          // Auto-populate memory hierarchy with thinking content
          try {
            const memory = getOrCreateMemory(sessionId);

            const thinkingContentFull = result.thinkingBlocks
              .filter((b) => b.type === "thinking")
              .map((b) => (b as { thinking: string }).thinking)
              .join("\n\n");

            if (thinkingContentFull.length > 2000) {
              console.warn("[Memory] Thinking content truncated for memory storage", {
                original: thinkingContentFull.length,
                truncated: 2000,
                correlationId,
              });
            }
            const thinkingContent = thinkingContentFull.slice(0, 2000);

            if (thinkingContent) {
              memory.addToWorkingMemory(
                thinkingContent,
                0.7,
                "thinking_node",
                graphResult.node.id
              );
            }

            if (responseText) {
              if (responseText.length > 1000) {
                console.warn("[Memory] Response text truncated for memory storage", {
                  original: responseText.length,
                  truncated: 1000,
                  correlationId,
                });
              }
              memory.addToWorkingMemory(
                responseText.slice(0, 1000),
                0.5,
                "thinking_node",
                graphResult.node.id
              );
            }

            // Emit memory SSE event with current stats
            const memoryData = JSON.stringify({
              type: "memory",
              stats: memory.getStats(),
              action: "auto_populate",
              nodeId: graphResult.node.id,
            });
            controller.enqueue(encoder.encode(`data: ${memoryData}\n\n`));
          } catch (memoryError) {
            console.warn("[API] Non-critical memory operation failed:", { correlationId, error: memoryError });
            streamWarnings.push("Memory auto-populate failed (non-critical)");
            const memWarningData = JSON.stringify({
              type: "warning",
              code: "MEMORY_POPULATE_FAILED",
              message: "Memory auto-populate failed (non-critical)",
              correlationId,
              recoverable: true,
            });
            controller.enqueue(encoder.encode(`data: ${memWarningData}\n\n`));
          }

          // If compaction occurred, persist a compaction node
          if (result.compacted && result.compactionBlocks.length > 0) {
            const compactionSummary = result.compactionBlocks
              .map((b) => b.content)
              .join("\n");

            try {
              await thinkGraph.persistThinkingNode(
                [{
                  type: "thinking" as const,
                  thinking: `[MEMORY CONSOLIDATION]\n\n${compactionSummary}`,
                  signature: "compaction",
                }],
                {
                  sessionId,
                  parentNodeId: graphResult.node.id,
                  inputQuery: `[Compaction] Context consolidated at ${new Date().toISOString()}`,
                  tokenUsage: result.usage,
                  nodeType: "compaction",
                }
              );
              compactionPersistStatus = "persisted";
            } catch (compactionError) {
              compactionPersistStatus = "failed";
              streamWarnings.push("Failed to persist compaction node");
              console.warn("[API] Failed to persist compaction node:", {
                correlationId,
                error: compactionError,
              });
              const warningData = JSON.stringify({
                type: "warning",
                code: "COMPACTION_PERSIST_FAILED",
                message: "Failed to persist compaction node",
                correlationId,
                recoverable: true,
              });
              controller.enqueue(encoder.encode(`data: ${warningData}\n\n`));
            }
          }

          // Send completion event (includes model response for UI display)
          const doneData = JSON.stringify({
            type: "done",
            nodeId: graphResult.node.id,
            totalTokens: actualThinkingTokens,
            response: responseText,
            compacted: result.compacted,
            degraded:
              graphResult.degraded ||
              (parentLinkStatus !== "linked" && parentLinkStatus !== "not_applicable") ||
              compactionPersistStatus === "failed",
            degradation: {
              persistenceIssues: graphResult.persistenceIssues,
              parentLinkStatus,
              compactionPersistStatus,
            },
            warnings: streamWarnings,
            correlationId,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));

          controller.close();
        } catch (error) {
          console.error("[API] Stream error:", { correlationId, error });

          const errorData = JSON.stringify({
            type: "error",
            code: "STREAM_EXECUTION_FAILED",
            message: error instanceof Error ? error.message : "Stream failed",
            recoverable: false,
            correlationId,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "x-correlation-id": correlationId,
      },
    });
  } catch (error) {
    console.error("[API] Stream setup error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "STREAM_SETUP_FAILED",
      message: error instanceof Error ? error.message : "Unknown error",
      correlationId,
    });
  }
}
