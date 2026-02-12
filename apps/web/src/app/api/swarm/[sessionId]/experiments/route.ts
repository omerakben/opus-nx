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
 * GET /api/swarm/:sessionId/experiments
 * Returns hypothesis lifecycle experiments for a swarm session.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const token = generateToken();
    const qs = request.nextUrl.searchParams.toString();
    const path = qs
      ? `/api/swarm/${sessionId}/experiments?${qs}`
      : `/api/swarm/${sessionId}/experiments`;

    const response = await fetch(`${SWARM_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Keep camelCase response shape stable for client code.
    const experiments = Array.isArray(data.experiments)
      ? data.experiments.map((experiment: Record<string, unknown>) => ({
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
        }))
      : [];

    const lifecycleRaw =
      data && typeof data === "object" && data.lifecycle && typeof data.lifecycle === "object"
        ? (data.lifecycle as Record<string, unknown>)
        : null;
    const lifecycle = lifecycleRaw
      ? {
          degradedMode: Boolean(lifecycleRaw.degraded_mode),
          degradedReason:
            typeof lifecycleRaw.degraded_reason === "string"
              ? lifecycleRaw.degraded_reason
              : null,
          capabilities:
            typeof lifecycleRaw.capabilities === "object" &&
            lifecycleRaw.capabilities !== null
              ? {
                  configured: Boolean(
                    (lifecycleRaw.capabilities as Record<string, unknown>).configured
                  ),
                  tables:
                    typeof (lifecycleRaw.capabilities as Record<string, unknown>).tables ===
                      "object" &&
                    (lifecycleRaw.capabilities as Record<string, unknown>).tables !== null
                      ? ((lifecycleRaw.capabilities as Record<string, unknown>)
                          .tables as Record<string, boolean>)
                      : {},
                  rpc:
                    typeof (lifecycleRaw.capabilities as Record<string, unknown>).rpc ===
                      "object" &&
                    (lifecycleRaw.capabilities as Record<string, unknown>).rpc !== null
                      ? ((lifecycleRaw.capabilities as Record<string, unknown>)
                          .rpc as Record<string, boolean>)
                      : {},
                  lifecycleReady: Boolean(
                    (lifecycleRaw.capabilities as Record<string, unknown>).lifecycle_ready
                  ),
                  rehydrationReady: Boolean(
                    (lifecycleRaw.capabilities as Record<string, unknown>)
                      .rehydration_ready
                  ),
                  probedAt:
                    typeof (lifecycleRaw.capabilities as Record<string, unknown>).probed_at ===
                    "string"
                      ? ((lifecycleRaw.capabilities as Record<string, unknown>)
                          .probed_at as string)
                      : undefined,
                }
              : null,
          compareCompletionRate:
            typeof lifecycleRaw.compare_completion_rate === "number"
              ? lifecycleRaw.compare_completion_rate
              : 0,
          retentionRatio:
            typeof lifecycleRaw.retention_ratio === "object" &&
            lifecycleRaw.retention_ratio !== null
              ? {
                  retain:
                    typeof (lifecycleRaw.retention_ratio as Record<string, unknown>).retain ===
                    "number"
                      ? ((lifecycleRaw.retention_ratio as Record<string, unknown>).retain as number)
                      : 0,
                  defer:
                    typeof (lifecycleRaw.retention_ratio as Record<string, unknown>).defer ===
                    "number"
                      ? ((lifecycleRaw.retention_ratio as Record<string, unknown>).defer as number)
                      : 0,
                  archive:
                    typeof (lifecycleRaw.retention_ratio as Record<string, unknown>).archive ===
                    "number"
                      ? ((lifecycleRaw.retention_ratio as Record<string, unknown>).archive as number)
                      : 0,
                }
              : { retain: 0, defer: 0, archive: 0 },
          compareRequests:
            typeof lifecycleRaw.compare_requests === "number"
              ? lifecycleRaw.compare_requests
              : 0,
          compareCompleted:
            typeof lifecycleRaw.compare_completed === "number"
              ? lifecycleRaw.compare_completed
              : 0,
        }
      : null;

    return NextResponse.json({ experiments, lifecycle });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to proxy experiments";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
