import { NextResponse } from "next/server";

/**
 * POST /api/auth
 * Validates the password against AUTH_SECRET env var and sets an auth cookie.
 */
export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      console.error("[Auth] AUTH_SECRET environment variable is not set");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    if (password !== secret) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set("opus-nx-auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
