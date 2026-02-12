"""Tests for SynthesizerAgent — graph reading, synthesis writing, and MERGES edges.

Tests the tool handlers for reading conclusions (grouped by agent with
challenge/verification annotations) and writing synthesis (with convergence/
divergence tracking and MERGES edge creation).
"""

from __future__ import annotations

import pytest

from src.agents.synthesizer import SynthesizerAgent, SYNTHESIZER_TOOLS
from src.graph.models import AgentName, EdgeRelation, ReasoningEdge, ReasoningNode


# ---------------------------------------------------------------------------
# Tool schema validation
# ---------------------------------------------------------------------------


class TestSynthesizerToolSchemas:
    def test_tool_names(self):
        names = {t["name"] for t in SYNTHESIZER_TOOLS}
        assert names == {"read_all_conclusions", "write_synthesis"}

    def test_write_synthesis_required_fields(self):
        tool = next(t for t in SYNTHESIZER_TOOLS if t["name"] == "write_synthesis")
        required = tool["input_schema"]["required"]
        assert "synthesis" in required
        assert "confidence" in required
        assert "convergence_points" in required
        assert "divergence_points" in required


# ---------------------------------------------------------------------------
# Agent configuration
# ---------------------------------------------------------------------------


class TestSynthesizerConfig:
    def test_agent_name(self, test_graph, test_bus):
        agent = SynthesizerAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent.name == AgentName.SYNTHESIZER

    def test_effort_is_high(self, test_graph, test_bus):
        agent = SynthesizerAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent.effort == "high"


# ---------------------------------------------------------------------------
# Tool handler unit tests
# ---------------------------------------------------------------------------


class TestSynthesizerToolHandlers:
    @pytest.fixture
    def agent(self, test_graph, test_bus):
        return SynthesizerAgent(test_graph, test_bus, "test-session", api_key="sk-test")

    @pytest.mark.asyncio
    async def test_read_all_conclusions_empty(self, agent):
        result = await agent.tool_read_all_conclusions({})
        assert "No reasoning nodes" in result

    @pytest.mark.asyncio
    async def test_read_all_conclusions_groups_by_agent(self, agent, test_graph):
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Deep analysis result.",
            reasoning="analysis",
            confidence=0.9,
        ))
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="Challenge to the analysis.",
            reasoning="challenge",
            confidence=0.7,
        ))

        result = await agent.tool_read_all_conclusions({})
        assert "DEEP_THINKER" in result or "deep_thinker" in result
        assert "CONTRARIAN" in result or "contrarian" in result
        assert "Deep analysis" in result
        assert "Challenge" in result

    @pytest.mark.asyncio
    async def test_read_all_conclusions_shows_challenges(self, agent, test_graph):
        # Create target and challenge nodes with CHALLENGES edge
        target_id = await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Original claim.",
            reasoning="claim",
            confidence=0.85,
        ))
        challenge_id = await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="This claim is flawed.",
            reasoning="challenge",
            confidence=0.6,
        ))
        await test_graph.add_edge(ReasoningEdge(
            source_id=challenge_id,
            target_id=target_id,
            relation=EdgeRelation.CHALLENGES,
            weight=0.7,
            metadata={"severity": "major"},
        ))

        result = await agent.tool_read_all_conclusions({})
        assert "CHALLENGED" in result

    @pytest.mark.asyncio
    async def test_read_all_conclusions_shows_verifications(self, agent, test_graph):
        target_id = await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Sound reasoning.",
            reasoning="analysis",
            confidence=0.9,
        ))
        v_id = await test_graph.add_node(ReasoningNode(
            agent=AgentName.VERIFIER,
            session_id="test-session",
            content="Verified as correct.",
            reasoning="verification",
            confidence=0.95,
        ))
        await test_graph.add_edge(ReasoningEdge(
            source_id=v_id,
            target_id=target_id,
            relation=EdgeRelation.VERIFIES,
            weight=0.95,
        ))

        result = await agent.tool_read_all_conclusions({})
        assert "VERIFIED" in result

    @pytest.mark.asyncio
    async def test_write_synthesis_creates_node_and_edges(self, agent, test_graph):
        # Populate graph with nodes from two agents
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Deep insight.",
            reasoning="analysis",
            confidence=0.9,
        ))
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="Valid challenge.",
            reasoning="challenge",
            confidence=0.7,
        ))

        result = await agent.tool_write_synthesis({
            "synthesis": "Both perspectives have merit. The original analysis is strong but the challenge highlights a blind spot.",
            "confidence": 0.82,
            "convergence_points": ["Problem identification is correct"],
            "divergence_points": ["Solution approach differs"],
        })

        assert "Synthesis" in result
        assert "0.82" in result
        assert agent._synthesis_text != ""
        assert agent._synthesis_confidence == 0.82
        # Should have created MERGES edges to both agents' best nodes
        assert "merged from 2 agents" in result

    @pytest.mark.asyncio
    async def test_write_synthesis_skips_own_nodes(self, agent, test_graph):
        """Synthesis should not create MERGES edges to its own nodes."""
        # Only synthesizer nodes in graph
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.SYNTHESIZER,
            session_id="test-session",
            content="Previous synthesis.",
            reasoning="synthesis",
            confidence=0.7,
        ))

        result = await agent.tool_write_synthesis({
            "synthesis": "Updated synthesis.",
            "confidence": 0.75,
            "convergence_points": [],
            "divergence_points": [],
        })

        assert "merged from 0 agents" in result

    @pytest.mark.asyncio
    async def test_write_synthesis_emits_events(self, agent, test_graph, test_bus):
        queue = test_bus.subscribe("test-session")

        await agent.tool_write_synthesis({
            "synthesis": "Final answer.",
            "confidence": 0.8,
            "convergence_points": ["Agreement point"],
            "divergence_points": [],
        })

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())
        event_types = [e["event"] for e in events]
        assert "graph_node_created" in event_types
        assert "synthesis_ready" in event_types


# ---------------------------------------------------------------------------
# Integration test
# ---------------------------------------------------------------------------


class TestSynthesizerRun:
    @pytest.mark.asyncio
    async def test_run_returns_valid_result(self, test_graph, test_bus, mock_anthropic):
        session_id = "test-synth-run"
        queue = test_bus.subscribe(session_id)
        agent = SynthesizerAgent(test_graph, test_bus, session_id, api_key="sk-test")
        result = await agent.run("Synthesize all perspectives on this topic")

        assert result.agent == AgentName.SYNTHESIZER
        assert result.status == "completed"
        assert result.duration_ms >= 0

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())
        event_types = [e["event"] for e in events]
        assert "agent_started" in event_types
        assert "agent_completed" in event_types
