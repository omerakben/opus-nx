import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/think -> 308 Permanent Redirect to /api/thinking
 *
 * This alias previously re-exported the POST handler, but that silently
 * dropped route-segment config (maxDuration) and risked behavioral
 * divergence.  A 308 redirect preserves the request method and body
 * while directing clients to the canonical endpoint.
 */
export function POST(request: NextRequest) {
  const target = new URL("/api/thinking", request.url);
  return NextResponse.redirect(target, 308);
}
