import { z } from "zod";
import { ThinkForkEngine } from "@opus-nx/core";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { createForkAnalysis, getSessionForkAnalysesDb } from "@/lib/db";

export const maxDuration = 900;

const ForkStyleSchema = z.enum(["conservative", "aggressive", "balanced", "contrarian"]);

const ForkRequestSchema = z.object({
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
 * GET /api/fork?sessionId=<uuid>
 * Load saved fork analyses for a session
 */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId || !z.string().uuid().safeParse(sessionId).success) {
      return jsonError({
        status: 400,
        code: "INVALID_SESSION_ID",
        message: "Valid sessionId query parameter is required",
        correlationId,
        recoverable: true,
      });
    }

    const analyses = await getSessionForkAnalysesDb(sessionId);

    return jsonSuccess({ analyses }, { correlationId });
  } catch (error) {
    console.error("[API] Fork analyses fetch error:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "FORK_ANALYSES_FETCH_FAILED",
      message: error instanceof Error ? error.message : "Failed to load analyses",
      correlationId,
    });
  }
}

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

    const { query, sessionId, styles, effort, branchGuidance, mode, debateRounds } = parsed.data;

    const thinkFork = new ThinkForkEngine();

    if (mode === "debate") {
      const result = await thinkFork.debate(query, {
        styles,
        effort,
        rounds: debateRounds,
      });

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

      // Persist to database if sessionId provided
      let analysisId: string | undefined;
      if (sessionId) {
        try {
          const saved = await createForkAnalysis({
            sessionId,
            query,
            mode: "debate",
            result: responsePayload as unknown as Record<string, unknown>,
          });
          analysisId = saved.id;
        } catch (persistError) {
          console.warn("[API] Failed to persist debate analysis:", persistError);
        }
      }

      return jsonSuccess(
        { ...responsePayload, analysisId },
        { correlationId }
      );
    }

    const result = await thinkFork.fork(query, {
      styles,
      effort,
      analyzeConvergence: true,
      branchGuidance,
    });

    const responsePayload = {
      branches: result.branches,
      convergencePoints: result.convergencePoints,
      divergencePoints: result.divergencePoints,
      metaInsight: result.metaInsight,
      recommendedApproach: result.recommendedApproach,
      appliedGuidance: result.appliedGuidance,
    };

    // Persist to database if sessionId provided
    let analysisId: string | undefined;
    if (sessionId) {
      try {
        const saved = await createForkAnalysis({
          sessionId,
          query,
          mode: "fork",
          result: responsePayload as unknown as Record<string, unknown>,
        });
        analysisId = saved.id;
      } catch (persistError) {
        console.warn("[API] Failed to persist fork analysis:", persistError);
      }
    }

    return jsonSuccess(
      { ...responsePayload, analysisId },
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
