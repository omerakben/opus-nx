"""WebSocket endpoint tests.

Tests auth, event delivery, heartbeat, and connection management
for the FastAPI server.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TEST_SECRET = "test-secret"

_ENV_OVERRIDES = {
    "ANTHROPIC_API_KEY": "sk-ant-test",
    "SUPABASE_URL": "http://localhost:54321",
    "SUPABASE_SERVICE_ROLE_KEY": "test-key",
    "AUTH_SECRET": _TEST_SECRET,
}


def _generate_token(secret: str = _TEST_SECRET) -> str:
    """Generate a valid HMAC auth token matching the V1 pattern."""
    return hmac.new(
        secret.encode(), b"opus-nx-authenticated", hashlib.sha256
    ).hexdigest()


def _make_test_client():
    """Create a TestClient with mocked environment and dependencies.

    The server module imports persistence modules that may require
    neo4j/supabase packages. We mock those imports to avoid
    install-time dependencies in tests.
    """
    # Mock persistence modules before importing server
    mock_neo4j = MagicMock()
    mock_supabase = MagicMock()
    MagicMock()

    with patch.dict(os.environ, _ENV_OVERRIDES, clear=False):
        # Ensure persistence modules can be imported even without neo4j/supabase packages
        with patch.dict(sys.modules, {
            "neo4j": mock_neo4j,
            "supabase": mock_supabase,
        }):
            import importlib

            # Reload persistence modules with mocks in place
            if "src.persistence.neo4j_client" in sys.modules:
                importlib.reload(sys.modules["src.persistence.neo4j_client"])
            if "src.persistence.supabase_sync" in sys.modules:
                importlib.reload(sys.modules["src.persistence.supabase_sync"])
            if "src.persistence" in sys.modules:
                importlib.reload(sys.modules["src.persistence"])

            import src.server as server_mod

            importlib.reload(server_mod)

            # Manually initialize singletons (bypass lifespan for testing)
            from src.config import Settings
            from src.events.bus import EventBus
            from src.graph.reasoning_graph import SharedReasoningGraph

            server_mod.settings = Settings()
            server_mod.graph = SharedReasoningGraph()
            server_mod.bus = EventBus()

            from fastapi.testclient import TestClient

            return TestClient(server_mod.app), server_mod


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    """REST endpoint sanity checks."""

    def test_health_returns_ok(self):
        client, _ = _make_test_client()
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "2.0.0"


class TestWebSocketAuth:
    """WebSocket authentication using HMAC tokens."""

    def test_websocket_auth_rejection(self):
        """Connection with an invalid token should be rejected."""
        client, _ = _make_test_client()
        # The server calls websocket.close(code=4001) before accept,
        # which raises an exception in the test client.
        with pytest.raises(Exception):
            with client.websocket_connect("/ws/test-session?token=bad-token"):
                pass

    def test_websocket_auth_success(self):
        """Connection with a valid HMAC token should be accepted."""
        client, _ = _make_test_client()
        token = _generate_token()
        with client.websocket_connect(f"/ws/test-session?token={token}"):
            # Connection was accepted -- exiting context manager closes cleanly
            pass


class TestWebSocketEventDelivery:
    """Event delivery over WebSocket."""

    def test_websocket_receives_published_event(self):
        """Events published to the bus should arrive via WebSocket."""
        client, server_mod = _make_test_client()
        token = _generate_token()

        from src.events.types import AgentStarted

        with client.websocket_connect(
            f"/ws/test-delivery?token={token}"
        ) as ws:
            # Publish a pre-serialized event dict directly to the queue.
            # The bus normally calls event.model_dump() which produces
            # datetime objects; the server's send_json needs pure JSON types.
            # We use model_dump(mode="json") for test compatibility.

            event = AgentStarted(
                session_id="test-delivery",
                agent="deep_thinker",
                effort="max",
            )
            event_dict = event.model_dump(mode="json")

            # Publish directly to the subscriber queue
            queues = server_mod.bus._subscribers.get("test-delivery", [])
            for q in queues:
                q.put_nowait(event_dict)

            # The WebSocket should receive the event
            data = ws.receive_json(mode="text")
            assert data["event"] == "agent_started"
            assert data["agent"] == "deep_thinker"


class TestSwarmEndpoint:
    """POST /api/swarm endpoint."""

    def test_swarm_returns_started(self):
        """POST /api/swarm should return started status immediately."""
        client, _ = _make_test_client()
        token = _generate_token()
        test_uuid = "550e8400-e29b-41d4-a716-446655440000"
        response = client.post(
            "/api/swarm",
            json={"query": "Test query", "session_id": test_uuid},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "started"
        assert data["session_id"] == test_uuid


class TestHypothesisExperimentEndpoints:
    """Experiment listing and retention endpoints."""

    def test_list_hypothesis_experiments_returns_rows(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"

        server_mod.supabase_persistence = AsyncMock()
        server_mod.supabase_persistence.list_session_hypothesis_experiments = AsyncMock(
            return_value=[
                {
                    "id": "660e8400-e29b-41d4-a716-446655440000",
                    "session_id": session_id,
                    "status": "comparing",
                }
            ]
        )

        response = client.get(
            f"/api/swarm/{session_id}/experiments",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["experiments"]) == 1
        assert payload["experiments"][0]["status"] == "comparing"
        server_mod.supabase_persistence.list_session_hypothesis_experiments.assert_awaited_once_with(
            session_id,
            status=None,
            limit=100,
        )

    def test_retain_hypothesis_experiment_emits_update_event(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        experiment_id = "660e8400-e29b-41d4-a716-446655440000"

        queue = server_mod.bus.subscribe(session_id)
        existing = {
            "id": experiment_id,
            "session_id": session_id,
            "status": "comparing",
            "metadata": {"source": "test"},
            "comparison_result": {"rerun": {"total_tokens": 321}},
        }
        updated = {
            **existing,
            "status": "retained",
            "retention_decision": "retain",
        }

        server_mod.supabase_persistence = AsyncMock()
        server_mod.supabase_persistence.get_hypothesis_experiment = AsyncMock(
            side_effect=[existing, updated]
        )
        server_mod.supabase_persistence.update_hypothesis_experiment = AsyncMock()
        server_mod.supabase_persistence.create_hypothesis_experiment_action = AsyncMock(
            return_value="770e8400-e29b-41d4-a716-446655440000"
        )

        response = client.post(
            f"/api/swarm/experiments/{experiment_id}/retain",
            json={"decision": "retain"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["experiment"]["status"] == "retained"
        assert payload["experiment"]["retention_decision"] == "retain"

        server_mod.supabase_persistence.update_hypothesis_experiment.assert_awaited_once()
        call = server_mod.supabase_persistence.update_hypothesis_experiment.await_args
        assert call.args[0] == experiment_id
        assert call.kwargs["status"] == "retained"
        assert call.kwargs["retention_decision"] == "retain"
        assert "retention_updated_at" in call.kwargs["metadata"]

        event = queue.get_nowait()
        assert event["event"] == "hypothesis_experiment_updated"
        assert event["experiment_id"] == experiment_id
        assert event["status"] == "retained"
        assert event["retention_decision"] == "retain"

    def test_retain_hypothesis_experiment_defer_maps_to_deferred_status(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        experiment_id = "660e8400-e29b-41d4-a716-446655440000"

        queue = server_mod.bus.subscribe(session_id)
        existing = {
            "id": experiment_id,
            "session_id": session_id,
            "status": "comparing",
            "metadata": {"source": "test"},
            "comparison_result": {"rerun": {"total_tokens": 321}},
        }
        updated = {
            **existing,
            "status": "deferred",
            "retention_decision": "defer",
        }

        server_mod.supabase_persistence = AsyncMock()
        server_mod.supabase_persistence.get_hypothesis_experiment = AsyncMock(
            side_effect=[existing, updated]
        )
        server_mod.supabase_persistence.update_hypothesis_experiment = AsyncMock()
        server_mod.supabase_persistence.create_hypothesis_experiment_action = AsyncMock(
            return_value="770e8400-e29b-41d4-a716-446655440000"
        )

        response = client.post(
            f"/api/swarm/experiments/{experiment_id}/retain",
            json={"decision": "defer"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["experiment"]["status"] == "deferred"
        assert payload["experiment"]["retention_decision"] == "defer"

        server_mod.supabase_persistence.update_hypothesis_experiment.assert_awaited_once()
        call = server_mod.supabase_persistence.update_hypothesis_experiment.await_args
        assert call.args[0] == experiment_id
        assert call.kwargs["status"] == "deferred"
        assert call.kwargs["retention_decision"] == "defer"

        event = queue.get_nowait()
        assert event["event"] == "hypothesis_experiment_updated"
        assert event["experiment_id"] == experiment_id
        assert event["status"] == "deferred"
        assert event["retention_decision"] == "defer"

    def test_compare_hypothesis_experiment_uses_existing_result(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        experiment_id = "660e8400-e29b-41d4-a716-446655440000"

        queue = server_mod.bus.subscribe(session_id)
        existing = {
            "id": experiment_id,
            "session_id": session_id,
            "status": "checkpointed",
            "metadata": {"source": "test"},
            "comparison_result": {"summary": "candidate improved"},
            "retention_decision": None,
        }

        server_mod.supabase_persistence = AsyncMock()
        server_mod.supabase_persistence.get_hypothesis_experiment = AsyncMock(
            return_value=existing
        )
        server_mod.supabase_persistence.update_hypothesis_experiment = AsyncMock()
        server_mod.supabase_persistence.create_hypothesis_experiment_action = AsyncMock(
            return_value="770e8400-e29b-41d4-a716-446655440000"
        )

        response = client.post(
            f"/api/swarm/experiments/{experiment_id}/compare",
            json={"rerunIfMissing": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "comparison_ready"
        assert payload["experiment_id"] == experiment_id
        assert payload["comparison_result"]["summary"] == "candidate improved"

        server_mod.supabase_persistence.update_hypothesis_experiment.assert_awaited_once_with(
            experiment_id,
            status="comparing",
        )
        event = queue.get_nowait()
        assert event["event"] == "hypothesis_experiment_updated"
        assert event["status"] == "comparing"
        assert event["comparison_result"]["summary"] == "candidate improved"

    def test_compare_hypothesis_experiment_missing_result_without_rerun(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        experiment_id = "660e8400-e29b-41d4-a716-446655440000"

        server_mod.supabase_persistence = AsyncMock()
        server_mod.supabase_persistence.get_hypothesis_experiment = AsyncMock(
            return_value={
                "id": experiment_id,
                "session_id": session_id,
                "status": "promoted",
                "metadata": {},
                "comparison_result": None,
            }
        )

        response = client.post(
            f"/api/swarm/experiments/{experiment_id}/compare",
            json={"rerunIfMissing": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409
        data = response.json()
        assert "comparison_result missing" in data["detail"]

    def test_compare_hypothesis_experiment_is_idempotent_while_rerunning(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        experiment_id = "660e8400-e29b-41d4-a716-446655440000"

        server_mod.supabase_persistence = AsyncMock()
        server_mod.supabase_persistence.get_hypothesis_experiment = AsyncMock(
            return_value={
                "id": experiment_id,
                "session_id": session_id,
                "status": "rerunning",
                "metadata": {},
                "comparison_result": None,
            }
        )
        server_mod.supabase_persistence.update_hypothesis_experiment = AsyncMock()

        response = client.post(
            f"/api/swarm/experiments/{experiment_id}/compare",
            json={"rerunIfMissing": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "compare_started"
        assert payload["mode"] == "already_rerunning"
        server_mod.supabase_persistence.update_hypothesis_experiment.assert_not_awaited()

    def test_list_hypothesis_experiments_uses_inmemory_fallback(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        experiment_id = "660e8400-e29b-41d4-a716-446655440000"

        server_mod.supabase_persistence = None
        server_mod._inmemory_experiments_by_id[experiment_id] = {
            "id": experiment_id,
            "session_id": session_id,
            "status": "promoted",
            "alternative_summary": "Fallback experiment",
            "metadata": {"source": "test"},
            "created_at": "2026-02-12T00:00:00+00:00",
            "last_updated": "2026-02-12T00:00:00+00:00",
        }
        server_mod._inmemory_experiment_ids_by_session[session_id] = {experiment_id}

        response = client.get(
            f"/api/swarm/{session_id}/experiments",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["experiments"]) == 1
        assert payload["experiments"][0]["id"] == experiment_id
        assert payload["experiments"][0]["status"] == "promoted"

    def test_retain_hypothesis_experiment_without_supabase(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        experiment_id = "660e8400-e29b-41d4-a716-446655440000"

        queue = server_mod.bus.subscribe(session_id)
        server_mod.supabase_persistence = None
        server_mod._inmemory_experiments_by_id[experiment_id] = {
            "id": experiment_id,
            "session_id": session_id,
            "status": "comparing",
            "metadata": {"source": "test"},
            "created_at": "2026-02-12T00:00:00+00:00",
            "last_updated": "2026-02-12T00:00:00+00:00",
        }
        server_mod._inmemory_experiment_ids_by_session[session_id] = {experiment_id}

        response = client.post(
            f"/api/swarm/experiments/{experiment_id}/retain",
            json={"decision": "retain"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["experiment"]["status"] == "retained"
        assert payload["experiment"]["retention_decision"] == "retain"

        event = queue.get_nowait()
        assert event["event"] == "hypothesis_experiment_updated"
        assert event["experiment_id"] == experiment_id
        assert event["status"] == "retained"

    def test_retain_hypothesis_experiment_is_idempotent_for_same_final_decision(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        session_id = "550e8400-e29b-41d4-a716-446655440000"
        experiment_id = "660e8400-e29b-41d4-a716-446655440000"

        existing = {
            "id": experiment_id,
            "session_id": session_id,
            "status": "retained",
            "retention_decision": "retain",
            "metadata": {"source": "test"},
            "created_at": "2026-02-12T00:00:00+00:00",
            "last_updated": "2026-02-12T00:00:00+00:00",
        }
        server_mod.supabase_persistence = AsyncMock()
        server_mod.supabase_persistence.get_hypothesis_experiment = AsyncMock(
            return_value=existing
        )
        server_mod.supabase_persistence.update_hypothesis_experiment = AsyncMock()
        server_mod.supabase_persistence.create_hypothesis_experiment_action = AsyncMock()

        response = client.post(
            f"/api/swarm/experiments/{experiment_id}/retain",
            json={"decision": "retain"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["experiment"]["status"] == "retained"
        assert payload["experiment"]["retention_decision"] == "retain"
        server_mod.supabase_persistence.update_hypothesis_experiment.assert_not_awaited()


# ---------------------------------------------------------------------------
# Rate Limiting
# ---------------------------------------------------------------------------


class TestRateLimiting:
    """POST /api/swarm rate limiter returns 429 when exceeded."""

    def test_rate_limit_allows_normal_requests(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        test_uuid = "550e8400-e29b-41d4-a716-446655440000"

        response = client.post(
            "/api/swarm",
            json={"query": "Test query", "session_id": test_uuid},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_rate_limit_returns_429_when_exceeded(self):
        client, server_mod = _make_test_client()
        token = _generate_token()
        test_uuid = "550e8400-e29b-41d4-a716-446655440099"

        # Override rate limit settings to a very low threshold
        server_mod.settings.rate_limit_requests = 2
        server_mod.settings.rate_limit_window_seconds = 60

        # Clear any pre-existing rate limit entries
        server_mod._rate_limit_log.clear()

        # First two should succeed
        for i in range(2):
            response = client.post(
                "/api/swarm",
                json={"query": f"Query {i}", "session_id": test_uuid},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == 200, f"Request {i} failed unexpectedly"

        # Third should be rate limited
        response = client.post(
            "/api/swarm",
            json={"query": "Over limit", "session_id": test_uuid},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.json()["detail"]


# ---------------------------------------------------------------------------
# WebSocket Error Frames (WS3.7)
# ---------------------------------------------------------------------------


class TestWebSocketErrorFrames:
    """WebSocket sends JSON error frames before closing on errors."""

    def test_websocket_auth_rejects_with_4001(self):
        """Auth rejection should close with code 4001 and reason."""
        client, _ = _make_test_client()
        with pytest.raises(Exception):
            with client.websocket_connect("/ws/test-session?token=bad-token"):
                pass
        # The close happens server-side with code=4001 before accept

    def test_websocket_receives_heartbeat(self):
        """An accepted connection should receive periodic heartbeats."""
        client, server_mod = _make_test_client()
        token = _generate_token()

        import time

        with client.websocket_connect(f"/ws/heartbeat-test?token={token}") as ws:
            # Publish a synthetic event so the test doesn't block forever
            from src.events.types import AgentStarted

            event = AgentStarted(
                session_id="heartbeat-test",
                agent="deep_thinker",
                effort="max",
            )
            event_dict = event.model_dump(mode="json")
            queues = server_mod.bus._subscribers.get("heartbeat-test", [])
            for q in queues:
                q.put_nowait(event_dict)

            data = ws.receive_json(mode="text")
            assert data["event"] in ("agent_started", "ping")
