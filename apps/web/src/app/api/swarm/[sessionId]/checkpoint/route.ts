import { NextRequest, NextResponse } from "next/server";

const SWARM_URL = process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json();

  const res = await fetch(`${SWARM_URL}/api/swarm/${sessionId}/checkpoint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
