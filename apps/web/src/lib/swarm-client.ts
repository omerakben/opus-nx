/**
 * Client for the Opus NX V2 Python swarm backend.
 *
 * Bridges the Next.js dashboard with the Python FastAPI agent swarm.
 * - REST: POST /api/swarm, GET /api/graph/{sessionId}
 * - WebSocket: /ws/{sessionId}?token=HMAC for real-time event streaming
 *
 * Auth uses the same HMAC-SHA256 pattern as V1 (lib/auth.ts):
 *   HMAC(key=AUTH_SECRET, message="opus-nx-authenticated")
 */

import { appEvents } from "./events";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Swarm backend base URL — Python FastAPI on port 8000 */
const SWARM_BASE_URL =
  process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Auth — fetch token from server to keep AUTH_SECRET off the client
// ---------------------------------------------------------------------------

let cachedToken: { token: string; wsUrl: string } | null = null;

async function getSwarmToken(): Promise<{ token: string; wsUrl: string }> {
  if (cachedToken) return cachedToken;

  const res = await fetch("/api/swarm/token");
  if (!res.ok) throw new Error("Failed to get swarm token");

  cachedToken = await res.json();
  return cachedToken!;
}

// ---------------------------------------------------------------------------
// Types (mirrors Python SwarmEvent types)
// ---------------------------------------------------------------------------

export interface SwarmEvent {
  event: string;
  session_id: string;
  timestamp: string;
}

export interface SwarmStartedEvent extends SwarmEvent {
  event: "swarm_started";
  agents: string[];
  query: string;
}

export interface AgentStartedEvent extends SwarmEvent {
  event: "agent_started";
  agent: string;
  effort: string;
}

export interface AgentThinkingEvent extends SwarmEvent {
  event: "agent_thinking";
  agent: string;
  delta: string;
}

export interface GraphNodeCreatedEvent extends SwarmEvent {
  event: "graph_node_created";
  node_id: string;
  agent: string;
  content_preview: string;
}

export interface AgentChallengesEvent extends SwarmEvent {
  event: "agent_challenges";
  challenger: string;
  target_node_id: string;
  argument_preview: string;
}

export interface VerificationScoreEvent extends SwarmEvent {
  event: "verification_score";
  node_id: string;
  score: number;
  verdict: string;
}

export interface AgentCompletedEvent extends SwarmEvent {
  event: "agent_completed";
  agent: string;
  conclusion_preview: string;
  confidence: number;
  tokens_used: number;
}

export interface SynthesisReadyEvent extends SwarmEvent {
  event: "synthesis_ready";
  synthesis: string;
  confidence: number;
}

export interface MetacognitionInsightEvent extends SwarmEvent {
  event: "metacognition_insight";
  insight_type: string;
  description: string;
  affected_agents: string[];
}

export type SwarmEventUnion =
  | SwarmStartedEvent
  | AgentStartedEvent
  | AgentThinkingEvent
  | GraphNodeCreatedEvent
  | AgentChallengesEvent
  | VerificationScoreEvent
  | AgentCompletedEvent
  | SynthesisReadyEvent
  | MetacognitionInsightEvent;

// ---------------------------------------------------------------------------
// Swarm event listener type
// ---------------------------------------------------------------------------

export type SwarmEventListener = (event: SwarmEventUnion) => void;

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

export async function startSwarm(
  query: string,
  sessionId: string
): Promise<{ status: string; session_id: string }> {
  // Use the Next.js proxy route — it attaches the HMAC token server-side
  const res = await fetch("/api/swarm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, session_id: sessionId }),
  });

  if (!res.ok) {
    throw new Error(`Swarm start failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getSwarmGraph(
  sessionId: string
): Promise<{ nodes: unknown[]; graph: unknown }> {
  const res = await fetch(`${SWARM_BASE_URL}/api/graph/${sessionId}`);

  if (!res.ok) {
    throw new Error(`Graph fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// WebSocket subscription
// ---------------------------------------------------------------------------

export interface SwarmSubscription {
  /** Unsubscribe and close the WebSocket */
  close: () => void;
  /** Current connection state */
  readyState: () => number;
}

/**
 * Subscribe to live swarm events via WebSocket.
 *
 * Fetches a signed HMAC token from the server, then opens a WebSocket
 * to the Python backend. Delivers typed events to the provided listener
 * and emits to the app-wide event bus for cross-component reactivity.
 *
 * @param sessionId - Session to subscribe to
 * @param onEvent - Callback for each swarm event
 * @param onError - Optional error callback
 * @returns Subscription handle with close() method
 */
export function subscribeSwarmEvents(
  sessionId: string,
  _authSecret: string,
  onEvent: SwarmEventListener,
  onError?: (error: Event) => void
): SwarmSubscription {
  // We create the WebSocket asynchronously after fetching the token,
  // but store a reference so close() works even before the WS opens.
  let ws: WebSocket | null = null;
  let closed = false;

  getSwarmToken()
    .then(({ token, wsUrl }) => {
      if (closed) return;
      ws = new WebSocket(
        `${wsUrl}/ws/${encodeURIComponent(sessionId)}?token=${token}`
      );

      setupWebSocket(ws, sessionId, onEvent, onError);
    })
    .catch(() => {
      if (!closed) {
        onError?.(new Event("token_fetch_failed"));
      }
    });

  return {
    close: () => {
      closed = true;
      ws?.close();
    },
    readyState: () => ws?.readyState ?? WebSocket.CONNECTING,
  };
}

/** Wire up WebSocket event handlers. */
function setupWebSocket(
  ws: WebSocket,
  sessionId: string,
  onEvent: SwarmEventListener,
  onError?: (error: Event) => void
): void {

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as { event: string };

      // Skip heartbeat pings (not part of SwarmEventUnion)
      if (data.event === "ping") return;

      const event = data as unknown as SwarmEventUnion;

      // Deliver to caller
      onEvent(event);

      // Bridge to app-wide event bus for cross-component reactivity
      bridgeToAppEvents(event, sessionId);
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onerror = (err) => {
    onError?.(err);
  };

  ws.onclose = () => {
    // Connection closed — could implement reconnection here
  };
}

// ---------------------------------------------------------------------------
// Bridge swarm events → app event bus
// ---------------------------------------------------------------------------

function bridgeToAppEvents(event: SwarmEventUnion, sessionId: string): void {
  switch (event.event) {
    case "graph_node_created":
    case "agent_challenges":
    case "verification_score":
      // Graph changed — trigger refetch
      appEvents.emit("data:stale", { scope: "graph", sessionId });
      break;

    case "synthesis_ready":
      // Synthesis is like thinking:complete
      appEvents.emit("thinking:complete", { sessionId });
      appEvents.emit("data:stale", { scope: "all", sessionId });
      break;

    case "metacognition_insight":
      // New insight — refetch insights panel
      appEvents.emit("data:stale", { scope: "insights", sessionId });
      break;

    case "agent_completed":
      // Agent done — partial graph update
      appEvents.emit("data:stale", { scope: "graph", sessionId });
      break;
  }
}
