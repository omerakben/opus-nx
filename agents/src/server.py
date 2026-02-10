"""FastAPI server for the Opus NX V2 agent swarm.

Provides REST endpoints for swarm control and WebSocket streaming
for real-time event delivery to the Next.js dashboard.

Auth uses HMAC-SHA256 matching the V1 pattern:
  HMAC(key=AUTH_SECRET, message="opus-nx-authenticated")
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import Settings
from .events.bus import EventBus
from .graph.reasoning_graph import SharedReasoningGraph

HEARTBEAT_INTERVAL = 30  # seconds

# Singletons — initialized in lifespan
settings: Settings = None  # type: ignore[assignment]
graph: SharedReasoningGraph = None  # type: ignore[assignment]
bus: EventBus = None  # type: ignore[assignment]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize shared state on startup, clean up on shutdown."""
    global settings, graph, bus

    settings = Settings()
    graph = SharedReasoningGraph()
    bus = EventBus()

    yield

    # Shutdown: nothing to clean up for in-memory state


app = FastAPI(title="Opus NX Swarm", version="2.0.0", lifespan=lifespan)


def _setup_cors() -> None:
    """Add CORS middleware. Called after app creation."""
    # Read origins at import time for middleware registration;
    # actual enforcement uses the runtime settings instance.
    try:
        _settings = Settings()
        origins = _settings.cors_origins
    except Exception:
        origins = ["http://localhost:3000"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )


_setup_cors()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SwarmRequest(BaseModel):
    query: str
    session_id: str


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def verify_token(token: str) -> bool:
    """Validate auth token using HMAC matching V1 pattern.

    V1 (auth.ts): createHmac("sha256", secret).update("opus-nx-authenticated").digest("hex")
    Python equivalent: hmac.new(key=secret, msg=b"opus-nx-authenticated", digestmod=sha256)
    """
    try:
        expected = hmac.new(
            settings.auth_secret.encode(),
            b"opus-nx-authenticated",
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(token, expected)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "version": "2.0.0"}


@app.post("/api/swarm")
async def start_swarm(request: SwarmRequest) -> dict:
    """Start a swarm run. Events stream via WebSocket.

    Fire-and-forget: the swarm runs as a background task so the
    HTTP response returns immediately.
    """
    # Import here to avoid circular imports — SwarmManager depends on
    # agent modules that may not be ready yet during foundation phase.
    from .swarm import SwarmManager

    swarm = SwarmManager(settings, graph, bus)
    asyncio.create_task(swarm.run(request.query, request.session_id))
    return {"status": "started", "session_id": request.session_id}


@app.get("/api/graph/{session_id}")
async def get_graph(session_id: str) -> dict:
    """Get the current reasoning graph for a session."""
    nodes = await graph.get_session_nodes(session_id)
    return {"nodes": nodes, "graph": graph.to_json()}


@app.websocket("/ws/{session_id}")
async def swarm_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(default=""),
) -> None:
    """Stream live swarm events to the dashboard.

    Auth: validates HMAC token BEFORE accepting the connection.
    Heartbeat: sends {"event": "ping"} every 30s to prevent idle disconnect.
    """
    # Validate token before accepting the WebSocket connection
    if not verify_token(token):
        await websocket.close(code=4001)
        return

    await websocket.accept()
    queue = bus.subscribe(session_id)

    async def send_heartbeat() -> None:
        """Prevent idle disconnect with periodic pings."""
        while True:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                await websocket.send_json({"event": "ping"})
            except Exception:
                break

    heartbeat_task = asyncio.create_task(send_heartbeat())

    try:
        while True:
            # 5-minute timeout — if no events for 5 min, disconnect
            event = await asyncio.wait_for(queue.get(), timeout=300)
            await websocket.send_json(
                event if isinstance(event, dict) else json.loads(event)
            )
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        heartbeat_task.cancel()
        bus.unsubscribe(session_id, queue)
