import { timingSafeEqual } from "crypto";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";
import { generateAuthSignature } from "@/lib/auth";

/**
 * POST /api/auth
 * Validates the password against AUTH_SECRET env var and sets a signed auth cookie.
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

    // Timing-safe password comparison to prevent timing attacks
    const passwordBuffer = Buffer.from(password);
    const secretBuffer = Buffer.from(secret);
    if (
      passwordBuffer.length !== secretBuffer.length ||
      !timingSafeEqual(passwordBuffer, secretBuffer)
    ) {
      return jsonError({
        status: 401,
        code: "INVALID_ACCESS_CODE",
        message: "Invalid access code",
        correlationId,
        recoverable: true,
      });
    }

    const response = jsonSuccess({ success: true }, { correlationId });

    // Sign the cookie with HMAC-SHA256 instead of using a plain string
    const signature = generateAuthSignature(secret);
    response.cookies.set("opus-nx-auth", signature, {
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
