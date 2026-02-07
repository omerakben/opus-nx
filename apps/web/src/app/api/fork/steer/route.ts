import { z } from "zod";
import { NextResponse } from "next/server";
import { ThinkForkEngine } from "@opus-nx/core";
import type { ForkResponse, SteeringAction } from "@/lib/api";

const ForkStyleSchema = z.enum(["conservative", "aggressive", "balanced", "contrarian"]);

const SteerRequestSchema = z.object({
  originalResult: z.object({
    branches: z.array(z.object({
      style: z.string(),
      conclusion: z.string(),
      confidence: z.number(),
      keyInsights: z.array(z.string()),
      risks: z.array(z.string()).optional(),
      opportunities: z.array(z.string()).optional(),
    })),
    convergencePoints: z.array(z.unknown()),
    divergencePoints: z.array(z.unknown()),
    metaInsight: z.string(),
    recommendedApproach: z.object({
      style: z.string(),
      rationale: z.string(),
      confidence: z.number(),
    }).optional(),
  }),
  action: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("expand"),
      style: ForkStyleSchema,
      direction: z.string().optional(),
    }),
    z.object({
      action: z.literal("merge"),
      styles: z.array(ForkStyleSchema).min(2),
      focusArea: z.string().optional(),
    }),
    z.object({
      action: z.literal("challenge"),
      style: ForkStyleSchema,
      challenge: z.string().min(1),
    }),
    z.object({
      action: z.literal("refork"),
      newContext: z.string().min(1),
      keepOriginal: z.boolean().default(true),
    }),
  ]),
});

/**
 * POST /api/fork/steer
 * Execute a steering action on a previous ThinkFork result.
 * This is the "cognitive co-piloting" endpoint - humans guide AI reasoning.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SteerRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Invalid request", details: parsed.error.issues } },
        { status: 400 }
      );
    }
    const { originalResult, action } = parsed.data;

    const thinkFork = new ThinkForkEngine();

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
