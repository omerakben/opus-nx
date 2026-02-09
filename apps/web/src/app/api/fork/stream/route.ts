import { z } from "zod";
import { ThinkForkEngine } from "@opus-nx/core";
import { getCorrelationId, jsonError } from "@/lib/api-response";
import { createForkAnalysis } from "@/lib/db";

export const maxDuration = 800;

const ForkStyleSchema = z.enum(["conservative", "aggressive", "balanced", "contrarian"]);

const StreamForkRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  styles: z.array(ForkStyleSchema).min(2).optional(),
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  branchGuidance: z.array(z.object({
    style: ForkStyleSchema,
    guidance: z.string().min(1).max(2000),
  })).optional(),
  mode: z.enum(["fork", "debate"]).default("fork"),
  debateRounds: z.number().min(1).max(5).default(2),
});

/**
 * POST /api/fork/stream
 * Stream ThinkFork / Debate progress via SSE.
 *
 * Events:
 *   fork:start           — analysis beginning
 *   branch:start         — individual branch starting
 *   branch:complete      — individual branch result
 *   branch:error         — branch failed
 *   comparison:start     — comparison analysis starting
 *   comparison:complete  — convergence/divergence extracted
 *   debate:start         — debate rounds beginning (after initial fork)
 *   debate:entry_start   — debate round entry starting
 *   debate:entry_complete— debate round entry done
 *   debate:round_complete— all styles in a round finished
 *   done                 — full result payload
 *   error                — unrecoverable error
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const body = await request.json();
    const parsed = StreamForkRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError({
        status: 400,
        code: "INVALID_STREAM_FORK_REQUEST",
        message: "Invalid request",
        details: parsed.error.issues,
        correlationId,
        recoverable: true,
      });
    }

    const { query, sessionId, styles, effort, branchGuidance, mode, debateRounds } = parsed.data;
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
          } catch {
            // Client disconnected or controller closed
            isAborted = true;
          }
        };

        // Heartbeat every 15s to prevent idle-disconnect
        const heartbeat = setInterval(() => {
          if (!isAborted) {
            try {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            } catch {
              // Controller already closed — stop heartbeat
              isAborted = true;
              clearInterval(heartbeat);
            }
          }
        }, 15_000);

        try {
          let branchIndex = 0;
          const activeStyles = styles ?? ["conservative", "aggressive", "balanced", "contrarian"];

          const engine = new ThinkForkEngine({
            onBranchStart: (style) => {
              emit({ type: "branch:start", style, index: branchIndex++, total: activeStyles.length });
            },
            onBranchComplete: (result) => {
              if (result.error) {
                emit({ type: "branch:error", style: result.style, error: result.error });
              } else {
                emit({
                  type: "branch:complete",
                  style: result.style,
                  conclusion: result.conclusion,
                  confidence: result.confidence,
                  keyInsights: result.keyInsights,
                  risks: result.risks,
                  opportunities: result.opportunities,
                  assumptions: result.assumptions,
                });
              }
            },
            onComparisonStart: () => {
              emit({ type: "comparison:start" });
            },
            onComparisonComplete: (comparison) => {
              emit({
                type: "comparison:complete",
                convergencePoints: comparison.convergencePoints,
                divergencePoints: comparison.divergencePoints,
                metaInsight: comparison.metaInsight,
                recommendedApproach: comparison.recommendedApproach,
              });
            },
            onDebateStart: (totalRounds) => {
              emit({ type: "debate:start", totalRounds });
            },
            onDebateRoundStart: (round, style) => {
              emit({ type: "debate:entry_start", round, style });
            },
            onDebateRoundComplete: (entry) => {
              emit({
                type: "debate:entry_complete",
                round: entry.round,
                style: entry.style,
                response: entry.response,
                confidence: entry.confidence,
                positionChanged: entry.positionChanged,
                keyCounterpoints: entry.keyCounterpoints,
                concessions: entry.concessions,
              });
            },
            onDebateRoundAllComplete: (round) => {
              emit({ type: "debate:round_complete", round });
            },
          });

          emit({ type: "fork:start", styles: activeStyles, mode });

          if (mode === "debate") {
            const result = await engine.debate(query, {
              styles,
              effort,
              rounds: debateRounds,
            });

            if (isAborted) { controller.close(); clearInterval(heartbeat); return; }

            const responsePayload = {
              initialFork: {
                branches: result.initialFork.branches,
                convergencePoints: result.initialFork.convergencePoints,
                divergencePoints: result.initialFork.divergencePoints,
                metaInsight: result.initialFork.metaInsight,
                recommendedApproach: result.initialFork.recommendedApproach,
              },
              rounds: result.rounds,
              finalPositions: result.finalPositions,
              consensus: result.consensus,
              consensusConfidence: result.consensusConfidence,
              totalRounds: result.totalRounds,
              totalTokensUsed: result.totalTokensUsed,
              totalDurationMs: result.totalDurationMs,
            };

            // Persist if sessionId provided
            let analysisId: string | undefined;
            let persistenceError: string | null = null;
            if (sessionId) {
              try {
                const saved = await createForkAnalysis({
                  sessionId,
                  query,
                  mode: "debate",
                  result: responsePayload as unknown as Record<string, unknown>,
                });
                analysisId = saved.id;
              } catch (err) {
                console.error("[API] Failed to persist debate analysis:", {
                  correlationId, sessionId,
                  error: err instanceof Error ? err.message : String(err),
                });
                persistenceError = "Results could not be saved to this session.";
              }
            }

            emit({ type: "done", result: responsePayload, analysisId, correlationId, degraded: !!persistenceError, persistenceError });
          } else {
            const result = await engine.fork(query, {
              styles,
              effort,
              analyzeConvergence: true,
              branchGuidance,
            });

            if (isAborted) { controller.close(); clearInterval(heartbeat); return; }

            const responsePayload = {
              branches: result.branches,
              convergencePoints: result.convergencePoints,
              divergencePoints: result.divergencePoints,
              metaInsight: result.metaInsight,
              recommendedApproach: result.recommendedApproach,
              appliedGuidance: result.appliedGuidance,
            };

            // Persist if sessionId provided
            let analysisId: string | undefined;
            let persistenceError: string | null = null;
            if (sessionId) {
              try {
                const saved = await createForkAnalysis({
                  sessionId,
                  query,
                  mode: "fork",
                  result: responsePayload as unknown as Record<string, unknown>,
                });
                analysisId = saved.id;
              } catch (err) {
                console.error("[API] Failed to persist fork analysis:", {
                  correlationId, sessionId,
                  error: err instanceof Error ? err.message : String(err),
                });
                persistenceError = "Results could not be saved to this session.";
              }
            }

            emit({ type: "done", result: responsePayload, analysisId, correlationId, degraded: !!persistenceError, persistenceError });
          }

          clearInterval(heartbeat);
          abortSignal.removeEventListener("abort", abortHandler);
          controller.close();
        } catch (error) {
          clearInterval(heartbeat);
          abortSignal.removeEventListener("abort", abortHandler);
          console.error("[API] Fork stream error:", { correlationId, error });

          // Sanitize error message — never leak internal details
          const rawMsg = error instanceof Error ? error.message : String(error);
          let safeMessage = "An internal error occurred during analysis.";
          if (rawMsg.includes("rate limit") || rawMsg.includes("429")) {
            safeMessage = "API rate limit exceeded. Please wait and retry.";
          } else if (rawMsg.includes("timeout")) {
            safeMessage = "Request timed out. Try reducing effort level or query complexity.";
          } else if (rawMsg.includes("401") || rawMsg.includes("authentication")) {
            safeMessage = "API authentication failed. Check server configuration.";
          }

          emit({
            type: "error",
            code: "FORK_STREAM_FAILED",
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
    console.error("[API] Fork stream setup error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "FORK_STREAM_SETUP_FAILED",
      message: error instanceof Error ? error.message : "Unknown error",
      correlationId,
    });
  }
}
