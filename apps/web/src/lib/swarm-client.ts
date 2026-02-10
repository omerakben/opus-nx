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

/** Token cache with timestamp for expiration checking */
let cachedToken: { token: string; wsUrl: string; fetchedAt: number } | null =
  null;

/** Maximum token age before re-fetch (60 minutes) */
const TOKEN_MAX_AGE_MS = 60 * 60 * 1000;

async function getSwarmToken(): Promise<{ token: string; wsUrl: string }> {
  if (cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_MAX_AGE_MS) {
    return cachedToken;
  }

  // Token expired or not cached — invalidate and re-fetch
  cachedToken = null;

  const res = await fetch("/api/swarm/token");
  if (!res.ok) throw new Error("Failed to get swarm token");

  const data: { token: string; wsUrl: string } = await res.json();
  cachedToken = { ...data, fetchedAt: Date.now() };
  return data;
}

/** Manually invalidate the token cache (useful during reconnect) */
export function clearTokenCache(): void {
  cachedToken = null;
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

export interface MaestroDecompositionEvent extends SwarmEvent {
  event: "maestro_decomposition";
  subtasks: string[];
  selected_agents: string[];
  reasoning_preview: string;
}

export interface HumanCheckpointEvent extends SwarmEvent {
  event: "human_checkpoint";
  node_id: string;
  verdict: string;
  correction: string | null;
}

export interface SwarmRerunStartedEvent extends SwarmEvent {
  event: "swarm_rerun_started";
  agents: string[];
  correction_preview: string;
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
  | MetacognitionInsightEvent
  | MaestroDecompositionEvent
  | HumanCheckpointEvent
  | SwarmRerunStartedEvent;

// ---------------------------------------------------------------------------
// Event validation (W3)
// ---------------------------------------------------------------------------

/** The 12 known swarm event types */
export const VALID_EVENT_TYPES = new Set([
  "swarm_started",
  "agent_started",
  "agent_thinking",
  "graph_node_created",
  "agent_challenges",
  "verification_score",
  "agent_completed",
  "synthesis_ready",
  "metacognition_insight",
  "maestro_decomposition",
  "human_checkpoint",
  "swarm_rerun_started",
] as const);

/** Runtime validation for incoming WebSocket events */
function isValidSwarmEvent(data: unknown): data is SwarmEventUnion {
  if (typeof data !== "object" || data === null) return false;

  const obj = data as Record<string, unknown>;

  if (typeof obj.event !== "string") return false;
  if (!VALID_EVENT_TYPES.has(obj.event as typeof VALID_EVENT_TYPES extends Set<infer T> ? T : never)) return false;
  if (typeof obj.session_id !== "string") return false;
  if (typeof obj.timestamp !== "string") return false;

  return true;
}

// ---------------------------------------------------------------------------
// Swarm event listener type
// ---------------------------------------------------------------------------

export type SwarmEventListener = (event: SwarmEventUnion) => void;

// ---------------------------------------------------------------------------
// Connection state (W1)
// ---------------------------------------------------------------------------

export type ConnectionState = "connected" | "reconnecting" | "disconnected";

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
  /** Current WebSocket readyState */
  readyState: () => number;
  /** Current connection state: connected, reconnecting, or disconnected */
  connectionState: () => ConnectionState;
}

/** Options for subscribeSwarmEvents */
interface SubscribeOptions {
  onReconnect?: () => void;
}

/** Reconnect configuration */
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Subscribe to live swarm events via WebSocket.
 *
 * Fetches a signed HMAC token from the server, then opens a WebSocket
 * to the Python backend. Delivers typed events to the provided listener
 * and emits to the app-wide event bus for cross-component reactivity.
 *
 * Includes auto-reconnect with exponential backoff (max 3 attempts).
 *
 * @param sessionId - Session to subscribe to
 * @param _authSecret - Auth secret (unused; token fetched server-side)
 * @param onEvent - Callback for each swarm event
 * @param onError - Optional error callback
 * @param options - Optional config (onReconnect callback)
 * @returns Subscription handle with close() and connectionState() methods
 */
export function subscribeSwarmEvents(
  sessionId: string,
  _authSecret: string,
  onEvent: SwarmEventListener,
  onError?: (error: Event) => void,
  options?: SubscribeOptions
): SwarmSubscription {
  let ws: WebSocket | null = null;
  let closed = false;
  let connState: ConnectionState = "disconnected";
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (closed) return;

    // On reconnect, clear token cache so we get a fresh token
    if (reconnectAttempt > 0) {
      clearTokenCache();
    }

    getSwarmToken()
      .then(({ token, wsUrl }) => {
        if (closed) return;

        ws = new WebSocket(
          `${wsUrl}/ws/${encodeURIComponent(sessionId)}?token=${token}`
        );

        ws.onopen = () => {
          connState = "connected";
          reconnectAttempt = 0;
        };

        setupWebSocket(ws, sessionId, onEvent, onError, () => {
          // onClose callback — attempt reconnection
          if (closed) {
            connState = "disconnected";
            return;
          }

          attemptReconnect();
        });
      })
      .catch(() => {
        if (closed) return;

        // Token fetch failed during reconnect — try again or give up
        if (reconnectAttempt > 0) {
          attemptReconnect();
        } else {
          connState = "disconnected";
          onError?.(new Event("token_fetch_failed"));
        }
      });
  }

  function attemptReconnect(): void {
    if (closed) return;

    reconnectAttempt++;

    if (reconnectAttempt > MAX_RECONNECT_ATTEMPTS) {
      connState = "disconnected";
      onError?.(
        new Event(
          `WebSocket reconnection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`
        )
      );
      return;
    }

    connState = "reconnecting";
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempt - 1);

    reconnectTimer = setTimeout(() => {
      if (closed) return;
      options?.onReconnect?.();
      connect();
    }, delay);
  }

  // Start initial connection
  connect();

  return {
    close: () => {
      closed = true;
      connState = "disconnected";
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws?.close();
    },
    readyState: () => ws?.readyState ?? WebSocket.CONNECTING,
    connectionState: () => connState,
  };
}

/** Wire up WebSocket event handlers. */
function setupWebSocket(
  ws: WebSocket,
  sessionId: string,
  onEvent: SwarmEventListener,
  onError?: (error: Event) => void,
  onClose?: () => void
): void {
  ws.onmessage = (msg) => {
    try {
      const data: unknown = JSON.parse(msg.data);

      // Skip heartbeat pings (not part of SwarmEventUnion)
      if (
        typeof data === "object" &&
        data !== null &&
        (data as Record<string, unknown>).event === "ping"
      ) {
        return;
      }

      // Validate event structure before processing
      if (!isValidSwarmEvent(data)) {
        console.warn("[swarm-client] Invalid event received:", data);
        return;
      }

      // Deliver to caller
      onEvent(data);

      // Bridge to app-wide event bus for cross-component reactivity
      bridgeToAppEvents(data, sessionId);
    } catch {
      // Ignore malformed messages (unparseable JSON)
    }
  };

  ws.onerror = (err) => {
    onError?.(err);
  };

  ws.onclose = () => {
    onClose?.();
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
