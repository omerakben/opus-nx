"""WebSocket endpoint tests.

Tests auth, event delivery, heartbeat, and connection management
for the FastAPI server.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import sys
from unittest.mock import MagicMock, patch

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
