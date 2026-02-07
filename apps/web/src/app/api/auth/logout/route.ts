import { getCorrelationId, jsonSuccess } from "@/lib/api-response";

/**
 * POST /api/auth/logout
 * Clears the auth cookie and redirects to login.
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = jsonSuccess({ success: true }, { correlationId });

  response.cookies.set("opus-nx-auth", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
