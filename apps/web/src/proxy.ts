import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Verify the HMAC-signed auth cookie using Web Crypto API (Edge-compatible).
 * Uses crypto.subtle.verify() for timing-safe comparison.
 */
async function verifyAuthCookie(cookieValue: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  // Decode the hex-encoded HMAC from the cookie
  if (cookieValue.length === 0 || cookieValue.length % 2 !== 0) {
    return false;
  }
  const signatureBytes = new Uint8Array(cookieValue.length / 2);
  for (let i = 0; i < cookieValue.length; i += 2) {
    const byte = Number.parseInt(cookieValue.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      return false;
    }
    signatureBytes[i / 2] = byte;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // Let WebCrypto perform timing-safe MAC verification
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode("opus-nx-authenticated")
  );
}

/**
 * Authentication middleware.
 * Checks for a signed `opus-nx-auth` cookie on every request.
 * Unauthenticated users are redirected to /login.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to public routes without auth
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/demo") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg")
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
