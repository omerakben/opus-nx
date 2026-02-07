import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 * Clears the auth cookie and redirects to login.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set("opus-nx-auth", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
