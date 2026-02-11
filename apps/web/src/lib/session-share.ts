import { createHmac, timingSafeEqual } from "crypto";
import {
  getFirstNodePerSessions,
  getSession,
  getSessionThinkingNodes,
  updateSessionPlan,
} from "@/lib/db";
import { isValidUuid } from "@/lib/validation";

const SHARE_TOKEN_VERSION = 1;
const SHARE_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type ShareMetricEvent = "share_link_clicked" | "share_link_opened";

interface ShareTokenPayload {
  v: number;
  sid: string;
  exp: number;
}

interface SharedSessionHighlight {
  id: string;
  text: string;
  createdAt: string;
}

export interface SharedSessionSnapshot {
  sessionId: string;
  title: string;
  createdAt: string;
  expiresAt: string;
  nodeCount: number;
  latestResponse: string | null;
  highlights: SharedSessionHighlight[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getShareSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET. Share links require AUTH_SECRET.");
  }
  return secret;
}

function signPayload(payloadBase64: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");
}

function truncateText(input: string, maxLength = 280): string {
  const trimmed = input.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function parseMetricCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

export function createSessionShareToken(sessionId: string): {
  token: string;
  expiresAt: string;
} {
  if (!isValidUuid(sessionId)) {
    throw new Error("Invalid session ID for share token");
  }

  const expiresAtMs = Date.now() + SHARE_TOKEN_TTL_MS;
  const payload: ShareTokenPayload = {
    v: SHARE_TOKEN_VERSION,
    sid: sessionId,
    exp: expiresAtMs,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(payloadBase64, getShareSecret());

  return {
    token: `${payloadBase64}.${signature}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function verifySessionShareToken(token: string): {
  sessionId: string;
  expiresAt: string;
} | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const tokenParts = token.split(".");
  if (tokenParts.length !== 2) {
    return null;
  }

  const [payloadBase64, signature] = tokenParts;
  if (!payloadBase64 || !signature) {
    return null;
  }

  let expectedSignature: string;
  try {
    expectedSignature = signPayload(payloadBase64, getShareSecret());
  } catch {
    return null;
  }

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: ShareTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    ) as ShareTokenPayload;
  } catch {
    return null;
  }

  if (
    payload.v !== SHARE_TOKEN_VERSION ||
    !isValidUuid(payload.sid) ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= Date.now()
  ) {
    return null;
  }

  return {
    sessionId: payload.sid,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export async function trackSessionShareMetric(
  sessionId: string,
  event: ShareMetricEvent
): Promise<void> {
  if (!isValidUuid(sessionId)) return;

  try {
    const session = await getSession(sessionId);
    if (!session) return;

    const currentPlan = isRecord(session.currentPlan) ? session.currentPlan : {};
    const existingMetrics = isRecord(currentPlan.growthMetrics)
      ? currentPlan.growthMetrics
      : {};

    const nextMetrics = {
      ...existingMetrics,
      [event]: parseMetricCount(existingMetrics[event]) + 1,
      last_share_event_at: new Date().toISOString(),
    };

    await updateSessionPlan(sessionId, {
      ...currentPlan,
      growthMetrics: nextMetrics,
    });
  } catch (error) {
    console.warn("[share] Failed to track session share metric", {
      sessionId,
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getSharedSessionSnapshot(
  token: string
): Promise<SharedSessionSnapshot | null> {
  const verified = verifySessionShareToken(token);
  if (!verified) {
    return null;
  }

  const [session, firstNodeMap, nodes] = await Promise.all([
    getSession(verified.sessionId),
    getFirstNodePerSessions([verified.sessionId]),
    getSessionThinkingNodes(verified.sessionId, { limit: 24 }),
  ]);

  if (!session) {
    return null;
  }

  const firstNode = firstNodeMap.get(verified.sessionId);
  const title = firstNode?.inputQuery?.trim() || "Shared reasoning session";

  const latestResponse =
    nodes.find((node) => typeof node.response === "string" && node.response.trim().length > 0)
      ?.response?.trim() ?? null;

  const highlights = [...nodes]
    .slice(0, 3)
    .reverse()
    .map((node) => ({
      id: node.id,
      text: truncateText(node.response?.trim() || node.reasoning || "No content available."),
      createdAt: node.createdAt.toISOString(),
    }));

  await trackSessionShareMetric(verified.sessionId, "share_link_opened");

  return {
    sessionId: verified.sessionId,
    title,
    createdAt: session.createdAt.toISOString(),
    expiresAt: verified.expiresAt,
    nodeCount: nodes.length,
    latestResponse,
    highlights,
  };
}
