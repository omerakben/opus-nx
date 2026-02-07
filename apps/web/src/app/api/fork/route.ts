import { NextResponse } from "next/server";
import { ThinkForkEngine } from "@opus-nx/core";

interface ForkRequest {
  query: string;
  sessionId?: string;
  styles?: string[];
  effort?: "low" | "medium" | "high" | "max";
  /** Human guidance per branch (cognitive co-piloting) */
  branchGuidance?: Array<{
    style: string;
    guidance: string;
  }>;
}

/**
 * POST /api/fork
 * Run ThinkFork multi-perspective analysis with optional human guidance
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ForkRequest;
    const { query, styles, effort = "high", branchGuidance } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        { error: { message: "Query is required" } },
        { status: 400 }
      );
    }

    // Create ThinkFork instance
    const thinkFork = new ThinkForkEngine();

    // Run analysis with optional human guidance per branch
    const result = await thinkFork.fork(query, {
      styles: styles as ("conservative" | "aggressive" | "balanced" | "contrarian")[] | undefined,
      effort,
      analyzeConvergence: true,
      branchGuidance: branchGuidance as Array<{
        style: "conservative" | "aggressive" | "balanced" | "contrarian";
        guidance: string;
      }> | undefined,
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
