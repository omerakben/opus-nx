import { z } from "zod";
import { ThinkingEngine, ThinkGraph } from "@opus-nx/core";
import {
  getThinkingNode,
  createThinkingNode,
  createReasoningEdge,
  getReasoningChain,
} from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { isValidUuid } from "@/lib/validation";

/**
 * Human checkpoint verdicts for reasoning nodes.
 * - verified: Human agrees with this reasoning step
 * - questionable: Human has doubts about this step
 * - disagree: Human disagrees and optionally provides correction
 */
const VerdictSchema = z.enum(["verified", "questionable", "disagree"]);

const CheckpointRequestSchema = z.object({
  verdict: VerdictSchema,
  correction: z.string().max(5000).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reasoning/:id/checkpoint
 *
 * Human-in-the-loop checkpoint for reasoning nodes.
 * Allows users to:
 * 1. Verify a reasoning step (agree)
 * 2. Mark as questionable (flag for review)
 * 3. Disagree and provide correction (triggers re-reasoning)
 *
 * This is the core of "reasoning audit" - making AI thinking
 * transparent and correctable.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const correlationId = getCorrelationId(request);

  try {
    const { id: nodeId } = await params;

    if (!isValidUuid(nodeId)) {
      return jsonError({
        status: 400,
        code: "INVALID_UUID_FORMAT",
        message: "Invalid reasoning node ID format.",
        correlationId,
        recoverable: true,
      });
    }

    // Validate request body
    const body = await request.json();
    const parsed = CheckpointRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError({
        status: 400,
        code: "INVALID_CHECKPOINT_REQUEST",
        message: "Invalid checkpoint request",
        details: parsed.error.issues,
        correlationId,
        recoverable: true,
      });
    }

    const { verdict, correction } = parsed.data;

    // Get the target node
    const targetNode = await getThinkingNode(nodeId);
    if (!targetNode) {
      return jsonError({
        status: 404,
        code: "REASONING_NODE_NOT_FOUND",
        message: "Reasoning node not found",
        correlationId,
        recoverable: true,
      });
    }

    // Create human annotation node
    const annotationReasoning = buildAnnotationReasoning(verdict, correction);
    const annotationNode = await createThinkingNode({
      sessionId: targetNode.sessionId,
      parentNodeId: nodeId,
      reasoning: annotationReasoning,
      structuredReasoning: {
        type: "human_annotation",
        verdict,
        correction: correction ?? null,
        targetNodeId: nodeId,
        annotatedAt: new Date().toISOString(),
      },
      confidenceScore: verdict === "verified" ? 1.0 : verdict === "questionable" ? 0.5 : 0.0,
      tokenUsage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 },
      nodeType: "human_annotation",
    });

    // Link annotation to target node
    const edgeType = verdict === "verified" ? "supports" : verdict === "disagree" ? "contradicts" : "refines";
    await createReasoningEdge({
      sourceId: annotationNode.id,
      targetId: nodeId,
      edgeType,
      weight: 1.0,
      metadata: { verdict, hasCorrection: !!correction },
    });

    // If user disagrees and provides correction, trigger re-reasoning
    let alternativeBranch: {
      nodeId: string;
      reasoning: string;
      confidence: number;
    } | null = null;

    if (verdict === "disagree" && correction) {
      alternativeBranch = await generateAlternativeBranch(
        targetNode,
        correction,
        correlationId
      );
    }

    return jsonSuccess(
      {
        annotation: {
          id: annotationNode.id,
          verdict,
          correction: correction ?? null,
          createdAt: annotationNode.createdAt.toISOString(),
        },
        alternativeBranch,
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Checkpoint failed:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "CHECKPOINT_FAILED",
      message: error instanceof Error ? error.message : "Checkpoint failed",
      correlationId,
    });
  }
}

/**
 * Build human-readable reasoning text for the annotation node.
 */
function buildAnnotationReasoning(
  verdict: "verified" | "questionable" | "disagree",
  correction?: string
): string {
  if (verdict === "verified") {
    return "[CHECKPOINT: VERIFIED]\n\nThis reasoning step has been reviewed and verified by the Opus operator.";
  }
  if (verdict === "questionable") {
    return "[CHECKPOINT: QUESTIONABLE]\n\nThis reasoning step has been flagged for review. The operator has doubts about its validity.";
  }
  // verdict === "disagree"
  return `[CHECKPOINT: DISAGREEMENT]\n\nThe operator disagrees with this reasoning step.\n\n${
    correction
      ? `Correction provided:\n${correction}`
      : "No specific correction provided."
  }`;
}

/**
 * Generate an alternative reasoning branch based on human correction.
 *
 * Uses medium effort to balance cost and quality for re-reasoning.
 * The correction is injected as additional context to guide the new branch.
 */
async function generateAlternativeBranch(
  targetNode: {
    id: string;
    sessionId: string;
    reasoning: string;
    inputQuery: string | null;
  },
  correction: string,
  correlationId: string
): Promise<{
  nodeId: string;
  reasoning: string;
  confidence: number;
}> {
  // Get the reasoning chain up to this node for context
  let contextChain: Array<{ reasoning: string }> = [];
  try {
    contextChain = await getReasoningChain(targetNode.id);
  } catch (e) {
    console.warn("[API] Failed to get reasoning chain for re-reasoning:", {
      correlationId,
      error: e,
    });
  }

  // Build context from the chain
  const chainContext = contextChain
    .slice(-3) // Last 3 nodes for context
    .map((n, i) => `Step ${i + 1}: ${n.reasoning.slice(0, 500)}...`)
    .join("\n\n");

  // Build the re-reasoning prompt
  const systemPrompt = `You are an advanced reasoning assistant engaged in a reasoning correction process.

An operator has reviewed one of your reasoning steps and provided a correction. Your task is to:
1. Acknowledge the correction
2. Re-analyze the problem incorporating the operator's insight
3. Generate an improved reasoning path

Be thorough but focused. This is a correction, not a complete restart.`;

  const userPrompt = `## Original Query
${targetNode.inputQuery ?? "No original query recorded"}

## Reasoning Context
${chainContext || "No prior reasoning context available"}

## Original Reasoning Step (Flagged)
${targetNode.reasoning.slice(0, 1000)}

## Operator Correction
${correction}

Please provide corrected reasoning that incorporates the operator's insight. Focus on how this changes your analysis and conclusions.`;

  // Use medium effort for re-reasoning (balance cost vs quality)
  const engine = new ThinkingEngine({
    config: {
      model: "claude-opus-4-6",
      thinking: { type: "adaptive", effort: "medium" },
      maxTokens: 8192,
      streaming: false,
    },
  });

  const result = await engine.think(systemPrompt, [
    { role: "user", content: userPrompt },
  ]);

  // Extract thinking content
  const thinkingContent = result.thinkingBlocks
    .filter((b): b is { type: "thinking"; thinking: string; signature: string } => b.type === "thinking")
    .map((b) => b.thinking)
    .join("\n\n");

  const responseContent = result.textBlocks.map((b) => b.text).join("\n\n");
  const fullReasoning = `[RE-REASONING BRANCH]\n\nHuman correction: ${correction}\n\n---\n\n${thinkingContent || responseContent}`;

  // Calculate confidence based on thinking depth
  const thinkingTokens =
    (result.usage as unknown as { thinking_tokens?: number }).thinking_tokens ?? 0;
  const confidence = Math.min(0.95, 0.5 + (thinkingTokens / 10000) * 0.45);

  // Persist the alternative branch
  const thinkGraph = new ThinkGraph();
  const graphResult = await thinkGraph.persistThinkingNode(
    result.thinkingBlocks,
    {
      sessionId: targetNode.sessionId,
      parentNodeId: targetNode.id,
      inputQuery: `[Correction] ${correction.slice(0, 100)}...`,
      tokenUsage: {
        ...result.usage,
        thinkingTokens,
      },
    }
  );

  // Link the new branch to the original node with "refines" edge
  await createReasoningEdge({
    sourceId: graphResult.node.id,
    targetId: targetNode.id,
    edgeType: "refines",
    weight: 1.0,
    metadata: {
      correctionTriggered: true,
      humanCorrection: correction.slice(0, 500),
    },
  });

  return {
    nodeId: graphResult.node.id,
    reasoning: fullReasoning,
    confidence,
  };
}
