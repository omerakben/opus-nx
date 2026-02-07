import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Basic authentication middleware.
 * Checks for an `opus-nx-auth` cookie on every request.
 * Unauthenticated users are redirected to /login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to the login page, auth API, and static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("opus-nx-auth");

  if (!authCookie || authCookie.value !== "authenticated") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
