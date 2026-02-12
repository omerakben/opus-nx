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
 * POST /api/swarm/experiments/:experimentId/retain
 * Proxy retention decision to Python swarm backend.
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
      `${SWARM_URL}/api/swarm/experiments/${experimentId}/retain`,
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

    const experiment =
      data && typeof data === "object" && data.experiment
        ? (data.experiment as Record<string, unknown>)
        : null;
    if (!experiment) {
      return NextResponse.json({ experiment: null });
    }

    return NextResponse.json({
      experiment: {
        id: experiment.id,
        sessionId: experiment.session_id,
        hypothesisNodeId: experiment.hypothesis_node_id,
        promotedBy: experiment.promoted_by,
        alternativeSummary: experiment.alternative_summary,
        status: experiment.status,
        preferredRunId: experiment.preferred_run_id ?? null,
        rerunRunId: experiment.rerun_run_id ?? null,
        comparisonResult: experiment.comparison_result ?? null,
        retentionDecision: experiment.retention_decision ?? null,
        metadata:
          typeof experiment.metadata === "object" && experiment.metadata !== null
            ? experiment.metadata
            : {},
        createdAt:
          typeof experiment.created_at === "string"
            ? experiment.created_at
            : new Date().toISOString(),
        lastUpdated:
          typeof experiment.last_updated === "string"
            ? experiment.last_updated
            : new Date().toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to proxy retention";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
