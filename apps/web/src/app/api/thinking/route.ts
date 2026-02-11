import { ThinkingEngine, ThinkGraph } from "@opus-nx/core";
import { createSession, getSession } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { getOrCreateMemory, persistMemoryEntries } from "@/lib/memory-store";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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

  const rateLimited = applyRateLimit(request, "thinking", RATE_LIMITS.ai);
  if (rateLimited) return rateLimited;

  try {
    let body: ThinkingRequest;
    try {
      body = (await request.json()) as ThinkingRequest;
    } catch {
      return jsonError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON", correlationId });
    }
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

    // Calculate thinking tokens (prefer API value, fall back to char/4 estimate)
    const apiThinkingTokens = (result.usage as unknown as { thinking_tokens?: number }).thinking_tokens;
    const thinkingTokensEstimated = !apiThinkingTokens;
    const thinkingTokens = apiThinkingTokens ??
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
    const memoryTruncation: { thinking?: { original: number; stored: number }; response?: { original: number; stored: number } } = {};
    try {
      const memory = getOrCreateMemory(sessionId);

      const thinkingContentFull = result.thinkingBlocks
        .filter((b) => b.type === "thinking")
        .map((b) => (b as { thinking: string }).thinking)
        .join("\n\n");

      const THINKING_LIMIT = 2000;
      const RESPONSE_LIMIT = 1000;

      if (thinkingContentFull.length > THINKING_LIMIT) {
        memoryTruncation.thinking = { original: thinkingContentFull.length, stored: THINKING_LIMIT };
      }
      const thinkingContent = thinkingContentFull.slice(0, THINKING_LIMIT);

      // Collect entries for batch persistence to Supabase
      const entriesToPersist: Parameters<typeof persistMemoryEntries>[0] = [];

      if (thinkingContent) {
        const entry = memory.addToWorkingMemory(
          thinkingContent,
          0.7,
          "thinking_node",
          graphResult.node.id
        );
        entriesToPersist.push({
          id: entry.id,
          sessionId,
          tier: "main_context",
          content: thinkingContent,
          importance: 0.7,
          source: "thinking_node",
          sourceId: graphResult.node.id,
        });
      }

      if (responseText) {
        if (responseText.length > RESPONSE_LIMIT) {
          memoryTruncation.response = { original: responseText.length, stored: RESPONSE_LIMIT };
        }
        const entry = memory.addToWorkingMemory(
          responseText.slice(0, RESPONSE_LIMIT),
          0.5,
          "thinking_node",
          graphResult.node.id
        );
        entriesToPersist.push({
          id: entry.id,
          sessionId,
          tier: "main_context",
          content: responseText.slice(0, RESPONSE_LIMIT),
          importance: 0.5,
          source: "thinking_node",
          sourceId: graphResult.node.id,
        });
      }

      // Persist to Supabase (fire-and-forget, non-blocking)
      persistMemoryEntries(entriesToPersist).catch((err) => {
        console.warn("[API] Non-critical memory persistence failed:", { correlationId, error: err });
      });

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
          thinkingTokensEstimated: thinkingTokensEstimated,
        },
        memoryStats,
        memoryTruncation: Object.keys(memoryTruncation).length > 0 ? memoryTruncation : undefined,
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
