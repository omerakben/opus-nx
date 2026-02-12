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
from datetime import datetime, timezone
from typing import Any, AsyncGenerator
from uuid import uuid4

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

# ---------------------------------------------------------------------------
# Sliding-window rate limiter (per session_id)
# ---------------------------------------------------------------------------

_rate_limit_lock = asyncio.Lock()
_rate_limit_log: dict[str, list[float]] = {}


async def _check_rate_limit(session_id: str) -> bool:
    """Return True if the request is within rate limits, False if exceeded.

    Uses a sliding window: keeps timestamps of recent requests and prunes
    entries older than the configured window.
    """
    import time

    now = time.monotonic()
    window = settings.rate_limit_window_seconds if settings else 60
    max_requests = settings.rate_limit_requests if settings else 20

    async with _rate_limit_lock:
        timestamps = _rate_limit_log.get(session_id, [])
        # Prune old entries
        cutoff = now - window
        timestamps = [t for t in timestamps if t > cutoff]

        if len(timestamps) >= max_requests:
            _rate_limit_log[session_id] = timestamps
            return False

        timestamps.append(now)
        _rate_limit_log[session_id] = timestamps
        return True

LIFECYCLE_STATES = {
    "promoted",
    "checkpointed",
    "rerunning",
    "comparing",
    "retained",
    "deferred",
    "archived",
}
FINAL_LIFECYCLE_STATES = {"retained", "deferred", "archived"}
LIFECYCLE_TRANSITIONS: dict[str, set[str]] = {
    "promoted": {
        "promoted",
        "checkpointed",
        "rerunning",
        "comparing",
        "retained",
        "deferred",
        "archived",
    },
    "checkpointed": {
        "checkpointed",
        "rerunning",
        "comparing",
        "retained",
        "deferred",
        "archived",
    },
    "rerunning": {"rerunning", "comparing", "promoted", "retained", "deferred", "archived"},
    "comparing": {"comparing", "rerunning", "retained", "deferred", "archived"},
    "retained": {"retained", "archived"},
    "deferred": {"deferred", "rerunning", "comparing", "retained", "archived"},
    "archived": {"archived"},
}

_lifecycle_metrics_lock = asyncio.Lock()
_lifecycle_metrics = {
    "compare_requests": 0,
    "compare_completed": 0,
    "retention_decisions": {
        "retain": 0,
        "defer": 0,
        "archive": 0,
    },
}
_compare_inflight_lock = asyncio.Lock()
_compare_inflight: set[str] = set()


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
    settings.validate_at_startup()
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
            capabilities = await supabase_persistence.probe_capabilities()
            log.info("supabase_capabilities_probed", capabilities=capabilities)
        except Exception as e:
            log.warning("supabase_persistence_init_failed", error=str(e))

    async def on_graph_change(event_type: str, data):
        if neo4j_persistence:
            asyncio.create_task(neo4j_persistence.save(event_type, data))
        if supabase_persistence:
            await supabase_persistence.sync(event_type, data)

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


# In-memory fallback for hypothesis lifecycle when Supabase lifecycle tables
# are unavailable (for example, local/dev environments with partial schema).
_inmemory_hypothesis_lock = asyncio.Lock()
_inmemory_experiments_by_id: dict[str, dict[str, Any]] = {}
_inmemory_experiment_ids_by_session: dict[str, set[str]] = {}


def _copy_experiment(experiment: dict[str, Any]) -> dict[str, Any]:
    """Return a shallow copy that callers can safely mutate."""
    copied = dict(experiment)
    metadata = copied.get("metadata")
    if isinstance(metadata, dict):
        copied["metadata"] = dict(metadata)
    comparison_result = copied.get("comparison_result")
    if isinstance(comparison_result, dict):
        copied["comparison_result"] = dict(comparison_result)
    return copied


async def _inmemory_get_experiment(experiment_id: str) -> dict[str, Any] | None:
    async with _inmemory_hypothesis_lock:
        existing = _inmemory_experiments_by_id.get(experiment_id)
        return _copy_experiment(existing) if existing else None


async def _inmemory_upsert_experiment(experiment: dict[str, Any]) -> None:
    experiment_id = str(experiment.get("id") or "").strip()
    session_id = str(experiment.get("session_id") or "").strip()
    if not experiment_id or not session_id:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    async with _inmemory_hypothesis_lock:
        existing = _inmemory_experiments_by_id.get(experiment_id, {})
        merged = {
            **existing,
            **experiment,
            "id": experiment_id,
            "session_id": session_id,
            "created_at": str(existing.get("created_at") or experiment.get("created_at") or now_iso),
            "last_updated": str(experiment.get("last_updated") or now_iso),
        }
        metadata = merged.get("metadata")
        if not isinstance(metadata, dict):
            merged["metadata"] = {}
        _inmemory_experiments_by_id[experiment_id] = merged
        _inmemory_experiment_ids_by_session.setdefault(session_id, set()).add(experiment_id)


async def _inmemory_list_experiments(
    session_id: str,
    *,
    status: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    async with _inmemory_hypothesis_lock:
        ids = _inmemory_experiment_ids_by_session.get(session_id, set())
        rows = [
            _copy_experiment(_inmemory_experiments_by_id[experiment_id])
            for experiment_id in ids
            if experiment_id in _inmemory_experiments_by_id
        ]

    if status:
        rows = [row for row in rows if str(row.get("status") or "") == status]
    rows.sort(key=lambda row: str(row.get("last_updated") or ""), reverse=True)
    return rows[: max(1, min(limit, 500))]


def _merge_experiments_for_response(
    db_rows: list[dict[str, Any]],
    fallback_rows: list[dict[str, Any]],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    """Merge DB + fallback rows by id, preferring DB rows when both exist."""
    by_id: dict[str, dict[str, Any]] = {}
    for row in fallback_rows:
        row_id = str(row.get("id") or "").strip()
        if row_id:
            by_id[row_id] = row
    for row in db_rows:
        row_id = str(row.get("id") or "").strip()
        if row_id:
            by_id[row_id] = row
    merged = list(by_id.values())
    merged.sort(key=lambda row: str(row.get("last_updated") or ""), reverse=True)
    return merged[: max(1, min(limit, 500))]


def _normalize_status(status: str | None, *, fallback: str = "promoted") -> str:
    candidate = str(status or "").strip()
    if candidate in LIFECYCLE_STATES:
        return candidate
    return fallback


def _can_transition(current_status: str | None, next_status: str) -> bool:
    current = _normalize_status(current_status)
    allowed = LIFECYCLE_TRANSITIONS.get(current, {current})
    return next_status in allowed


def _coerce_experiment_shape(experiment: dict[str, Any]) -> dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    metadata = experiment.get("metadata")
    comparison = experiment.get("comparison_result")
    return {
        **experiment,
        "id": str(experiment.get("id") or ""),
        "session_id": str(experiment.get("session_id") or ""),
        "status": _normalize_status(str(experiment.get("status") or "promoted")),
        "metadata": metadata if isinstance(metadata, dict) else {},
        "comparison_result": comparison if isinstance(comparison, dict) else None,
        "retention_decision": (
            str(experiment.get("retention_decision"))
            if experiment.get("retention_decision") is not None
            else None
        ),
        "created_at": str(experiment.get("created_at") or now_iso),
        "last_updated": str(experiment.get("last_updated") or now_iso),
    }


async def _increment_lifecycle_metric(name: str) -> None:
    async with _lifecycle_metrics_lock:
        if name == "compare_requests":
            _lifecycle_metrics["compare_requests"] += 1
        elif name == "compare_completed":
            _lifecycle_metrics["compare_completed"] += 1


async def _increment_retention_metric(decision: str) -> None:
    if decision not in {"retain", "defer", "archive"}:
        return
    async with _lifecycle_metrics_lock:
        _lifecycle_metrics["retention_decisions"][decision] += 1


async def _lifecycle_metrics_snapshot() -> dict[str, Any]:
    async with _lifecycle_metrics_lock:
        compare_requests = _lifecycle_metrics["compare_requests"]
        compare_completed = _lifecycle_metrics["compare_completed"]
        decisions = dict(_lifecycle_metrics["retention_decisions"])
    total_decisions = sum(decisions.values())
    return {
        "compare_completion_rate": (
            compare_completed / compare_requests if compare_requests > 0 else 0.0
        ),
        "retention_ratio": {
            "retain": decisions["retain"] / total_decisions if total_decisions > 0 else 0.0,
            "defer": decisions["defer"] / total_decisions if total_decisions > 0 else 0.0,
            "archive": decisions["archive"] / total_decisions if total_decisions > 0 else 0.0,
        },
        "compare_requests": compare_requests,
        "compare_completed": compare_completed,
    }


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


@app.get("/api/system/capabilities")
async def system_capabilities() -> dict:
    """Return backend persistence capability readiness for UI health indicators."""
    if supabase_persistence is None:
        return {
            "supabase": {
                "configured": False,
                "tables": {},
                "rpc": {},
                "lifecycle_ready": False,
                "rehydration_ready": False,
            },
            "degraded_mode": True,
            "degraded_reason": "supabase_not_configured",
        }

    capabilities = supabase_persistence.get_capabilities_snapshot()
    lifecycle_ready = bool(capabilities.get("lifecycle_ready", False))
    return {
        "supabase": capabilities,
        "degraded_mode": not lifecycle_ready,
        "degraded_reason": None if lifecycle_ready else "supabase_lifecycle_capabilities_missing",
    }


@app.post("/api/swarm", dependencies=[Depends(require_auth)])
async def start_swarm(request: SwarmRequest) -> dict:
    """Start a swarm run. Events stream via WebSocket.

    Fire-and-forget: the swarm runs as a background task so the
    HTTP response returns immediately.
    """
    if not await _check_rate_limit(request.session_id):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: max {settings.rate_limit_requests} requests per {settings.rate_limit_window_seconds}s",
        )

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
        log.warning("ws_auth_rejected", session_id=session_id)
        await websocket.close(code=4001, reason="unauthorized")
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
    except WebSocketDisconnect:
        log.info("ws_client_disconnected", session_id=session_id)
    except asyncio.TimeoutError:
        log.info("ws_idle_timeout", session_id=session_id)
        try:
            await websocket.send_json(
                {"event": "error", "code": 4002, "reason": "idle_timeout"}
            )
            await websocket.close(code=4002)
        except Exception:
            pass
    except Exception as exc:
        log.error("ws_unexpected_error", session_id=session_id, error=str(exc))
        try:
            await websocket.send_json(
                {"event": "error", "code": 4003, "reason": "internal_error"}
            )
            await websocket.close(code=4003)
        except Exception:
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
    verdict: str  # verified | questionable | disagree | agree | explore | note
    correction: str | None = None
    experiment_id: str | None = None
    alternative_summary: str | None = None
    promoted_by: str = "human"

    @field_validator("verdict")
    @classmethod
    def validate_verdict(cls, v: str) -> str:
        if v not in {"verified", "questionable", "disagree", "agree", "explore", "note"}:
            raise ValueError(
                "verdict must be one of: verified, questionable, disagree, agree, explore, note"
            )
        return v


@app.post("/api/swarm/{session_id}/checkpoint", dependencies=[Depends(require_auth)])
async def checkpoint_node(session_id: str, request: CheckpointRequest) -> dict:
    """Annotate a reasoning node with a human verdict and optionally trigger a re-run."""
    from .events.types import HumanCheckpoint, HypothesisExperimentUpdated
    from .swarm import SwarmManager

    checkpoint_time = datetime.now(timezone.utc)

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

    # Optional: create/link hypothesis experiment rows for checkpoint telemetry.
    experiment_id = request.experiment_id
    checkpoint_summary = (
        request.alternative_summary
        or request.correction
        or f"Checkpoint verdict: {request.verdict}"
    )
    if supabase_persistence:
        try:
            # Auto-create an experiment on actionable checkpoint disagreement/exploration.
            if (
                experiment_id is None
                and request.verdict in {"disagree", "explore"}
                and (request.correction or request.alternative_summary)
            ):
                experiment_id = await supabase_persistence.create_hypothesis_experiment(
                    session_id=session_id,
                    hypothesis_node_id=request.node_id,
                    alternative_summary=checkpoint_summary,
                    promoted_by=request.promoted_by,
                    status="promoted",
                    metadata={
                        "source": "checkpoint_api",
                        "checkpoint_verdict": request.verdict,
                        "checkpoint_time": checkpoint_time.isoformat(),
                    },
                )
                if experiment_id:
                    await supabase_persistence.create_hypothesis_experiment_action(
                        experiment_id=experiment_id,
                        session_id=session_id,
                        action="promote",
                        performed_by=request.promoted_by,
                        details={
                            "source": "checkpoint_auto_promote",
                            "node_id": request.node_id,
                            "verdict": request.verdict,
                            "correction": request.correction,
                        },
                    )

            if experiment_id:
                await supabase_persistence.create_hypothesis_experiment_action(
                    experiment_id=experiment_id,
                    session_id=session_id,
                    action="checkpoint",
                    performed_by=request.promoted_by,
                    details={
                        "node_id": request.node_id,
                        "annotation_node_id": node_id,
                        "verdict": request.verdict,
                        "correction": request.correction,
                        "checkpoint_time": checkpoint_time.isoformat(),
                    },
                )
        except Exception as exc:
            log.warning(
                "checkpoint_experiment_link_failed",
                session_id=session_id,
                node_id=request.node_id,
                experiment_id=experiment_id,
                error=str(exc),
            )

    # Always maintain a fallback lifecycle row in-memory so UI lifecycle
    # controls remain usable even when Supabase lifecycle tables are missing.
    if (
        experiment_id is None
        and request.verdict in {"disagree", "explore"}
        and (request.correction or request.alternative_summary)
    ):
        experiment_id = str(uuid4())

    if experiment_id:
        existing_experiment = await _inmemory_get_experiment(experiment_id)
        now_iso = checkpoint_time.isoformat()
        current_metadata = (
            dict(existing_experiment.get("metadata", {}))
            if isinstance(existing_experiment, dict)
            and isinstance(existing_experiment.get("metadata"), dict)
            else {}
        )
        await _inmemory_upsert_experiment(
            {
                "id": experiment_id,
                "session_id": session_id,
                "hypothesis_node_id": request.node_id,
                "promoted_by": str(
                    (existing_experiment or {}).get("promoted_by")
                    or request.promoted_by
                    or "human"
                ),
                "alternative_summary": str(
                    (existing_experiment or {}).get("alternative_summary")
                    or checkpoint_summary
                ),
                "status": str(
                    (existing_experiment or {}).get("status")
                    or ("promoted" if request.verdict in {"disagree", "explore"} else "checkpointed")
                ),
                "preferred_run_id": (existing_experiment or {}).get("preferred_run_id"),
                "rerun_run_id": (existing_experiment or {}).get("rerun_run_id"),
                "comparison_result": (existing_experiment or {}).get("comparison_result"),
                "retention_decision": (existing_experiment or {}).get("retention_decision"),
                "metadata": {
                    **current_metadata,
                    "source": str(current_metadata.get("source") or "checkpoint_api"),
                    "last_checkpoint": {
                        "node_id": request.node_id,
                        "verdict": request.verdict,
                        "correction": request.correction,
                        "checkpoint_time": now_iso,
                    },
                },
                "created_at": str((existing_experiment or {}).get("created_at") or now_iso),
                "last_updated": now_iso,
            }
        )

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
    result = {"status": "annotated", "annotation_node_id": node_id, "experiment_id": experiment_id}
    if request.verdict == "disagree" and request.correction:
        swarm = SwarmManager(settings, graph, bus, persistence=supabase_persistence)

        if supabase_persistence and experiment_id:
            try:
                await supabase_persistence.update_hypothesis_experiment(
                    experiment_id,
                    status="rerunning",
                    metadata={
                        "last_checkpoint": {
                            "node_id": request.node_id,
                            "verdict": request.verdict,
                            "correction": request.correction,
                            "checkpoint_time": checkpoint_time.isoformat(),
                        }
                    },
                )
                await supabase_persistence.create_hypothesis_experiment_action(
                    experiment_id=experiment_id,
                    session_id=session_id,
                    action="rerun",
                    performed_by=request.promoted_by,
                    details={
                        "phase": "started",
                        "node_id": request.node_id,
                        "correction": request.correction,
                        "checkpoint_time": checkpoint_time.isoformat(),
                    },
                )
            except Exception as exc:
                log.warning(
                    "checkpoint_rerun_status_update_failed",
                    session_id=session_id,
                    experiment_id=experiment_id,
                    error=str(exc),
                )
        if experiment_id:
            existing_experiment = await _inmemory_get_experiment(experiment_id)
            existing_metadata = (
                dict(existing_experiment.get("metadata", {}))
                if isinstance(existing_experiment, dict)
                and isinstance(existing_experiment.get("metadata"), dict)
                else {}
            )
            await _inmemory_upsert_experiment(
                {
                    "id": experiment_id,
                    "session_id": session_id,
                    "status": "rerunning",
                    "metadata": {
                        **existing_metadata,
                        "last_checkpoint": {
                            "node_id": request.node_id,
                            "verdict": request.verdict,
                            "correction": request.correction,
                            "checkpoint_time": checkpoint_time.isoformat(),
                        },
                    },
                    "last_updated": checkpoint_time.isoformat(),
                }
            )
            await bus.publish(
                session_id,
                HypothesisExperimentUpdated(
                    session_id=session_id,
                    experiment_id=experiment_id,
                    status="rerunning",
                    metadata={
                        "node_id": request.node_id,
                        "checkpoint_verdict": request.verdict,
                    },
                ),
            )

        async def _rerun() -> None:
            try:
                rerun_result = await swarm.rerun_with_correction(
                    session_id,
                    request.node_id,
                    request.correction,
                    experiment_id=experiment_id,
                )

                if experiment_id:
                    comparison_result = {
                        "checkpoint": {
                            "node_id": request.node_id,
                            "verdict": request.verdict,
                            "correction": request.correction,
                        },
                        "rerun": {
                            "agents": rerun_result.get("agents", []),
                            "status": rerun_result.get("status"),
                            "total_tokens": rerun_result.get("total_tokens", 0),
                            "total_duration_ms": rerun_result.get("total_duration_ms", 0),
                        },
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                    }

                    if supabase_persistence:
                        try:
                            await supabase_persistence.update_hypothesis_experiment(
                                experiment_id,
                                status="comparing",
                                comparison_result=comparison_result,
                            )
                            await supabase_persistence.create_hypothesis_experiment_action(
                                experiment_id=experiment_id,
                                session_id=session_id,
                                action="compare",
                                performed_by=request.promoted_by,
                                details=comparison_result,
                            )
                        except Exception as exc:
                            log.warning(
                                "checkpoint_compare_update_failed",
                                session_id=session_id,
                                experiment_id=experiment_id,
                                error=str(exc),
                            )

                    existing_experiment = await _inmemory_get_experiment(experiment_id)
                    existing_metadata = (
                        dict(existing_experiment.get("metadata", {}))
                        if isinstance(existing_experiment, dict)
                        and isinstance(existing_experiment.get("metadata"), dict)
                        else {}
                    )
                    await _inmemory_upsert_experiment(
                        {
                            "id": experiment_id,
                            "session_id": session_id,
                            "status": "comparing",
                            "comparison_result": comparison_result,
                            "metadata": {
                                **existing_metadata,
                                "source": "checkpoint_rerun",
                            },
                            "last_updated": datetime.now(timezone.utc).isoformat(),
                        }
                    )

                    await bus.publish(
                        session_id,
                        HypothesisExperimentUpdated(
                            session_id=session_id,
                            experiment_id=experiment_id,
                            status="comparing",
                            comparison_result=comparison_result,
                            metadata={"source": "checkpoint_rerun"},
                        ),
                    )
            except Exception as exc:
                log.error("swarm_rerun_failed", session_id=session_id, error=str(exc), exc_info=True)
                if supabase_persistence and experiment_id:
                    try:
                        await supabase_persistence.update_hypothesis_experiment(
                            experiment_id,
                            status="promoted",
                            metadata={"last_error": str(exc)},
                        )
                    except Exception:
                        pass
                if experiment_id:
                    existing_experiment = await _inmemory_get_experiment(experiment_id)
                    existing_metadata = (
                        dict(existing_experiment.get("metadata", {}))
                        if isinstance(existing_experiment, dict)
                        and isinstance(existing_experiment.get("metadata"), dict)
                        else {}
                    )
                    await _inmemory_upsert_experiment(
                        {
                            "id": experiment_id,
                            "session_id": session_id,
                            "status": "promoted",
                            "metadata": {
                                **existing_metadata,
                                "last_error": str(exc),
                            },
                            "last_updated": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                await bus.publish(session_id, {"event": "swarm_error", "session_id": session_id, "error": str(exc)})

        asyncio.create_task(_rerun())
        result["status"] = "rerun_started"
    elif experiment_id:
        existing_experiment = await _inmemory_get_experiment(experiment_id)
        existing_metadata = (
            dict(existing_experiment.get("metadata", {}))
            if isinstance(existing_experiment, dict)
            and isinstance(existing_experiment.get("metadata"), dict)
            else {}
        )
        await _inmemory_upsert_experiment(
            {
                "id": experiment_id,
                "session_id": session_id,
                "status": "checkpointed",
                "metadata": {
                    **existing_metadata,
                    "node_id": request.node_id,
                    "verdict": request.verdict,
                    "correction": request.correction,
                },
                "last_updated": checkpoint_time.isoformat(),
            }
        )
        await bus.publish(
            session_id,
            HypothesisExperimentUpdated(
                session_id=session_id,
                experiment_id=experiment_id,
                status="checkpointed",
                metadata={
                    "node_id": request.node_id,
                    "verdict": request.verdict,
                    "correction": request.correction,
                },
            ),
        )

    return result


# ---------------------------------------------------------------------------
# Hypothesis lifecycle routes
# ---------------------------------------------------------------------------


class HypothesisRetentionRequest(BaseModel):
    decision: str  # retain | defer | archive
    performed_by: str = Field(default="human", alias="performedBy")

    model_config = {"populate_by_name": True}

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        if v not in {"retain", "defer", "archive"}:
            raise ValueError("decision must be one of: retain, defer, archive")
        return v


class HypothesisCompareRequest(BaseModel):
    performed_by: str = Field(default="human", alias="performedBy")
    rerun_if_missing: bool = Field(default=True, alias="rerunIfMissing")
    force_rerun: bool = Field(default=False, alias="forceRerun")
    node_id: str | None = Field(default=None, alias="nodeId")
    correction: str | None = None

    model_config = {"populate_by_name": True}


@app.get("/api/swarm/{session_id}/experiments", dependencies=[Depends(require_auth)])
async def list_hypothesis_experiments(
    session_id: str,
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict:
    """List hypothesis experiments for a session."""
    if not _UUID_PATTERN.match(session_id):
        raise HTTPException(
            status_code=400,
            detail="session_id must be a valid UUID",
        )

    db_experiments: list[dict[str, Any]] = []
    degraded_mode = supabase_persistence is None
    degraded_reason: str | None = "supabase_not_configured" if degraded_mode else None
    capabilities: dict[str, Any] = {
        "configured": False,
        "tables": {},
        "rpc": {},
        "lifecycle_ready": False,
        "rehydration_ready": False,
    }
    if supabase_persistence is not None:
        raw_capabilities = supabase_persistence.get_capabilities_snapshot()
        if asyncio.iscoroutine(raw_capabilities):
            raw_capabilities = await raw_capabilities
        if isinstance(raw_capabilities, dict):
            capabilities = raw_capabilities
        lifecycle_ready = bool(capabilities.get("lifecycle_ready", False))
        if not lifecycle_ready:
            degraded_mode = True
            degraded_reason = "supabase_lifecycle_capabilities_missing"
        try:
            db_experiments = await supabase_persistence.list_session_hypothesis_experiments(
                session_id,
                status=status,
                limit=limit,
            )
        except Exception as exc:
            log.warning(
                "hypothesis_experiment_list_fallback_to_memory",
                session_id=session_id,
                error=str(exc),
            )
            degraded_mode = True
            degraded_reason = "supabase_query_failed"
    else:
        log.warning("hypothesis_experiment_list_unavailable", reason="supabase_not_configured")

    fallback_experiments = await _inmemory_list_experiments(
        session_id,
        status=status,
        limit=limit,
    )
    if not degraded_mode and not db_experiments and len(fallback_experiments) > 0:
        degraded_mode = True
        degraded_reason = "supabase_lifecycle_tables_unavailable"
    experiments = _merge_experiments_for_response(
        db_experiments,
        fallback_experiments,
        limit=limit,
    )
    normalized_experiments = [_coerce_experiment_shape(row) for row in experiments]
    lifecycle_metrics = await _lifecycle_metrics_snapshot()
    return {
        "experiments": normalized_experiments,
        "lifecycle": {
            "degraded_mode": degraded_mode,
            "degraded_reason": degraded_reason,
            "capabilities": capabilities,
            **lifecycle_metrics,
        },
    }


@app.post("/api/swarm/experiments/{experiment_id}/compare", dependencies=[Depends(require_auth)])
async def compare_hypothesis_experiment(
    experiment_id: str,
    request: HypothesisCompareRequest,
) -> dict:
    """Compute or publish comparison state for an experiment."""
    from .events.types import HypothesisExperimentUpdated
    from .swarm import SwarmManager

    await _increment_lifecycle_metric("compare_requests")

    if not _UUID_PATTERN.match(experiment_id):
        raise HTTPException(
            status_code=400,
            detail="experiment_id must be a valid UUID",
        )

    experiment: dict[str, Any] | None = None
    if supabase_persistence is not None:
        try:
            experiment = await supabase_persistence.get_hypothesis_experiment(experiment_id)
        except Exception as exc:
            log.warning(
                "compare_experiment_db_fetch_failed",
                experiment_id=experiment_id,
                error=str(exc),
            )
    if experiment is None:
        experiment = await _inmemory_get_experiment(experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Hypothesis experiment not found")
    experiment = _coerce_experiment_shape(experiment)

    session_id = str(experiment.get("session_id") or "")
    if not session_id:
        raise HTTPException(
            status_code=500,
            detail="Experiment row is missing session_id",
        )

    metadata = experiment.get("metadata")
    metadata_dict = metadata if isinstance(metadata, dict) else {}
    existing_comparison = experiment.get("comparison_result")
    has_existing_comparison = isinstance(existing_comparison, dict)
    current_status = _normalize_status(str(experiment.get("status") or "promoted"))

    async def _persist_update(
        *,
        status: str | None = None,
        comparison_result: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        retention_decision: str | None = None,
    ) -> None:
        nonlocal current_status
        now_iso = datetime.now(timezone.utc).isoformat()
        target_status = status
        if target_status is not None:
            normalized_target = _normalize_status(target_status, fallback=current_status)
            if not _can_transition(current_status, normalized_target):
                log.warning(
                    "hypothesis_lifecycle_transition_blocked",
                    experiment_id=experiment_id,
                    current_status=current_status,
                    requested_status=normalized_target,
                )
                normalized_target = current_status
            target_status = normalized_target
        if supabase_persistence is not None:
            try:
                update_kwargs: dict[str, Any] = {}
                if target_status is not None:
                    update_kwargs["status"] = target_status
                if comparison_result is not None:
                    update_kwargs["comparison_result"] = comparison_result
                if retention_decision is not None:
                    update_kwargs["retention_decision"] = retention_decision
                if metadata is not None:
                    update_kwargs["metadata"] = metadata
                await supabase_persistence.update_hypothesis_experiment(
                    experiment_id,
                    **update_kwargs,
                )
            except Exception as exc:
                log.warning(
                    "compare_experiment_db_update_failed",
                    experiment_id=experiment_id,
                    error=str(exc),
                )
        await _inmemory_upsert_experiment(
            {
                "id": experiment_id,
                "session_id": session_id,
                **({"status": target_status} if target_status is not None else {}),
                **(
                    {"comparison_result": comparison_result}
                    if comparison_result is not None
                    else {}
                ),
                **({"retention_decision": retention_decision} if retention_decision is not None else {}),
                **({"metadata": metadata} if metadata is not None else {}),
                "last_updated": now_iso,
            }
        )
        if target_status is not None:
            current_status = target_status
            experiment["status"] = target_status
        if comparison_result is not None:
            experiment["comparison_result"] = comparison_result
        if retention_decision is not None:
            experiment["retention_decision"] = retention_decision
        if metadata is not None:
            experiment["metadata"] = metadata

    async def _persist_action(action: str, details: dict[str, Any]) -> None:
        if supabase_persistence is None:
            return
        try:
            await supabase_persistence.create_hypothesis_experiment_action(
                experiment_id=experiment_id,
                session_id=session_id,
                action=action,
                performed_by=request.performed_by,
                details=details,
            )
        except Exception as exc:
            log.warning(
                "compare_experiment_db_action_failed",
                experiment_id=experiment_id,
                action=action,
                error=str(exc),
            )

    if has_existing_comparison and not request.force_rerun:
        status = current_status
        if status not in FINAL_LIFECYCLE_STATES:
            status = "comparing"
            await _persist_update(status=status)

        await _persist_action(
            "compare",
            {
                "source": "compare_api",
                "mode": "existing_result",
            },
        )
        await _increment_lifecycle_metric("compare_completed")
        metrics_snapshot = await _lifecycle_metrics_snapshot()
        log.info(
            "lifecycle_compare_metrics",
            experiment_id=experiment_id,
            compare_completion_rate=metrics_snapshot["compare_completion_rate"],
            compare_requests=metrics_snapshot["compare_requests"],
            compare_completed=metrics_snapshot["compare_completed"],
        )
        await bus.publish(
            session_id,
            HypothesisExperimentUpdated(
                session_id=session_id,
                experiment_id=experiment_id,
                status=status,
                comparison_result=existing_comparison,
                retention_decision=experiment.get("retention_decision"),
                metadata={
                    "source": "compare_api",
                    "mode": "existing_result",
                },
            ),
        )
        return {
            "status": "comparison_ready",
            "experiment_id": experiment_id,
            "comparison_result": existing_comparison,
            "mode": "existing_result",
        }

    if current_status == "rerunning" and not request.force_rerun:
        comparison_placeholder = (
            existing_comparison
            if isinstance(existing_comparison, dict)
            else {
                "summary": "Comparison rerun already in progress.",
                "status": "pending",
                "source": "compare_api",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {
            "status": "compare_started",
            "experiment_id": experiment_id,
            "comparison_result": comparison_placeholder,
            "mode": "already_rerunning",
        }

    if not request.rerun_if_missing and not request.force_rerun:
        raise HTTPException(
            status_code=409,
            detail="comparison_result missing and rerunIfMissing is false",
        )

    last_checkpoint = (
        metadata_dict.get("last_checkpoint")
        if isinstance(metadata_dict.get("last_checkpoint"), dict)
        else {}
    )
    node_id = request.node_id or str(last_checkpoint.get("node_id") or "")
    correction = request.correction or str(last_checkpoint.get("correction") or "")
    if not node_id or not correction:
        raise HTTPException(
            status_code=409,
            detail="Cannot run comparison rerun without node_id and correction",
        )

    async with _compare_inflight_lock:
        if experiment_id in _compare_inflight and not request.force_rerun:
            return {
                "status": "compare_started",
                "experiment_id": experiment_id,
                "node_id": node_id,
                "comparison_result": {
                    "summary": "Comparison rerun already queued.",
                    "status": "pending",
                    "source": "compare_api",
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                },
                "mode": "inflight",
            }
        _compare_inflight.add(experiment_id)

    pending_comparison = {
        "summary": "Comparison rerun started asynchronously. Awaiting candidate run metrics.",
        "status": "pending",
        "checkpoint": {
            "node_id": node_id,
            "correction": correction,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "compare_api",
    }
    rerun_metadata = {
        **metadata_dict,
        "compare_requested_at": datetime.now(timezone.utc).isoformat(),
        "compare_request_source": "compare_api",
    }
    try:
        await _persist_update(
            status="rerunning",
            comparison_result=pending_comparison,
            metadata=rerun_metadata,
        )
        await _persist_action(
            "rerun",
            {
                "source": "compare_api",
                "phase": "started",
                "node_id": node_id,
                "correction": correction,
            },
        )
        await bus.publish(
            session_id,
            HypothesisExperimentUpdated(
                session_id=session_id,
                experiment_id=experiment_id,
                status="rerunning",
                comparison_result=pending_comparison,
                metadata={
                    "source": "compare_api",
                    "node_id": node_id,
                },
            ),
        )
    except Exception:
        async with _compare_inflight_lock:
            _compare_inflight.discard(experiment_id)
        raise

    swarm = SwarmManager(settings, graph, bus, persistence=supabase_persistence)

    async def _run_compare() -> None:
        try:
            rerun_result = await swarm.rerun_with_correction(
                session_id,
                node_id,
                correction,
                experiment_id=experiment_id,
            )
            comparison_result = {
                "checkpoint": {
                    "node_id": node_id,
                    "correction": correction,
                },
                "rerun": {
                    "agents": rerun_result.get("agents", []),
                    "status": rerun_result.get("status"),
                    "total_tokens": rerun_result.get("total_tokens", 0),
                    "total_duration_ms": rerun_result.get("total_duration_ms", 0),
                },
                "summary": (
                    "Candidate rerun completed with "
                    f"{len(rerun_result.get('agents', []))} agents, "
                    f"{int(rerun_result.get('total_tokens', 0))} tokens, "
                    f"{int(rerun_result.get('total_duration_ms', 0) / 1000)}s runtime."
                ),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source": "compare_api_rerun",
            }

            await _persist_update(
                status="comparing",
                comparison_result=comparison_result,
            )
            await _persist_action("compare", comparison_result)
            await _increment_lifecycle_metric("compare_completed")
            metrics_snapshot = await _lifecycle_metrics_snapshot()
            log.info(
                "lifecycle_compare_metrics",
                experiment_id=experiment_id,
                compare_completion_rate=metrics_snapshot["compare_completion_rate"],
                compare_requests=metrics_snapshot["compare_requests"],
                compare_completed=metrics_snapshot["compare_completed"],
            )
            await bus.publish(
                session_id,
                HypothesisExperimentUpdated(
                    session_id=session_id,
                    experiment_id=experiment_id,
                    status="comparing",
                    comparison_result=comparison_result,
                    metadata={"source": "compare_api_rerun"},
                ),
            )
        except Exception as exc:
            log.error(
                "compare_rerun_failed",
                session_id=session_id,
                experiment_id=experiment_id,
                error=str(exc),
                exc_info=True,
            )
            await _persist_update(
                status="promoted",
                metadata={
                    **metadata_dict,
                    "last_compare_error": str(exc),
                },
            )
        finally:
            async with _compare_inflight_lock:
                _compare_inflight.discard(experiment_id)

    asyncio.create_task(_run_compare())
    return {
        "status": "compare_started",
        "experiment_id": experiment_id,
        "node_id": node_id,
        "comparison_result": pending_comparison,
        "mode": "async_started",
    }


@app.post("/api/swarm/experiments/{experiment_id}/retain", dependencies=[Depends(require_auth)])
async def retain_hypothesis_experiment(
    experiment_id: str,
    request: HypothesisRetentionRequest,
) -> dict:
    """Persist retention decision and emit lifecycle update event."""
    from .events.types import HypothesisExperimentUpdated

    if not _UUID_PATTERN.match(experiment_id):
        raise HTTPException(
            status_code=400,
            detail="experiment_id must be a valid UUID",
        )

    experiment: dict[str, Any] | None = None
    if supabase_persistence is not None:
        try:
            experiment = await supabase_persistence.get_hypothesis_experiment(experiment_id)
        except Exception as exc:
            log.warning(
                "retain_experiment_db_fetch_failed",
                experiment_id=experiment_id,
                error=str(exc),
            )
    if experiment is None:
        experiment = await _inmemory_get_experiment(experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Hypothesis experiment not found")
    experiment = _coerce_experiment_shape(experiment)

    session_id = str(experiment.get("session_id") or "")
    if not session_id:
        raise HTTPException(
            status_code=500,
            detail="Experiment row is missing session_id",
        )

    current_status = _normalize_status(str(experiment.get("status") or "promoted"))
    current_decision = (
        str(experiment.get("retention_decision"))
        if experiment.get("retention_decision") is not None
        else None
    )
    if (
        current_status in FINAL_LIFECYCLE_STATES
        and current_decision == request.decision
    ):
        return {"experiment": experiment}

    decided_at = datetime.now(timezone.utc).isoformat()
    if request.decision == "archive":
        next_status = "archived"
    elif request.decision == "defer":
        next_status = "deferred"
    else:
        next_status = "retained"
    if not _can_transition(current_status, next_status):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot transition experiment from {current_status} to {next_status}",
        )
    existing_metadata = experiment.get("metadata")
    metadata = existing_metadata if isinstance(existing_metadata, dict) else {}
    merged_metadata = {
        **metadata,
        "retention_updated_at": decided_at,
        "retention_decision": request.decision,
    }

    if supabase_persistence is not None:
        try:
            await supabase_persistence.update_hypothesis_experiment(
                experiment_id,
                status=next_status,
                retention_decision=request.decision,
                metadata=merged_metadata,
            )
            await supabase_persistence.create_hypothesis_experiment_action(
                experiment_id=experiment_id,
                session_id=session_id,
                action="retain",
                performed_by=request.performed_by,
                details={
                    "decision": request.decision,
                    "decided_at": decided_at,
                },
            )
        except Exception as exc:
            log.warning(
                "retain_experiment_db_update_failed",
                experiment_id=experiment_id,
                error=str(exc),
            )

    await _inmemory_upsert_experiment(
        {
            "id": experiment_id,
            "session_id": session_id,
            "status": next_status,
            "retention_decision": request.decision,
            "metadata": merged_metadata,
            "last_updated": decided_at,
        }
    )
    await _increment_retention_metric(request.decision)
    metrics_snapshot = await _lifecycle_metrics_snapshot()
    log.info(
        "lifecycle_retention_metrics",
        experiment_id=experiment_id,
        retention_ratio=metrics_snapshot["retention_ratio"],
    )

    updated_experiment = None
    if supabase_persistence is not None:
        try:
            updated_experiment = await supabase_persistence.get_hypothesis_experiment(experiment_id)
        except Exception:
            updated_experiment = None
    if updated_experiment is None:
        updated_experiment = await _inmemory_get_experiment(experiment_id)
    if isinstance(updated_experiment, dict):
        updated_experiment = _coerce_experiment_shape(updated_experiment)
    comparison_result = None
    if isinstance(updated_experiment, dict):
        raw_comparison = updated_experiment.get("comparison_result")
        if isinstance(raw_comparison, dict):
            comparison_result = raw_comparison

    await bus.publish(
        session_id,
        HypothesisExperimentUpdated(
            session_id=session_id,
            experiment_id=experiment_id,
            status=next_status,
            comparison_result=comparison_result,
            retention_decision=request.decision,
            metadata={
                "source": "retention_api",
                "performed_by": request.performed_by,
                "retention_updated_at": decided_at,
            },
        ),
    )

    return {
        "experiment": updated_experiment
        or {
            "id": experiment_id,
            "session_id": session_id,
            "status": next_status,
            "retention_decision": request.decision,
            "metadata": merged_metadata,
        }
    }
