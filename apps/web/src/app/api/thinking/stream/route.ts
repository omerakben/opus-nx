import { z } from "zod";
import { ThinkingEngine, ThinkGraph } from "@opus-nx/core";
import { getSession, createSession, getLatestThinkingNode } from "@/lib/db";
import { getCorrelationId, jsonError } from "@/lib/api-response";

const StreamRequestSchema = z.object({
  query: z.string().min(1),
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
    const body = await request.json();
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

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let thinkingTokens = 0;
          let parentLinkStatus: "linked" | "not_applicable" | "lookup_failed" | "persist_failed" = "not_applicable";
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
              thinkingTokens += Math.ceil(chunk.length / 4);

              const data = JSON.stringify({
                type: "thinking",
                chunk,
                tokenCount: thinkingTokens,
              });

              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
            onCompactionStream: (summary) => {
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

          // Calculate actual thinking tokens from usage
          const actualThinkingTokens =
            (result.usage as unknown as { thinking_tokens?: number })
              .thinking_tokens ?? thinkingTokens;

          // Find the latest node in this session to link as parent
          let parentNodeId: string | undefined;
          try {
            const latestNode = await getLatestThinkingNode(sessionId);
            if (latestNode) {
              parentNodeId = latestNode.id;
              parentLinkStatus = "persist_failed";
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

          // Persist to graph after streaming completes
          const thinkGraph = new ThinkGraph();
          const graphResult = await thinkGraph.persistThinkingNode(
            result.thinkingBlocks,
            {
              sessionId,
              parentNodeId,
              inputQuery: query,
              tokenUsage: {
                ...result.usage,
                thinkingTokens: actualThinkingTokens,
              },
            }
          );
          if (parentNodeId && graphResult.linkedToParent) {
            parentLinkStatus = "linked";
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

          // Send completion event
          const doneData = JSON.stringify({
            type: "done",
            nodeId: graphResult.node.id,
            totalTokens: actualThinkingTokens,
            compacted: result.compacted,
            degraded:
              graphResult.degraded ||
              parentLinkStatus !== "linked" && parentLinkStatus !== "not_applicable" ||
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
