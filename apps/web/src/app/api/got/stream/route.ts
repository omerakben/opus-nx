import { z } from "zod";
import { GoTEngine, ThinkGraph } from "@opus-nx/core";
import { getCorrelationId, jsonError } from "@/lib/api-response";

export const maxDuration = 300;

const GoTStreamRequestSchema = z.object({
  problem: z.string().min(1).max(10000),
  strategy: z.enum(["bfs", "dfs", "best_first"]).default("bfs"),
  maxDepth: z.number().int().min(1).max(20).default(5),
  branchingFactor: z.number().int().min(1).max(10).default(3),
  maxThoughts: z.number().int().min(1).max(100).default(50),
  enableAggregation: z.boolean().default(true),
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  sessionId: z.string().uuid().optional(),
});

/**
 * POST /api/got/stream
 * Stream Graph of Thoughts reasoning progress via SSE.
 *
 * Events:
 *   got:start                  -> { strategy, config }
 *   got:depth_start            -> { depth, maxDepth, frontierSize }
 *   thought:generated          -> { id, content, score, state, depth, parentIds }
 *   thought:scored             -> { thoughtId, score, state }
 *   thought:generation_failed  -> { parentId, depth, error }
 *   thought:evaluation_failed  -> { thoughtId, error }
 *   aggregation:complete       -> { thought, sourceIds }
 *   aggregation:failed         -> { inputCount, error }
 *   got:progress               -> { stats }
 *   done                       -> { result }
 *   error                      -> { code, message }
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
    const parsed = GoTStreamRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError({
        status: 400,
        code: "INVALID_GOT_STREAM_REQUEST",
        message: "Invalid request",
        details: parsed.error.issues,
        correlationId,
        recoverable: true,
      });
    }

    const { problem, sessionId, ...config } = parsed.data;
    const encoder = new TextEncoder();
    const abortSignal = request.signal;

    const stream = new ReadableStream({
      async start(controller) {
        if (abortSignal.aborted) {
          controller.close();
          return;
        }

        let isAborted = false;
        const abortHandler = () => {
          isAborted = true;
          clearInterval(heartbeat);
        };
        abortSignal.addEventListener("abort", abortHandler, { once: true });

        const emit = (event: Record<string, unknown>) => {
          if (isAborted) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch (e) {
            console.warn("[GoT Stream] Emit failed, aborting stream:", e);
            isAborted = true;
          }
        };

        // Heartbeat every 15s to prevent idle-disconnect
        const heartbeat = setInterval(() => {
          if (!isAborted) {
            try {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            } catch (e) {
              console.warn("[GoT Stream] Heartbeat failed, stopping:", e);
              isAborted = true;
              clearInterval(heartbeat);
            }
          }
        }, 15_000);

        try {
          const engine = new GoTEngine({
            onThoughtGenerated: (thought) => {
              emit({
                type: "thought:generated",
                id: thought.id,
                content: thought.content.slice(0, 500),
                score: thought.score,
                state: thought.state,
                depth: thought.depth,
                parentIds: thought.parentIds,
              });
            },
            onThoughtScored: (thought) => {
              emit({
                type: "thought:scored",
                thoughtId: thought.id,
                score: thought.score,
                state: thought.state,
              });
            },
            onAggregation: (inputCount, output) => {
              emit({
                type: "aggregation:complete",
                thought: {
                  id: output.id,
                  content: output.content.slice(0, 500),
                  score: output.score,
                  state: output.state,
                  depth: output.depth,
                  parentIds: output.parentIds,
                },
                sourceIds: output.parentIds,
                inputCount,
              });
            },
            onDepthStart: (depth, maxDepth, frontierSize) => {
              emit({ type: "got:depth_start", depth, maxDepth, frontierSize });
            },
            onGenerationFailed: (parentId, depth, error) => {
              emit({ type: "thought:generation_failed", parentId, depth, error });
            },
            onEvaluationFailed: (thoughtId, error) => {
              emit({ type: "thought:evaluation_failed", thoughtId, error });
            },
            onAggregationFailed: (inputCount, error) => {
              emit({ type: "aggregation:failed", inputCount, error });
            },
            onProgress: (stats) => {
              emit({ type: "got:progress", stats });
            },
          });

          emit({
            type: "got:start",
            strategy: config.strategy,
            config: {
              maxDepth: config.maxDepth,
              branchingFactor: config.branchingFactor,
              maxThoughts: config.maxThoughts,
              enableAggregation: config.enableAggregation,
              effort: config.effort,
            },
          });

          const result = await engine.reason(problem, config);

          if (isAborted) { controller.close(); clearInterval(heartbeat); return; }

          // Persist GoT results as a thinking node if sessionId is provided
          let nodeId: string | undefined;
          let persistenceError: string | null = null;
          if (sessionId) {
            try {
              const thinkGraph = new ThinkGraph();
              const thinkingBlocks = [
                {
                  type: "thinking" as const,
                  thinking: `[Graph of Thoughts - ${config.strategy.toUpperCase()}]\n\n${result.reasoningSummary}\n\nBest thought IDs: ${result.graphState.bestThoughts.join(", ") || "none"}`,
                  signature: "synthetic-got",
                },
              ];
              const graphResult = await thinkGraph.persistThinkingNode(thinkingBlocks, {
                sessionId,
                inputQuery: problem,
                response: result.answer,
                nodeType: "got_result",
                tokenUsage: {
                  inputTokens: result.stats.totalTokens ?? 0,
                  outputTokens: 0,
                  thinkingTokens: 0,
                },
              });
              nodeId = graphResult.node.id;
            } catch (err) {
              console.warn("[API] Failed to persist GoT stream results:", {
                correlationId,
                sessionId,
                error: err instanceof Error ? err.message : String(err),
              });
              persistenceError = "GoT results could not be saved to this session.";
            }
          }

          emit({
            type: "done",
            result: {
              answer: result.answer,
              confidence: result.confidence,
              reasoningSummary: result.reasoningSummary,
              stats: result.stats,
              nodeId,
              graphState: {
                thoughts: result.graphState.thoughts,
                edges: result.graphState.edges,
                bestThoughts: result.graphState.bestThoughts,
                sessionId: result.graphState.sessionId,
              },
            },
            correlationId,
            degraded: !!persistenceError,
            persistenceError,
          });

          clearInterval(heartbeat);
          abortSignal.removeEventListener("abort", abortHandler);
          controller.close();
        } catch (error) {
          clearInterval(heartbeat);
          abortSignal.removeEventListener("abort", abortHandler);
          console.error("[API] GoT stream error:", { correlationId, error });

          const rawMsg = error instanceof Error ? error.message : String(error);
          let safeMessage = "An internal error occurred during GoT reasoning.";
          if (rawMsg.includes("rate limit") || rawMsg.includes("429")) {
            safeMessage = "API rate limit exceeded. Please wait and retry.";
          } else if (rawMsg.includes("timeout")) {
            safeMessage = "Request timed out. Try reducing depth or effort level.";
          } else if (rawMsg.includes("401") || rawMsg.includes("authentication")) {
            safeMessage = "API authentication failed. Check server configuration.";
          }

          emit({
            type: "error",
            code: "GOT_STREAM_FAILED",
            message: safeMessage,
            recoverable: false,
            correlationId,
          });
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
    console.error("[API] GoT stream setup error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "GOT_STREAM_SETUP_FAILED",
      message: error instanceof Error ? error.message : "Unknown error",
      correlationId,
    });
  }
}
