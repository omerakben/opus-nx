import { z } from "zod";
import { GoTEngine, ThinkGraph } from "@opus-nx/core";
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON", correlationId });
    }
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

    const { problem, sessionId, ...config } = parsed.data;

    const engine = new GoTEngine();
    const result = await engine.reason(problem, config);

    // Persist GoT results as a thinking node if sessionId is provided
    let nodeId: string | undefined;
    let persistenceError: string | null = null;
    if (sessionId) {
      try {
        const thinkGraph = new ThinkGraph();
        // Build a synthetic thinking block from the GoT reasoning summary
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
        console.warn("[API] Failed to persist GoT results:", {
          correlationId,
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
        persistenceError = "GoT results could not be saved to this session.";
      }
    }

    return jsonSuccess(
      {
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
        degraded: !!persistenceError,
        persistenceError,
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
