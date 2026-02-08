import { z } from "zod";
import { PRMVerifier } from "@opus-nx/core";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

const StepSchema = z.object({
  stepNumber: z.number(),
  content: z.string(),
  type: z.enum(["analysis", "hypothesis", "evaluation", "conclusion", "consideration"]).optional(),
});

const VerifyRequestSchema = z.object({
  steps: z.array(StepSchema).min(1).max(50),
  thinkingNodeId: z.string().uuid().optional(),
  originalQuery: z.string().optional(),
  effort: z.enum(["low", "medium", "high", "max"]).default("high"),
  correctnessThreshold: z.number().min(0).max(1).default(0.7),
});

/**
 * POST /api/verify
 * Verify a reasoning chain step-by-step using the Process Reward Model
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const body = await request.json();
    const parsed = VerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError({
        status: 400,
        code: "INVALID_VERIFY_REQUEST",
        message: "Invalid request",
        details: parsed.error.issues,
        correlationId,
        recoverable: true,
      });
    }

    const { steps, thinkingNodeId, originalQuery, effort, correctnessThreshold } = parsed.data;

    const verifier = new PRMVerifier({
      config: { effort, correctnessThreshold },
    });

    const result = await verifier.verifyChain(
      { steps, decisionPoints: [], confidenceFactors: [], alternativesConsidered: 0 },
      { thinkingNodeId, originalQuery }
    );

    return jsonSuccess(
      {
        overallScore: result.overallScore,
        isValid: result.isValid,
        firstErrorAt: result.firstErrorAt,
        summary: result.summary,
        steps: result.steps.map((s) => ({
          stepIndex: s.stepIndex,
          verdict: s.verdict,
          confidence: s.confidence,
          explanation: s.explanation,
          issues: s.issues,
          suggestedCorrection: s.suggestedCorrection,
        })),
        patterns: result.patterns,
        metadata: result.metadata,
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Verification error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "Verification failed",
      correlationId,
    });
  }
}
