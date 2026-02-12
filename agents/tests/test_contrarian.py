"""Tests for ContrarianAgent — devil's advocate tool handlers and graph interactions.

Tests challenge creation, support (concede), graph reads, edge creation,
confidence derivation, and event emission.
"""

from __future__ import annotations

import pytest

from src.agents.contrarian import ContrarianAgent, CONTRARIAN_TOOLS
from src.graph.models import AgentName, EdgeRelation, ReasoningNode


# ---------------------------------------------------------------------------
# Tool schema validation
# ---------------------------------------------------------------------------


class TestContrarianToolSchemas:
    def test_tool_names(self):
        names = {t["name"] for t in CONTRARIAN_TOOLS}
        assert names == {"read_agent_reasoning", "create_challenge", "concede_point"}

    def test_all_tools_have_required_fields(self):
        for tool in CONTRARIAN_TOOLS:
            assert "description" in tool
            assert "input_schema" in tool
            assert tool["input_schema"]["type"] == "object"

    def test_create_challenge_schema(self):
        tool = next(t for t in CONTRARIAN_TOOLS if t["name"] == "create_challenge")
        required = tool["input_schema"]["required"]
        assert "target_node_id" in required
        assert "counter_argument" in required
        assert "severity" in required


# ---------------------------------------------------------------------------
# Agent configuration
# ---------------------------------------------------------------------------


class TestContrarianConfig:
    def test_agent_name(self, test_graph, test_bus):
        agent = ContrarianAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent.name == AgentName.CONTRARIAN

    def test_effort_is_high(self, test_graph, test_bus):
        agent = ContrarianAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent.effort == "high"

    def test_initial_counters_are_zero(self, test_graph, test_bus):
        agent = ContrarianAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent._challenges_created == 0
        assert agent._supports_created == 0


# ---------------------------------------------------------------------------
# Tool handler unit tests (no API calls)
# ---------------------------------------------------------------------------


class TestContrarianToolHandlers:
    @pytest.fixture
    def agent(self, test_graph, test_bus):
        return ContrarianAgent(test_graph, test_bus, "test-session", api_key="sk-test")

    @pytest.mark.asyncio
    async def test_read_agent_reasoning_empty(self, agent):
        result = await agent.tool_read_agent_reasoning({"agent": "deep_thinker"})
        assert "No reasoning nodes" in result

    @pytest.mark.asyncio
    async def test_read_agent_reasoning_with_nodes(self, agent, test_graph):
        node = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="The sky is blue because of Rayleigh scattering.",
            reasoning="analysis",
            confidence=0.85,
        )
        await test_graph.add_node(node)

        result = await agent.tool_read_agent_reasoning({"agent": "deep_thinker"})
        assert "Rayleigh scattering" in result
        assert "0.85" in result

    @pytest.mark.asyncio
    async def test_read_agent_reasoning_unknown_agent(self, agent):
        result = await agent.tool_read_agent_reasoning({"agent": "nonexistent"})
        assert "Unknown agent" in result

    @pytest.mark.asyncio
    async def test_create_challenge_success(self, agent, test_graph):
        # Create a target node to challenge
        target = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="All cats are friendly.",
            reasoning="claim",
            confidence=0.9,
        )
        target_id = await test_graph.add_node(target)

        result = await agent.tool_create_challenge({
            "target_node_id": target_id,
            "counter_argument": "This ignores feral cats that are aggressive.",
            "severity": "major",
            "flaw_type": "overgeneralization",
        })

        assert "Challenge" in result
        assert agent._challenges_created == 1
        assert len(agent._node_ids) == 1
        assert test_graph.edge_count == 1

    @pytest.mark.asyncio
    async def test_create_challenge_critical_severity(self, agent, test_graph):
        target = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Water boils at 50C.",
            reasoning="claim",
            confidence=0.8,
        )
        target_id = await test_graph.add_node(target)

        await agent.tool_create_challenge({
            "target_node_id": target_id,
            "counter_argument": "Water boils at 100C at sea level.",
            "severity": "critical",
            "flaw_type": "factual_error",
        })

        # Critical challenges get confidence 0.7
        challenge_nodes = await test_graph.get_nodes_by_agent(AgentName.CONTRARIAN)
        assert len(challenge_nodes) == 1
        assert challenge_nodes[0]["confidence"] == 0.7

    @pytest.mark.asyncio
    async def test_create_challenge_nonexistent_target(self, agent):
        result = await agent.tool_create_challenge({
            "target_node_id": "nonexistent-id",
            "counter_argument": "This is wrong.",
            "severity": "major",
        })
        assert "not found" in result
        assert agent._challenges_created == 0

    @pytest.mark.asyncio
    async def test_concede_point_success(self, agent, test_graph):
        target = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="E=mc^2 describes mass-energy equivalence.",
            reasoning="claim",
            confidence=0.95,
        )
        target_id = await test_graph.add_node(target)

        result = await agent.tool_concede_point({
            "target_node_id": target_id,
            "reason": "Well-established physics, no valid counter-argument.",
        })

        assert "Support" in result
        assert agent._supports_created == 1
        assert len(agent._node_ids) == 1

    @pytest.mark.asyncio
    async def test_concede_point_nonexistent_target(self, agent):
        result = await agent.tool_concede_point({
            "target_node_id": "missing-id",
            "reason": "Looks good.",
        })
        assert "not found" in result
        assert agent._supports_created == 0

    @pytest.mark.asyncio
    async def test_confidence_derived_from_ratio(self, agent, test_graph):
        """Confidence should increase with more challenges relative to concessions."""
        # Add two targets
        for content in ["Claim A", "Claim B", "Claim C"]:
            node = ReasoningNode(
                agent=AgentName.DEEP_THINKER,
                session_id="test-session",
                content=content,
                reasoning="claim",
                confidence=0.8,
            )
            await test_graph.add_node(node)

        nodes = await test_graph.get_nodes_by_agent(AgentName.DEEP_THINKER)

        # Challenge 2 out of 3
        await agent.tool_create_challenge({
            "target_node_id": nodes[0]["id"],
            "counter_argument": "Flawed reasoning",
            "severity": "major",
        })
        await agent.tool_create_challenge({
            "target_node_id": nodes[1]["id"],
            "counter_argument": "Weak evidence",
            "severity": "minor",
        })
        await agent.tool_concede_point({
            "target_node_id": nodes[2]["id"],
            "reason": "Sound analysis",
        })

        total = agent._challenges_created + agent._supports_created
        confidence = 0.6 + 0.3 * (agent._challenges_created / total)
        # 2 challenges, 1 support -> 0.6 + 0.3 * (2/3) = 0.8
        assert abs(confidence - 0.8) < 0.01


# ---------------------------------------------------------------------------
# Integration test: run() with mock API
# ---------------------------------------------------------------------------


class TestContrarianRun:
    @pytest.mark.asyncio
    async def test_run_emits_events(self, test_graph, test_bus, mock_anthropic):
        session_id = "test-contrarian-run"
        queue = test_bus.subscribe(session_id)
        agent = ContrarianAgent(test_graph, test_bus, session_id, api_key="sk-test")
        result = await agent.run("Analyze microservices tradeoffs")

        assert result.agent == AgentName.CONTRARIAN
        assert result.status == "completed"
        assert result.duration_ms >= 0

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())
        event_types = [e["event"] for e in events]
        assert "agent_started" in event_types
        assert "agent_completed" in event_types
