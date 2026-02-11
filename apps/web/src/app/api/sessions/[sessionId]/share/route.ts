import { getSession } from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { createSessionShareToken, trackSessionShareMetric } from "@/lib/session-share";
import { isValidUuid } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/sessions/:sessionId/share
 * Create a signed, expiring share URL for a session.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const correlationId = getCorrelationId(request);

  try {
    const { sessionId } = await params;

    if (!isValidUuid(sessionId)) {
      return jsonError({
        status: 400,
        code: "INVALID_UUID_FORMAT",
        message: "Invalid session ID format. Expected a valid UUID.",
        correlationId,
        recoverable: true,
      });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return jsonError({
        status: 404,
        code: "SESSION_NOT_FOUND",
        message: "Session not found",
        correlationId,
      });
    }

    const { token, expiresAt } = createSessionShareToken(sessionId);
    const origin = new URL(request.url).origin;
    const shareUrl = `${origin}/share/${token}`;

    await trackSessionShareMetric(sessionId, "share_link_clicked");

    return jsonSuccess(
      {
        shareUrl,
        expiresAt,
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Failed to create session share link:", {
      correlationId,
      error,
    });
    return jsonError({
      status: 500,
      code: "SESSION_SHARE_CREATE_FAILED",
      message: "Failed to create share link",
      correlationId,
    });
  }
}
