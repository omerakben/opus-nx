import { ThinkingEngine, ThinkGraph } from "@opus-nx/core";
import { createSession, getSession } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

interface ThinkingRequest {
  query: string;
  sessionId?: string;
  effort?: "low" | "medium" | "high" | "max";
}

/**
 * POST /api/thinking
 * Execute a thinking session (non-streaming)
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const body = (await request.json()) as ThinkingRequest;
    const { query, sessionId: providedSessionId, effort = "high" } = body;

    if (!query?.trim()) {
      return jsonError({
        status: 400,
        code: "INVALID_QUERY",
        message: "Query is required",
        correlationId,
        recoverable: true,
      });
    }

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

    // Create thinking engine with adaptive thinking (Claude 4.6 recommended mode)
    const engine = new ThinkingEngine({
      config: {
        model: "claude-opus-4-6",
        thinking: { type: "adaptive", effort },
        maxTokens: 8192,
        streaming: false,
      },
    });

    // Execute thinking
    const result = await engine.think(
      "You are an advanced reasoning assistant. Think through the problem carefully before responding.",
      [{ role: "user", content: query }]
    );

    // Calculate thinking tokens
    const thinkingTokens =
      (result.usage as unknown as { thinking_tokens?: number }).thinking_tokens ??
      result.thinkingBlocks.reduce(
        (acc, b) => acc + (b.type === "thinking" ? b.thinking.length / 4 : 0),
        0
      );

    // Persist to graph
    const thinkGraph = new ThinkGraph();
    const graphResult = await thinkGraph.persistThinkingNode(
      result.thinkingBlocks,
      {
        sessionId,
        inputQuery: query,
        tokenUsage: {
          ...result.usage,
          thinkingTokens,
        },
      }
    );

    return jsonSuccess(
      {
        sessionId,
        nodeId: graphResult.node.id,
        thinking: result.thinkingBlocks
          .filter((b) => b.type === "thinking")
          .map((b) => (b as { thinking: string }).thinking)
          .join("\n\n"),
        response: result.textBlocks.map((b) => b.text).join("\n\n"),
        tokenUsage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          thinkingTokens: Math.round(thinkingTokens),
        },
        degraded: graphResult.degraded,
        degradation: graphResult.degraded
          ? { persistenceIssues: graphResult.persistenceIssues }
          : undefined,
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Thinking error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "THINKING_FAILED",
      message: error instanceof Error ? error.message : "Unknown error",
      correlationId,
    });
  }
}
