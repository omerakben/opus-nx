import { z } from "zod";
import { NextResponse } from "next/server";
import { ThinkForkEngine } from "@opus-nx/core";

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
  try {
    const body = await request.json();
    const parsed = ForkRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Invalid request", details: parsed.error.issues } },
        { status: 400 }
      );
    }
    const { query, styles, effort, branchGuidance } = parsed.data;

    // Create ThinkFork instance
    const thinkFork = new ThinkForkEngine();

    // Run analysis with optional human guidance per branch
    const result = await thinkFork.fork(query, {
      styles,
      effort,
      analyzeConvergence: true,
      branchGuidance,
    });

    return NextResponse.json({
      branches: result.branches,
      convergencePoints: result.convergencePoints,
      divergencePoints: result.divergencePoints,
      metaInsight: result.metaInsight,
      recommendedApproach: result.recommendedApproach,
      appliedGuidance: result.appliedGuidance,
    });
  } catch (error) {
    console.error("[API] Fork analysis error:", error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Analysis failed" } },
      { status: 500 }
    );
  }
}
