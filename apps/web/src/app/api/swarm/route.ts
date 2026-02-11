import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SWARM_BACKEND_URL =
  process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:8000";

/**
 * Generate HMAC auth token matching the Python backend's verification.
 * Pattern: HMAC(key=AUTH_SECRET, message="opus-nx-authenticated")
 */
function generateToken(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET not configured");
  }
  return createHmac("sha256", secret)
    .update("opus-nx-authenticated")
    .digest("hex");
}

/**
 * POST /api/swarm — Proxy to Python agent backend.
 * Attaches HMAC auth token server-side so AUTH_SECRET stays off the client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = generateToken();

    const response = await fetch(`${SWARM_BACKEND_URL}/api/swarm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || "Swarm backend error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach swarm backend";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
