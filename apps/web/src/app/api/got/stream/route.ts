import { z } from "zod";
import { GoTEngine } from "@opus-nx/core";
import { createThinkingNode } from "@/lib/db";
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
        let isAborted = abortSignal.aborted;
        let isClosed = false;
        let heartbeat: ReturnType<typeof setInterval> | null = null;
        let abortHandler: (() => void) | null = null;

        const safeClose = () => {
          if (isClosed) return;
          isClosed = true;
          try {
            controller.close();
          } catch {
            // Stream may already be closed by runtime.
          }
        };

        const cleanup = () => {
          if (heartbeat !== null) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
          if (abortHandler) {
            abortSignal.removeEventListener("abort", abortHandler);
          }
        };

        const enqueue = (chunk: Uint8Array): boolean => {
          if (isAborted || isClosed) return false;
          try {
            controller.enqueue(chunk);
            return true;
          } catch (e) {
            console.warn("[GoT Stream] Enqueue failed, closing stream:", e);
            isAborted = true;
            cleanup();
            safeClose();
            return false;
          }
        };

        const emit = (event: Record<string, unknown>) => {
          enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        abortHandler = () => {
          isAborted = true;
          cleanup();
          safeClose();
        };
        abortSignal.addEventListener("abort", abortHandler, { once: true });

        if (isAborted) {
          cleanup();
          safeClose();
          return;
        }

        // Heartbeat every 15s to prevent idle-disconnect.
        heartbeat = setInterval(() => {
          if (isAborted || isClosed) {
            cleanup();
            return;
          }
          enqueue(encoder.encode(`: heartbeat\n\n`));
        }, 15_000);

        try {
          const engine = new GoTEngine({
            onThoughtGenerated: (thought) => {
              emit({
                type: "thought:generated",
                id: thought.id,
                content: thought.content,
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
                  content: output.content,
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

          if (isAborted || isClosed) {
            cleanup();
            safeClose();
            return;
          }

          // Persist GoT results with full graph state if sessionId is provided
          let nodeId: string | undefined;
          let persistenceError: string | null = null;
          if (sessionId) {
            try {
              const dbNode = await createThinkingNode({
                sessionId,
                reasoning: `[Graph of Thoughts - ${config.strategy.toUpperCase()}]\n\n${result.reasoningSummary}`,
                response: result.answer,
                inputQuery: problem,
                confidenceScore: result.confidence,
                nodeType: "got_result",
                signature: "synthetic-got",
                tokenUsage: {
                  inputTokens: result.stats.totalTokens ?? 0,
                  outputTokens: 0,
                  thinkingTokens: 0,
                },
                structuredReasoning: {
                  type: "got_graph",
                  graphState: {
                    thoughts: result.graphState.thoughts,
                    edges: result.graphState.edges,
                    bestThoughts: result.graphState.bestThoughts,
                  },
                  answer: result.answer,
                  confidence: result.confidence,
                  reasoningSummary: result.reasoningSummary,
                  stats: result.stats,
                  config,
                },
              });
              nodeId = dbNode.id;
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

          cleanup();
          safeClose();
        } catch (error) {
          cleanup();
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
          safeClose();
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
