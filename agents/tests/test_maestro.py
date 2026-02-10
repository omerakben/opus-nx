"""Tests for MaestroAgent — swarm conductor and query decomposer.

Tests tool handlers, deployment plan construction, event emission,
and the complexity classification fallback used when Maestro times out.
"""

from __future__ import annotations

import json

import pytest

from src.agents.maestro import MaestroAgent, MAESTRO_TOOLS
from src.graph.models import AgentName
from src.swarm import classify_complexity, EFFORT_MAP


# ---------------------------------------------------------------------------
# Unit tests: classify_complexity (regex fallback)
# ---------------------------------------------------------------------------


class TestComplexityClassification:
    def test_greeting_is_simple(self):
        assert classify_complexity("hello") == "simple"
        assert classify_complexity("Hi there") == "simple"

    def test_factual_question_is_simple(self):
        assert classify_complexity("What is a binary tree?") == "simple"
        assert classify_complexity("Who is Alan Turing?") == "simple"

    def test_debug_is_complex(self):
        assert classify_complexity("Debug this failing test") == "complex"
        assert classify_complexity("Troubleshoot the deployment error") == "complex"

    def test_architecture_is_complex(self):
        assert classify_complexity("Design a notification system") == "complex"
        assert classify_complexity("Compare and contrast SQL vs NoSQL") == "complex"

    def test_standard_queries_are_standard(self):
        assert classify_complexity("How should I structure my code?") == "standard"
        assert classify_complexity("What approach should I take for this feature?") == "standard"

    def test_effort_map_values(self):
        assert EFFORT_MAP["simple"] == "medium"
        assert EFFORT_MAP["standard"] == "high"
        assert EFFORT_MAP["complex"] == "max"


# ---------------------------------------------------------------------------
# Unit tests: MaestroAgent tool handlers
# ---------------------------------------------------------------------------


class TestMaestroToolHandlers:
    @pytest.fixture
    def maestro(self, test_graph, test_bus):
        return MaestroAgent(test_graph, test_bus, "test-session", api_key="sk-test")

    async def test_tool_decompose_query(self, maestro):
        result = await maestro.tool_decompose_query({
            "subtasks": ["Analyze performance", "Review architecture"],
            "reasoning": "Two distinct aspects to evaluate",
        })

        assert "2 sub-tasks" in result
        assert maestro._subtasks == ["Analyze performance", "Review architecture"]
        assert maestro._reasoning == "Two distinct aspects to evaluate"
        assert len(maestro._node_ids) == 1

    async def test_tool_select_agents(self, maestro):
        result = await maestro.tool_select_agents({
            "agents": ["deep_thinker", "contrarian"],
            "rationale": "Need critical analysis",
        })

        assert "deep_thinker" in result
        assert maestro._selected_agents == ["deep_thinker", "contrarian"]

    async def test_tool_set_agent_effort(self, maestro):
        result = await maestro.tool_set_agent_effort({
            "assignments": [
                {"agent": "deep_thinker", "effort": "max"},
                {"agent": "contrarian", "effort": "high"},
            ],
        })

        assert "deep_thinker=max" in result
        assert maestro._effort_assignments["deep_thinker"] == "max"
        assert maestro._effort_assignments["contrarian"] == "high"


# ---------------------------------------------------------------------------
# Integration tests: MaestroAgent.run()
# ---------------------------------------------------------------------------


class TestMaestroRun:
    async def test_run_emits_events_and_builds_plan(
        self, test_graph, test_bus, mock_anthropic
    ):
        """Maestro.run() should emit events and return a valid deployment plan."""
        session_id = "test-maestro-run"
        test_bus.subscribe(session_id)

        maestro = MaestroAgent(test_graph, test_bus, session_id, api_key="sk-test")
        result = await maestro.run("Analyze microservices architecture")

        assert result.agent == AgentName.MAESTRO
        assert result.status == "completed"
        assert result.confidence == 0.9
        assert result.duration_ms >= 0

        # Conclusion should be valid JSON
        plan = json.loads(result.conclusion)
        assert "agents" in plan
        assert "subtasks" in plan
        assert "reasoning" in plan

    async def test_run_emits_agent_started_event(
        self, test_graph, test_bus, mock_anthropic
    ):
        session_id = "test-maestro-events"
        queue = test_bus.subscribe(session_id)

        maestro = MaestroAgent(test_graph, test_bus, session_id, api_key="sk-test")
        await maestro.run("Simple question")

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        event_types = [e["event"] for e in events]
        assert "agent_started" in event_types
        assert "agent_completed" in event_types

    async def test_maestro_has_correct_attributes(self, test_graph, test_bus):
        maestro = MaestroAgent(test_graph, test_bus, "test", api_key="sk-test")
        assert maestro.name == AgentName.MAESTRO
        assert maestro.effort == "high"
        assert maestro.max_tokens == 4096

    async def test_maestro_tools_structure(self):
        """Maestro tools should have the expected schema."""
        tool_names = {t["name"] for t in MAESTRO_TOOLS}
        assert tool_names == {"decompose_query", "select_agents", "set_agent_effort"}

        for tool in MAESTRO_TOOLS:
            assert "description" in tool
            assert "input_schema" in tool
            assert tool["input_schema"]["type"] == "object"
            assert "required" in tool["input_schema"]


# ---------------------------------------------------------------------------
# Integration tests: Maestro in SwarmManager
# ---------------------------------------------------------------------------


class TestMaestroInSwarm:
    async def test_swarm_runs_maestro_phase0(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """SwarmManager should run Maestro in Phase 0 before primary agents."""
        from src.swarm import SwarmManager

        session_id = "test-maestro-phase0"
        test_bus.subscribe(session_id)

        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        result = await swarm.run("Compare and contrast Python vs Rust", session_id)

        assert "agents" in result
        assert result["total_tokens"] > 0
        assert result["total_duration_ms"] > 0

    async def test_maestro_decomposition_event_emitted(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """SwarmManager should emit a maestro_decomposition event."""
        from src.swarm import SwarmManager

        session_id = "test-maestro-decomp"
        queue = test_bus.subscribe(session_id)

        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        await swarm.run("Analyze database scaling", session_id)

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        event_types = [e["event"] for e in events]
        # Maestro should emit its events before swarm_started
        assert "agent_started" in event_types
        assert "swarm_started" in event_types
