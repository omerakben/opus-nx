import { NextResponse } from "next/server";
import { ThinkForkEngine } from "@opus-nx/core";

interface ForkRequest {
  query: string;
  sessionId?: string;
  styles?: string[];
  effort?: "low" | "medium" | "high" | "max";
}

/**
 * POST /api/fork
 * Run ThinkFork multi-perspective analysis
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ForkRequest;
    const { query, styles, effort = "high" } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        { error: { message: "Query is required" } },
        { status: 400 }
      );
    }

    // Create ThinkFork instance
    const thinkFork = new ThinkForkEngine();

    // Run analysis using the fork method
    const result = await thinkFork.fork(query, {
      styles: styles as ("conservative" | "aggressive" | "balanced" | "contrarian")[] | undefined,
      effort,
      analyzeConvergence: true,
    });

    return NextResponse.json({
      branches: result.branches,
      convergencePoints: result.convergencePoints,
      divergencePoints: result.divergencePoints,
      metaInsight: result.metaInsight,
      recommendedApproach: result.recommendedApproach,
    });
  } catch (error) {
    console.error("[API] Fork analysis error:", error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Analysis failed" } },
      { status: 500 }
    );
  }
}
