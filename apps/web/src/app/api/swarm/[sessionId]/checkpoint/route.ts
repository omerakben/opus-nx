import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SWARM_URL = process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:8000";

function generateToken(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET not configured");
  }
  return createHmac("sha256", secret)
    .update("opus-nx-authenticated")
    .digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const token = generateToken();

    const res = await fetch(`${SWARM_URL}/api/swarm/${sessionId}/checkpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to proxy checkpoint";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
