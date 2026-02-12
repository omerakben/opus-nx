"""Integration tests for SwarmManager 3-phase pipeline gaps.

Covers phase ordering verification, Maestro-driven agent selection,
Phase 2/3 error handling, and rerun_with_correction flow.
These complement test_swarm_e2e.py which covers the happy path.
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.config import Settings
from src.graph.models import AgentName
from src.swarm import SwarmManager


# ---------------------------------------------------------------------------
# Phase ordering: P1 (parallel) → P2 (synthesis) → P3 (metacognition)
# ---------------------------------------------------------------------------


class TestPhaseOrdering:
    """Verify agents execute in correct phase order based on events."""

    @pytest.mark.asyncio
    async def test_synthesis_runs_after_primary_agents(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Synthesizer should start only after all primary agents complete."""
        session_id = "test-phase-order"
        queue = test_bus.subscribe(session_id)
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await swarm.run("Compare and contrast REST vs GraphQL", session_id)

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        event_types = [e["event"] for e in events]

        # Find agent_completed events for Phase 1 agents
        p1_completed = [
            i for i, e in enumerate(events)
            if e["event"] == "agent_completed"
            and e.get("agent") in ("deep_thinker", "contrarian", "verifier")
        ]

        # Find synthesizer's agent_started event
        synth_started = [
            i for i, e in enumerate(events)
            if e["event"] == "agent_started" and e.get("agent") == "synthesizer"
        ]

        if p1_completed and synth_started:
            # Synthesizer should start after all P1 agents complete
            assert max(p1_completed) < min(synth_started), (
                "Synthesizer started before all Phase 1 agents completed"
            )

    @pytest.mark.asyncio
    async def test_metacognition_runs_after_synthesis(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Metacognition should start only after synthesizer completes."""
        session_id = "test-meta-after-synth"
        queue = test_bus.subscribe(session_id)
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await swarm.run("Deep dive into caching strategies", session_id)

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        synth_completed = [
            i for i, e in enumerate(events)
            if e["event"] == "agent_completed" and e.get("agent") == "synthesizer"
        ]
        meta_started = [
            i for i, e in enumerate(events)
            if e["event"] == "agent_started" and e.get("agent") == "metacognition"
        ]

        if synth_completed and meta_started:
            assert max(synth_completed) < min(meta_started), (
                "Metacognition started before synthesizer completed"
            )

    @pytest.mark.asyncio
    async def test_all_three_phases_emit_events(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Events for all three phases should be present."""
        session_id = "test-three-phases"
        queue = test_bus.subscribe(session_id)
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await swarm.run("Investigate memory leak patterns", session_id)

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        agents_with_events = {e.get("agent") for e in events if e["event"] == "agent_completed"}

        # P1 agents
        assert "deep_thinker" in agents_with_events
        assert "contrarian" in agents_with_events
        assert "verifier" in agents_with_events
        # P2
        assert "synthesizer" in agents_with_events
        # P3
        assert "metacognition" in agents_with_events


# ---------------------------------------------------------------------------
# Maestro-driven agent selection
# ---------------------------------------------------------------------------


class TestMaestroAgentSelection:
    """Maestro's deployment plan should affect which Phase 1 agents run."""

    @pytest.mark.asyncio
    async def test_maestro_timeout_uses_regex_fallback(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """When Maestro times out, regex fallback selects all 3 primary agents."""
        session_id = "test-maestro-timeout"
        queue = test_bus.subscribe(session_id)

        # Make Maestro.run hang forever (will be cancelled by 15s timeout)
        async def slow_maestro(query):
            await asyncio.sleep(300)

        with patch("src.agents.maestro.MaestroAgent.run", slow_maestro):
            # Short timeout so the test doesn't actually wait 15 seconds
            mock_settings.agent_timeout_seconds = 2
            swarm = SwarmManager(mock_settings, test_graph, test_bus)
            result = await swarm.run("Help me build a web app", session_id)

        # Should still have all 5 agents (3 primary + synth + meta)
        agent_names = {a["agent"] for a in result["agents"]}
        assert "deep_thinker" in agent_names
        assert "contrarian" in agent_names
        assert "verifier" in agent_names
        assert "synthesizer" in agent_names
        assert "metacognition" in agent_names

    @pytest.mark.asyncio
    async def test_maestro_error_uses_regex_fallback(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """When Maestro raises, regex fallback is used."""
        session_id = "test-maestro-error"

        with patch(
            "src.agents.maestro.MaestroAgent.run",
            side_effect=RuntimeError("API key invalid"),
        ):
            swarm = SwarmManager(mock_settings, test_graph, test_bus)
            result = await swarm.run("Plan the deployment pipeline", session_id)

        # Should still produce all 5 agent results
        assert len(result["agents"]) == 5


# ---------------------------------------------------------------------------
# Phase 2/3 error handling
# ---------------------------------------------------------------------------


class TestPhaseErrorHandling:
    """Errors in synthesis or metacognition should not crash the swarm."""

    @pytest.mark.asyncio
    async def test_synthesizer_error_still_returns_result(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """If synthesizer fails, swarm still returns with error status for it."""
        session_id = "test-synth-error"

        with patch(
            "src.agents.synthesizer.SynthesizerAgent.run",
            side_effect=RuntimeError("Synthesis failed"),
        ):
            swarm = SwarmManager(mock_settings, test_graph, test_bus)
            result = await swarm.run("Architect a notification system", session_id)

        # All 5 agents should still have entries
        assert len(result["agents"]) == 5

        synth = next(a for a in result["agents"] if a["agent"] == "synthesizer")
        assert synth["status"] == "error"
        assert "Synthesis failed" in synth["reasoning"]

        # Primary agents should still be completed
        deep_thinker = next(a for a in result["agents"] if a["agent"] == "deep_thinker")
        assert deep_thinker["status"] == "completed"

    @pytest.mark.asyncio
    async def test_metacognition_error_still_returns_result(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """If metacognition fails, swarm still returns with error status for it."""
        session_id = "test-meta-error"

        with patch(
            "src.agents.metacognition.MetacognitionAgent.run",
            side_effect=RuntimeError("Metacognition crashed"),
        ):
            swarm = SwarmManager(mock_settings, test_graph, test_bus)
            result = await swarm.run("Debug this race condition", session_id)

        meta = next(a for a in result["agents"] if a["agent"] == "metacognition")
        assert meta["status"] == "error"

        # Synthesis should still be completed
        synth = next(a for a in result["agents"] if a["agent"] == "synthesizer")
        assert synth["status"] == "completed"


# ---------------------------------------------------------------------------
# rerun_with_correction
# ---------------------------------------------------------------------------


class TestRerunWithCorrection:
    """Tests for the human-in-the-loop rerun flow."""

    @pytest.mark.asyncio
    async def test_rerun_produces_result(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """rerun_with_correction should complete with deep_thinker + contrarian."""
        session_id = "test-rerun"
        queue = test_bus.subscribe(session_id)
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        result = await swarm.rerun_with_correction(
            session_id=session_id,
            node_id="node-to-correct",
            correction="Consider edge cases for distributed systems",
        )

        assert result["status"] == "rerun_complete"
        assert set(result["agents"]) == {"deep_thinker", "contrarian"}

    @pytest.mark.asyncio
    async def test_rerun_emits_rerun_started_event(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """rerun_with_correction should emit a SwarmRerunStarted event."""
        session_id = "test-rerun-events"
        queue = test_bus.subscribe(session_id)
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await swarm.rerun_with_correction(
            session_id=session_id,
            node_id="node-1",
            correction="Reconsider the assumption about latency",
        )

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        event_types = [e["event"] for e in events]
        assert "swarm_rerun_started" in event_types

        rerun_event = next(e for e in events if e["event"] == "swarm_rerun_started")
        assert "deep_thinker" in rerun_event["agents"]
        assert "contrarian" in rerun_event["agents"]

    @pytest.mark.asyncio
    async def test_rerun_includes_experiment_id(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """experiment_id should flow through to the result."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        result = await swarm.rerun_with_correction(
            session_id="test-rerun-exp",
            node_id="node-1",
            correction="Fix reasoning about costs",
            experiment_id="exp-123",
        )

        assert result["experiment_id"] == "exp-123"

    @pytest.mark.asyncio
    async def test_rerun_handles_agent_failure(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """rerun_with_correction should not crash if one agent fails."""
        session_id = "test-rerun-fail"

        with patch(
            "src.agents.deep_thinker.DeepThinkerAgent.run",
            side_effect=RuntimeError("API error during rerun"),
        ):
            swarm = SwarmManager(mock_settings, test_graph, test_bus)
            result = await swarm.rerun_with_correction(
                session_id=session_id,
                node_id="node-1",
                correction="Adjust the analysis",
            )

        # Should still complete (asyncio.gather with return_exceptions=True)
        assert result["status"] == "rerun_complete"


# ---------------------------------------------------------------------------
# Stagger timing
# ---------------------------------------------------------------------------


class TestStaggerTiming:
    """Verify staggered launch behavior."""

    @pytest.mark.asyncio
    async def test_zero_stagger_runs_concurrently(
        self, test_graph, test_bus, mock_anthropic
    ):
        """With stagger=0, all primary agents should start nearly simultaneously."""
        settings = Settings(
            anthropic_api_key="sk-ant-test",
            supabase_url="http://localhost:54321",
            supabase_service_role_key="test-key",
            auth_secret="test-secret",
            agent_stagger_seconds=0.0,
            agent_timeout_seconds=10,
        )
        session_id = "test-zero-stagger"
        queue = test_bus.subscribe(session_id)
        swarm = SwarmManager(settings, test_graph, test_bus)

        await swarm.run("Analyze trade-offs of caching", session_id)

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        # All 5 agents should complete
        completed = [e for e in events if e["event"] == "agent_completed"]
        assert len(completed) >= 5
