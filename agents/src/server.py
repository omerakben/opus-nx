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
import re
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from .config import Settings
from .events.bus import EventBus
from .graph.models import AgentName, EdgeRelation, ReasoningEdge, ReasoningNode
from .graph.reasoning_graph import SharedReasoningGraph
from .persistence import Neo4jPersistence, SupabasePersistence

log = structlog.get_logger(__name__)

HEARTBEAT_INTERVAL = 15  # seconds (reduced from 30 to prevent Fly.io proxy timeout at ~60s)

# Singletons — initialized in lifespan
settings: Settings = None  # type: ignore[assignment]
graph: SharedReasoningGraph = None  # type: ignore[assignment]
bus: EventBus = None  # type: ignore[assignment]
supabase_persistence: SupabasePersistence | None = None


STALE_SESSION_CHECK_INTERVAL = 300  # 5 minutes
STALE_SESSION_MAX_AGE = 1800  # 30 minutes


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize shared state on startup, clean up on shutdown."""
    global settings, graph, bus, supabase_persistence

    # Configure structlog with contextvars for trace_id propagation
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(0),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    settings = Settings()
    graph = SharedReasoningGraph()
    bus = EventBus()

    # -- Persistence (optional, graceful degradation) --
    neo4j_persistence = None

    if settings.neo4j_uri:
        try:
            neo4j_persistence = Neo4jPersistence(settings)
            log.info("neo4j_connected")
        except Exception as e:
            log.warning("neo4j_init_failed", error=str(e))

    if settings.supabase_url:
        try:
            supabase_persistence = SupabasePersistence(settings)
            log.info("supabase_persistence_connected")
        except Exception as e:
            log.warning("supabase_persistence_init_failed", error=str(e))

    async def on_graph_change(event_type: str, data):
        if neo4j_persistence:
            asyncio.create_task(neo4j_persistence.save(event_type, data))
        if supabase_persistence:
            asyncio.create_task(supabase_persistence.sync(event_type, data))

    graph.on_change(on_graph_change)

    # -- Background task: prune stale sessions every 5 minutes --
    async def prune_stale_sessions() -> None:
        while True:
            try:
                await asyncio.sleep(STALE_SESSION_CHECK_INTERVAL)
                stale_ids = bus.get_stale_sessions(max_age_seconds=STALE_SESSION_MAX_AGE)
                for sid in stale_ids:
                    removed = await graph.cleanup_session(sid)
                    bus.cleanup_session(sid)
                    log.info("stale_session_pruned", session_id=sid, nodes_removed=removed)
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.warning("stale_session_prune_error", error=str(e))

    cleanup_task = asyncio.create_task(prune_stale_sessions())

    yield

    # Shutdown: cancel background task and close persistence connections
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    if neo4j_persistence:
        await neo4j_persistence.close()


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
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
    )


_setup_cors()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

_UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


class SwarmRequest(BaseModel):
    query: str = Field(max_length=2000)
    session_id: str

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        if not _UUID_PATTERN.match(v):
            raise ValueError("session_id must be a valid UUID (e.g. '550e8400-e29b-41d4-a716-446655440000')")
        return v


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
# Auth dependency for protected endpoints
# ---------------------------------------------------------------------------


async def require_auth(authorization: str = Header(default="")) -> None:
    """Validate Bearer token from the Authorization header.

    The Next.js proxy injects `Authorization: Bearer <HMAC>` server-side.
    Direct requests without a valid token are rejected with 401.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="Invalid auth token")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "version": "2.0.0"}


@app.post("/api/swarm", dependencies=[Depends(require_auth)])
async def start_swarm(request: SwarmRequest) -> dict:
    """Start a swarm run. Events stream via WebSocket.

    Fire-and-forget: the swarm runs as a background task so the
    HTTP response returns immediately.
    """
    # Import here to avoid circular imports — SwarmManager depends on
    # agent modules that may not be ready yet during foundation phase.
    from .swarm import SwarmManager

    swarm = SwarmManager(settings, graph, bus, persistence=supabase_persistence)

    async def _run_swarm() -> None:
        try:
            await swarm.run(request.query, request.session_id)
        except Exception as exc:
            log.error(
                "swarm_run_failed",
                session_id=request.session_id,
                error=str(exc),
                exc_info=True,
            )
            # Notify connected clients that the swarm failed
            await bus.publish(
                request.session_id,
                {
                    "event": "swarm_error",
                    "session_id": request.session_id,
                    "error": str(exc),
                },
            )

    asyncio.create_task(_run_swarm())
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
    Heartbeat: sends {"event": "ping"} every 15s to prevent idle disconnect.
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

    async def drain_client_messages() -> None:
        """Read and discard client messages (pong responses).

        Without this, client-sent pongs accumulate in the WebSocket
        receive buffer. Reading them also ensures the proxy sees
        bidirectional traffic at the application layer.
        """
        try:
            while True:
                await websocket.receive_text()
        except (WebSocketDisconnect, Exception):
            pass

    heartbeat_task = asyncio.create_task(send_heartbeat())
    drain_task = asyncio.create_task(drain_client_messages())

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
        drain_task.cancel()
        bus.unsubscribe(session_id, queue)


# ---------------------------------------------------------------------------
# Human-in-the-loop checkpoint
# ---------------------------------------------------------------------------


class CheckpointRequest(BaseModel):
    node_id: str
    verdict: str  # verified | questionable | disagree
    correction: str | None = None

    @field_validator("verdict")
    @classmethod
    def validate_verdict(cls, v: str) -> str:
        if v not in {"verified", "questionable", "disagree"}:
            raise ValueError("verdict must be 'verified', 'questionable', or 'disagree'")
        return v


@app.post("/api/swarm/{session_id}/checkpoint", dependencies=[Depends(require_auth)])
async def checkpoint_node(session_id: str, request: CheckpointRequest) -> dict:
    """Annotate a reasoning node with a human verdict and optionally trigger a re-run."""
    from .events.types import HumanCheckpoint
    from .swarm import SwarmManager

    # Write human annotation node to graph
    annotation_node = ReasoningNode(
        agent=AgentName.MAESTRO,  # Human annotations attributed to maestro
        session_id=session_id,
        content=f"Human checkpoint: {request.verdict}"
        + (f"\nCorrection: {request.correction}" if request.correction else ""),
        reasoning="human_annotation",
        confidence=1.0,
    )
    node_id = await graph.add_node(annotation_node)

    # Add annotation edge to the target node
    annotation_edge = ReasoningEdge(
        source_id=node_id,
        target_id=request.node_id,
        relation=EdgeRelation.OBSERVES,
        weight=1.0,
        metadata={"verdict": request.verdict},
    )
    await graph.add_edge(annotation_edge)

    # Emit human checkpoint event
    await bus.publish(
        session_id,
        HumanCheckpoint(
            session_id=session_id,
            node_id=request.node_id,
            verdict=request.verdict,
            correction=request.correction,
        ),
    )

    # If disagree with correction, trigger targeted re-run
    result = {"status": "annotated", "annotation_node_id": node_id}
    if request.verdict == "disagree" and request.correction:
        swarm = SwarmManager(settings, graph, bus, persistence=supabase_persistence)

        async def _rerun() -> None:
            try:
                await swarm.rerun_with_correction(session_id, request.node_id, request.correction)
            except Exception as exc:
                log.error("swarm_rerun_failed", session_id=session_id, error=str(exc), exc_info=True)
                await bus.publish(session_id, {"event": "swarm_error", "session_id": session_id, "error": str(exc)})

        asyncio.create_task(_rerun())
        result["status"] = "rerun_started"

    return result
