/**
 * Lightweight app-wide event bus for cross-component reactivity.
 *
 * Solves the "state islands" problem: when thinking completes, the graph,
 * sessions list, insights panel, and fork panel all need to know — but they
 * live in separate hooks with no shared state. This event bus lets any
 * component emit or subscribe to named events without tight coupling.
 *
 * Usage:
 *   import { appEvents } from "@/lib/events";
 *
 *   // Emit
 *   appEvents.emit("thinking:complete", { sessionId });
 *
 *   // Subscribe (in useEffect)
 *   const unsub = appEvents.on("thinking:complete", (payload) => { ... });
 *   return () => unsub();
 */

type EventPayload = {
  /** Fired when a thinking stream finishes and nodes are persisted */
  "thinking:complete": { sessionId: string; nodeId?: string };
  /** Fired when a fork/debate analysis finishes */
  "fork:complete": { sessionId: string; analysisId?: string };
  /** Fired when the active session changes */
  "session:changed": { sessionId: string | null; previousSessionId: string | null };
  /** Fired when a swarm analysis finishes */
  "swarm:complete": { sessionId: string };
  /** Fired when GoT reasoning starts */
  "got:started": { sessionId: string; strategy: "bfs" | "dfs" | "best_first" };
  /** Fired when GoT reasoning completes */
  "got:complete": { sessionId: string; confidence: number };
  /** Fired when memory stats are updated during thinking */
  "memory:update": {
    stats: {
      mainContextEntries: number;
      recallStorageEntries: number;
      archivalStorageEntries: number;
      totalInserts: number;
      totalEvictions: number;
      totalPromotions: number;
    };
  };
  /** Fired when metacognitive insights are generated or refreshed */
  "insights:updated": { sessionId: string; count: number };
  /** Generic "something changed, refetch if you care" signal */
  "data:stale": { scope: "sessions" | "graph" | "insights" | "fork" | "got" | "all"; sessionId?: string };
};

type EventName = keyof EventPayload;
type Listener<T extends EventName> = (payload: EventPayload[T]) => void;

class AppEventBus {
  private listeners = new Map<EventName, Set<Listener<EventName>>>();

  on<T extends EventName>(event: T, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener as Listener<EventName>);

    // Return unsubscribe function
    return () => {
      set.delete(listener as Listener<EventName>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<T extends EventName>(event: T, payload: EventPayload[T]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[AppEventBus] Error in listener for "${event}":`, err);
      }
    }
  }
}

/** Singleton event bus — shared across all components */
export const appEvents = new AppEventBus();
