import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

/**
 * POST /api/auth
 * Validates the password against AUTH_SECRET env var and sets an auth cookie.
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const { password } = await request.json();

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      console.error("[Auth] AUTH_SECRET environment variable is not set", { correlationId });
      return jsonError({
        status: 500,
        code: "AUTH_MISCONFIGURED",
        message: "Server misconfiguration",
        correlationId,
      });
    }

    if (password !== secret) {
      return jsonError({
        status: 401,
        code: "INVALID_ACCESS_CODE",
        message: "Invalid access code",
        correlationId,
        recoverable: true,
      });
    }

    const response = jsonSuccess({ success: true }, { correlationId });

    response.cookies.set("opus-nx-auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return jsonError({
      status: 400,
      code: "INVALID_AUTH_REQUEST",
      message: "Invalid request",
      correlationId,
      recoverable: true,
    });
  }
}
