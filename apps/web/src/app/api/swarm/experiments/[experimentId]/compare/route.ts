import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SWARM_URL = process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:8000";

function generateToken(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET not configured");
  }
  return createHmac("sha256", secret)
    .update("opus-nx-authenticated")
    .digest("hex");
}

/**
 * POST /api/swarm/experiments/:experimentId/compare
 * Proxy compare request to Python swarm backend.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> }
) {
  try {
    const { experimentId } = await params;
    const body = await request.json();
    const token = generateToken();

    const response = await fetch(
      `${SWARM_URL}/api/swarm/experiments/${experimentId}/compare`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const raw = data as Record<string, unknown>;
    return NextResponse.json(
      {
        status: raw.status,
        experimentId:
          typeof raw.experiment_id === "string"
            ? raw.experiment_id
            : raw.experimentId,
        comparisonResult:
          raw.comparison_result ?? raw.comparisonResult ?? undefined,
        nodeId: (raw.node_id as string | undefined) ?? (raw.nodeId as string | undefined),
        mode: (raw.mode as string | undefined) ?? undefined,
      },
      { status: response.status }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to proxy comparison";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
