import { z } from "zod";
import { ThinkForkEngine } from "@opus-nx/core";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

const ForkStyleSchema = z.enum(["conservative", "aggressive", "balanced", "contrarian"]);

const ForkRequestSchema = z.object({
  query: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  styles: z.array(ForkStyleSchema).min(2).optional(),
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  branchGuidance: z.array(z.object({
    style: ForkStyleSchema,
    guidance: z.string().min(1).max(2000),
  })).optional(),
});

/**
 * POST /api/fork
 * Run ThinkFork multi-perspective analysis with optional human guidance
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const body = await request.json();
    const parsed = ForkRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError({
        status: 400,
        code: "INVALID_FORK_REQUEST",
        message: "Invalid request",
        details: parsed.error.issues,
        correlationId,
        recoverable: true,
      });
    }

    const { query, styles, effort, branchGuidance } = parsed.data;

    const thinkFork = new ThinkForkEngine();
    const result = await thinkFork.fork(query, {
      styles,
      effort,
      analyzeConvergence: true,
      branchGuidance,
    });

    return jsonSuccess(
      {
        branches: result.branches,
        convergencePoints: result.convergencePoints,
        divergencePoints: result.divergencePoints,
        metaInsight: result.metaInsight,
        recommendedApproach: result.recommendedApproach,
        appliedGuidance: result.appliedGuidance,
        fallbackPromptsUsed: result.fallbackPromptsUsed,
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Fork analysis error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "FORK_ANALYSIS_FAILED",
      message: error instanceof Error ? error.message : "Analysis failed",
      correlationId,
    });
  }
}
