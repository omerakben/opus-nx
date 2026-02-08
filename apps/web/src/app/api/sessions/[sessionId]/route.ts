import {
  archiveSession,
  restoreSession,
  deleteSession,
  getSession,
} from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { isValidUuid } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/sessions/:sessionId
 * Get a single session by ID
 */
export async function GET(request: Request, { params }: RouteParams) {
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

    return jsonSuccess(
      {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Failed to get session:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SESSION_FETCH_FAILED",
      message: "Failed to get session",
      correlationId,
    });
  }
}

/**
 * PATCH /api/sessions/:sessionId
 * Update session status (archive/restore)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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

    const body = await request.json();
    const { status } = body as { status?: string };

    if (!status || !["active", "archived"].includes(status)) {
      return jsonError({
        status: 400,
        code: "INVALID_STATUS",
        message: 'Status must be "active" or "archived"',
        correlationId,
        recoverable: true,
      });
    }

    let session;
    if (status === "archived") {
      session = await archiveSession(sessionId);
    } else {
      session = await restoreSession(sessionId);
    }

    return jsonSuccess(
      {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Failed to update session:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SESSION_UPDATE_FAILED",
      message: "Failed to update session",
      correlationId,
    });
  }
}

/**
 * DELETE /api/sessions/:sessionId
 * Permanently delete a session
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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

    await deleteSession(sessionId);

    return jsonSuccess({ deleted: true }, { correlationId });
  } catch (error) {
    console.error("[API] Failed to delete session:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SESSION_DELETE_FAILED",
      message: "Failed to delete session",
      correlationId,
    });
  }
}
