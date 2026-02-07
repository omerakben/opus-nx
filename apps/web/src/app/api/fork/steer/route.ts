import { NextResponse } from "next/server";
import { ThinkForkEngine } from "@opus-nx/core";

interface SteerRequest {
  originalResult: {
    query: string;
    branches: Array<{
      style: string;
      conclusion: string;
      confidence: number;
      keyInsights: string[];
      risks?: string[];
      opportunities?: string[];
    }>;
    convergencePoints: unknown[];
    divergencePoints: unknown[];
    metaInsight: string;
    recommendedApproach?: { style: string; rationale: string; confidence: number };
  };
  action:
    | { action: "expand"; style: string; direction?: string }
    | { action: "merge"; styles: string[]; focusArea?: string }
    | { action: "challenge"; style: string; challenge: string }
    | { action: "refork"; newContext: string; keepOriginal?: boolean };
}

/**
 * POST /api/fork/steer
 * Execute a steering action on a previous ThinkFork result.
 * This is the "cognitive co-piloting" endpoint - humans guide AI reasoning.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SteerRequest;
    const { originalResult, action } = body;

    if (!originalResult || !action) {
      return NextResponse.json(
        { error: { message: "originalResult and action are required" } },
        { status: 400 }
      );
    }

    const thinkFork = new ThinkForkEngine();

    // Cast to the expected types
    const result = await thinkFork.steer(
      originalResult as Parameters<typeof thinkFork.steer>[0],
      action as Parameters<typeof thinkFork.steer>[1]
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Fork steer error:", error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Steering failed" } },
      { status: 500 }
    );
  }
}
