import { z } from "zod";
import { GoTEngine } from "@opus-nx/core";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

export const maxDuration = 300;

const GoTRequestSchema = z.object({
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
 * POST /api/got
 * Run Graph of Thoughts reasoning on a problem
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const body = await request.json();
    const parsed = GoTRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError({
        status: 400,
        code: "INVALID_GOT_REQUEST",
        message: "Invalid request",
        details: parsed.error.issues,
        correlationId,
        recoverable: true,
      });
    }

    const { problem, sessionId: _sessionId, ...config } = parsed.data;

    const engine = new GoTEngine();
    const result = await engine.reason(problem, config);

    return jsonSuccess(
      {
        answer: result.answer,
        confidence: result.confidence,
        reasoningSummary: result.reasoningSummary,
        stats: result.stats,
        graphState: {
          thoughts: result.graphState.thoughts,
          edges: result.graphState.edges,
          bestThoughts: result.graphState.bestThoughts,
          sessionId: result.graphState.sessionId,
        },
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] GoT reasoning error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "GOT_REASONING_FAILED",
      message: error instanceof Error ? error.message : "GoT reasoning failed",
      correlationId,
    });
  }
}
