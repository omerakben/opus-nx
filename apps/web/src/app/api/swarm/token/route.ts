import { createHmac } from "crypto";
import { NextResponse } from "next/server";

const SWARM_BACKEND_URL =
  process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:8000";

/**
 * GET /api/swarm/token — Return a signed WebSocket token.
 * Keeps AUTH_SECRET server-side while letting the client connect to the WS.
 */
export async function GET() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "AUTH_SECRET not configured" },
      { status: 500 }
    );
  }

  const token = createHmac("sha256", secret)
    .update("opus-nx-authenticated")
    .digest("hex");

  const wsUrl = SWARM_BACKEND_URL.replace(/^http/, "ws");

  return NextResponse.json({ token, wsUrl });
}
