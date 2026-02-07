import { ThinkingEngine, ThinkGraph } from "@opus-nx/core";
import { getSession, createSession } from "@/lib/db";

interface StreamRequest {
  query: string;
  sessionId?: string;
  effort?: "low" | "medium" | "high" | "max";
  /** Enable context compaction for long sessions (Opus 4.6 beta) */
  compactionEnabled?: boolean;
}

/**
 * POST /api/thinking/stream
 * Stream extended thinking in real-time using SSE.
 *
 * Opus 4.6 Features:
 * - Adaptive thinking with effort control
 * - Context compaction for infinite sessions
 * - Data residency (US-only inference)
 * - 128K output tokens
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StreamRequest;
    const {
      query,
      sessionId: providedSessionId,
      effort = "high",
      compactionEnabled = false,
    } = body;

    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ error: { message: "Query is required" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get or create session
    let sessionId = providedSessionId;
    if (!sessionId) {
      const session = await createSession();
      sessionId = session.id;
    } else {
      const existingSession = await getSession(sessionId);
      if (!existingSession) {
        return new Response(
          JSON.stringify({ error: { message: "Session not found" } }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Create streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let thinkingTokens = 0;

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

          // Persist to graph after streaming completes
          const thinkGraph = new ThinkGraph();
          const graphResult = await thinkGraph.persistThinkingNode(
            result.thinkingBlocks,
            {
              sessionId,
              inputQuery: query,
              tokenUsage: {
                ...result.usage,
                thinkingTokens: actualThinkingTokens,
              },
            }
          );

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
                }
              );
            } catch {
              // Non-critical - continue without compaction node
            }
          }

          // Send completion event
          const doneData = JSON.stringify({
            type: "done",
            nodeId: graphResult.node.id,
            totalTokens: actualThinkingTokens,
            compacted: result.compacted,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));

          controller.close();
        } catch (error) {
          console.error("[API] Stream error:", error);

          const errorData = JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Stream failed",
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
      },
    });
  } catch (error) {
    console.error("[API] Stream setup error:", error);
    return new Response(
      JSON.stringify({
        error: { message: error instanceof Error ? error.message : "Unknown error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
