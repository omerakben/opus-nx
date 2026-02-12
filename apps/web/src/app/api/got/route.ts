import { z } from "zod";
import { GoTEngine } from "@opus-nx/core";
import { createThinkingNode, getSessionGoTResults } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { isValidUuid } from "@/lib/validation";

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
 * GET /api/got?sessionId=X
 * Retrieve persisted GoT results for a session
 */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId || !isValidUuid(sessionId)) {
      return jsonError({
        status: 400,
        code: "INVALID_SESSION_ID",
        message: "Valid sessionId query parameter is required",
        correlationId,
        recoverable: true,
      });
    }

    const gotNodes = await getSessionGoTResults(sessionId);

    // Transform DB rows into GoTStreamResult format for the frontend
    const results = gotNodes
      .map((node) => {
        const sr = node.structuredReasoning as Record<string, unknown>;
        // Only return nodes that have persisted GoT graph data
        if (sr.type !== "got_graph" || !sr.graphState) return null;

        const graphState = sr.graphState as {
          thoughts: unknown[];
          edges: unknown[];
          bestThoughts: string[];
        };

        return {
          answer: (sr.answer as string) ?? node.response ?? "",
          confidence: (sr.confidence as number) ?? node.confidenceScore ?? 0,
          reasoningSummary: (sr.reasoningSummary as string) ?? "",
          stats: (sr.stats as Record<string, unknown>) ?? {},
          config: (sr.config as Record<string, unknown>) ?? {},
          query: node.inputQuery ?? "",
          nodeId: node.id,
          createdAt: node.createdAt.toISOString(),
          graphState: {
            thoughts: graphState.thoughts,
            edges: graphState.edges,
            bestThoughts: graphState.bestThoughts,
            sessionId,
          },
        };
      })
      .filter(Boolean);

    return jsonSuccess({ results }, { correlationId });
  } catch (error) {
    console.error("[API] Failed to get GoT results:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "GOT_RESULTS_FETCH_FAILED",
      message: "Failed to get GoT results",
      correlationId,
    });
  }
}

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
