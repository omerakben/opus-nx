import { ThinkingEngine, ThinkGraph } from "@opus-nx/core";
import { createSession, getSession } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { getOrCreateMemory } from "@/lib/memory-store";

export const maxDuration = 300;

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

    if (query.length > 10000) {
      return jsonError({
        status: 400,
        code: "QUERY_TOO_LONG",
        message: "Query must not exceed 10,000 characters",
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

    // Build the model's final response text
    const responseText = result.textBlocks.map((b) => b.text).join("\n\n");

    // Persist to graph (both reasoning AND response)
    const thinkGraph = new ThinkGraph();
    const graphResult = await thinkGraph.persistThinkingNode(
      result.thinkingBlocks,
      {
        sessionId,
        inputQuery: query,
        response: responseText,
        tokenUsage: {
          ...result.usage,
          thinkingTokens,
        },
      }
    );

    // Auto-populate memory hierarchy with thinking content
    let memoryStats = null;
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

      memoryStats = memory.getStats();
    } catch (memoryError) {
      console.warn("[API] Non-critical memory operation failed:", { correlationId, error: memoryError });
    }

    return jsonSuccess(
      {
        sessionId,
        nodeId: graphResult.node.id,
        thinking: result.thinkingBlocks
          .filter((b) => b.type === "thinking")
          .map((b) => (b as { thinking: string }).thinking)
          .join("\n\n"),
        response: responseText,
        tokenUsage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          thinkingTokens: Math.round(thinkingTokens),
        },
        memoryStats,
        degraded: graphResult.degraded || !memoryStats,
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
