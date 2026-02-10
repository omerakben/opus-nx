"""End-to-end swarm tests with mocked Claude API.

Tests the full SwarmManager pipeline: agent lifecycle, event emission,
graph construction, and result synthesis.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from src.config import Settings
from src.events.bus import EventBus
from src.events.types import SwarmStarted
from src.graph.reasoning_graph import SharedReasoningGraph
from src.swarm import SwarmManager, classify_complexity


class TestSwarmHappyPath:
    """Full pipeline with all agents completing successfully."""

    async def test_happy_path_all_agents_complete(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """All 5 agents should complete and produce a valid SwarmResult."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        session_id = "test-session-happy"

        result = await swarm.run(
            "Analyze the trade-offs of microservices vs monolith architecture",
            session_id,
        )

        # Result structure
        assert result["session_id"] == session_id
        assert result["query"] == "Analyze the trade-offs of microservices vs monolith architecture"
        assert isinstance(result["agents"], list)

        # All 5 agents should have results
        assert len(result["agents"]) == 5

        # All agents should have completed status (mock returns valid responses)
        agent_statuses = {a["agent"]: a["status"] for a in result["agents"]}
        for agent_name, status in agent_statuses.items():
            assert status == "completed", f"{agent_name} had status {status}"

        # Synthesis should be present (non-None; may be empty string from mock)
        assert result["synthesis"] is not None

        # Tokens should be accumulated from all agents
        assert result["total_tokens"] > 0

        # Duration should be tracked
        assert result["total_duration_ms"] > 0

    async def test_result_contains_all_agent_names(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Every agent name should appear in the results."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        result = await swarm.run("Debug this memory leak", "test-session-names")

        agent_names = {a["agent"] for a in result["agents"]}
        expected_names = {"deep_thinker", "contrarian", "verifier", "synthesizer", "metacognition"}
        assert agent_names == expected_names

    async def test_result_contains_metacognition_key(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Result should include the metacognition sub-object."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        result = await swarm.run("Research the best framework", "test-session-meta")

        assert "metacognition" in result
        assert result["metacognition"]["agent"] == "metacognition"

    async def test_result_contains_graph_export(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Result should contain a graph JSON export."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        result = await swarm.run("Plan the migration", "test-session-graph")

        assert "graph" in result
        assert "nodes" in result["graph"]


class TestSwarmPartialFailure:
    """Swarm should handle agent failures gracefully."""

    async def test_partial_failure_one_agent_errors(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """If one primary agent raises, the swarm still completes."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        # Patch DeepThinkerAgent.run to raise an exception.
        # _run_with_timeout in swarm.py catches Exception and wraps it
        # in an AgentResult with status="error".
        with patch(
            "src.agents.deep_thinker.DeepThinkerAgent.run",
            side_effect=RuntimeError("LLM connection failed"),
        ):
            result = await swarm.run(
                "Architect a caching strategy",
                "test-session-partial",
            )

        # Swarm still completes with all 5 agent slots
        assert len(result["agents"]) == 5

        # The failed agent should have error status
        deep_thinker_result = next(
            a for a in result["agents"] if a["agent"] == "deep_thinker"
        )
        assert deep_thinker_result["status"] == "error"
        assert "LLM connection failed" in deep_thinker_result["reasoning"]

        # Other primary agents should still have completed
        contrarian_result = next(
            a for a in result["agents"] if a["agent"] == "contrarian"
        )
        assert contrarian_result["status"] == "completed"

        # Total agents count is still 5
        assert len(result["agents"]) == 5


class TestSwarmTimeout:
    """Timeout handling for slow agents."""

    async def test_timeout_handling(
        self, test_graph, test_bus, mock_anthropic
    ):
        """An agent that exceeds the timeout should return status 'timeout'."""
        timeout_settings = Settings(
            anthropic_api_key="sk-ant-test",
            supabase_url="http://localhost:54321",
            supabase_service_role_key="test-key",
            auth_secret="test-secret",
            agent_timeout_seconds=1,  # 1 second timeout
            agent_stagger_seconds=0.0,
        )

        swarm = SwarmManager(timeout_settings, test_graph, test_bus)

        # Make DeepThinkerAgent.run sleep longer than the timeout
        async def slow_run(self_agent, query, context=None):
            await asyncio.sleep(5)  # Way longer than the 1s timeout
            return None  # Never reached

        with patch(
            "src.agents.deep_thinker.DeepThinkerAgent.run",
            slow_run,
        ):
            result = await swarm.run(
                "Step by step analysis of database design",
                "test-session-timeout",
            )

        # The slow agent should have timed out
        deep_thinker_result = next(
            a for a in result["agents"] if a["agent"] == "deep_thinker"
        )
        assert deep_thinker_result["status"] == "timeout"
        assert deep_thinker_result["confidence"] == 0.0

        # Other agents should complete (or possibly timeout/error)
        # The mock allows them to complete quickly
        contrarian_result = next(
            a for a in result["agents"] if a["agent"] == "contrarian"
        )
        assert contrarian_result["status"] == "completed"


class TestSwarmEvents:
    """Event emission during swarm execution."""

    async def test_event_sequence_ordering(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Events should be emitted in the correct lifecycle order."""
        session_id = "test-session-events"
        queue = test_bus.subscribe(session_id)
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await swarm.run(
            "Compare and contrast SQL vs NoSQL",
            session_id,
        )

        # Collect all events from the queue
        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        assert len(events) > 0, "Expected events to be emitted"

        # First event should be swarm_started
        assert events[0]["event"] == "swarm_started"
        assert events[0]["session_id"] == session_id

        # Extract event types for ordering analysis
        event_types = [e["event"] for e in events]

        # agent_started events should appear before agent_completed events
        started_indices = [i for i, t in enumerate(event_types) if t == "agent_started"]
        completed_indices = [i for i, t in enumerate(event_types) if t == "agent_completed"]

        if started_indices and completed_indices:
            assert min(started_indices) < max(completed_indices)

    async def test_swarm_started_event_has_agents_list(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """The swarm_started event should list the primary agents."""
        session_id = "test-session-started"
        queue = test_bus.subscribe(session_id)
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await swarm.run("Investigate performance issues", session_id)

        first_event = queue.get_nowait()
        assert first_event["event"] == "swarm_started"
        assert "deep_thinker" in first_event["agents"]
        assert "contrarian" in first_event["agents"]
        assert "verifier" in first_event["agents"]


class TestSwarmGraphConstruction:
    """Graph state after swarm execution."""

    async def test_graph_has_expected_structure(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """After swarm run, the graph should have a valid structure."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        session_id = "test-session-graph-check"

        await swarm.run("Design a notification system", session_id)

        # Graph export should have the expected keys
        export = test_graph.to_json()
        assert "nodes" in export

    async def test_graph_nodes_are_session_scoped(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Nodes should be scoped to their session."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await swarm.run("Query A", "session-a")
        await swarm.run("Query B", "session-b")

        nodes_a = await test_graph.get_session_nodes("session-a")
        nodes_b = await test_graph.get_session_nodes("session-b")

        # Each session's nodes should only belong to that session
        for n in nodes_a:
            assert n.get("session_id") == "session-a"
        for n in nodes_b:
            assert n.get("session_id") == "session-b"


class TestComplexityRouting:
    """Verify the classify_complexity function used by SwarmManager."""

    def test_complex_queries_get_max_effort(self):
        assert classify_complexity("debug this memory leak") == "complex"
        assert classify_complexity("architect a distributed system") == "complex"

    def test_simple_queries_get_medium_effort(self):
        assert classify_complexity("hi") == "simple"
        assert classify_complexity("What is Python?") == "simple"

    def test_standard_queries_get_high_effort(self):
        assert classify_complexity("help me build a todo app") == "standard"
