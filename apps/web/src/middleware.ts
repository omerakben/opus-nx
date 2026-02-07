import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Verify the HMAC-signed auth cookie using Web Crypto API (Edge-compatible)
 */
async function verifyAuthCookie(cookieValue: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode("opus-nx-authenticated"));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return cookieValue === expected;
}

/**
 * Authentication middleware.
 * Checks for a signed `opus-nx-auth` cookie on every request.
 * Unauthenticated users are redirected to /login.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to public routes without auth
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/demo") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("opus-nx-auth");

  if (!authCookie || !(await verifyAuthCookie(authCookie.value))) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
