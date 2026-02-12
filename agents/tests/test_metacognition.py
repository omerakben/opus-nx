"""Tests for MetacognitionAgent — swarm psychologist tool handlers.

Tests observation of swarm state, insight writing, multi-turn follow-up
logic, groupthink detection, and OBSERVES edge creation.
"""

from __future__ import annotations

import pytest

from src.agents.metacognition import (
    FOCUS_AREAS,
    INSIGHT_TYPES,
    METACOGNITION_TOOLS,
    MetacognitionAgent,
)
from src.graph.models import AgentName, EdgeRelation, ReasoningNode


# ---------------------------------------------------------------------------
# Tool schema validation
# ---------------------------------------------------------------------------


class TestMetacognitionToolSchemas:
    def test_tool_names(self):
        names = {t["name"] for t in METACOGNITION_TOOLS}
        assert names == {"observe_swarm_state", "write_insight"}

    def test_write_insight_required_fields(self):
        tool = next(t for t in METACOGNITION_TOOLS if t["name"] == "write_insight")
        required = tool["input_schema"]["required"]
        assert "insight_type" in required
        assert "description" in required
        assert "affected_agents" in required
        assert "confidence" in required

    def test_insight_type_enum(self):
        tool = next(t for t in METACOGNITION_TOOLS if t["name"] == "write_insight")
        enum_values = set(tool["input_schema"]["properties"]["insight_type"]["enum"])
        assert "swarm_bias" in enum_values
        assert "bias_detection" in enum_values
        assert "pattern" in enum_values
        assert "improvement_hypothesis" in enum_values


# ---------------------------------------------------------------------------
# Agent configuration
# ---------------------------------------------------------------------------


class TestMetacognitionConfig:
    def test_agent_name(self, test_graph, test_bus):
        agent = MetacognitionAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent.name == AgentName.METACOGNITION

    def test_effort_is_max(self, test_graph, test_bus):
        """Metacognition uses the full 50k thinking budget."""
        agent = MetacognitionAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent.effort == "max"

    def test_focus_areas_defined(self):
        assert len(FOCUS_AREAS) == 5
        assert "bias_detection" in FOCUS_AREAS
        assert "reasoning_quality" in FOCUS_AREAS

    def test_insight_types_for_follow_up(self):
        assert INSIGHT_TYPES == {"bias_detection", "pattern", "improvement_hypothesis"}


# ---------------------------------------------------------------------------
# Tool handler unit tests
# ---------------------------------------------------------------------------


class TestMetacognitionToolHandlers:
    @pytest.fixture
    def agent(self, test_graph, test_bus):
        return MetacognitionAgent(test_graph, test_bus, "test-session", api_key="sk-test")

    @pytest.mark.asyncio
    async def test_observe_swarm_state_empty(self, agent):
        result = await agent.tool_observe_swarm_state({})
        assert "No nodes" in result

    @pytest.mark.asyncio
    async def test_observe_swarm_state_with_nodes(self, agent, test_graph):
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Analysis of the problem.",
            reasoning="analysis",
            confidence=0.85,
        ))
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="CHALLENGE: Assumption is weak.",
            reasoning="challenge",
            confidence=0.6,
        ))

        result = await agent.tool_observe_swarm_state({})
        assert "SWARM STATE" in result
        assert "DEEP_THINKER" in result
        assert "CONTRARIAN" in result
        assert "2 total nodes" in result
        assert "FOCUS AREAS" in result

    @pytest.mark.asyncio
    async def test_write_insight_creates_node(self, agent, test_graph):
        result = await agent.tool_write_insight({
            "insight_type": "bias_detection",
            "description": "The swarm shows anchoring bias — over-relying on the first analysis.",
            "affected_agents": ["deep_thinker", "synthesizer"],
            "confidence": 0.75,
        })

        assert "Insight recorded" in result
        assert len(agent._insights) == 1
        assert agent._insights[0]["insight_type"] == "bias_detection"

        # Should have created a metacognition node
        nodes = await test_graph.get_nodes_by_agent(AgentName.METACOGNITION)
        assert len(nodes) == 1
        assert "bias_detection" in nodes[0]["content"]

    @pytest.mark.asyncio
    async def test_write_insight_with_evidence_creates_edges(self, agent, test_graph):
        # Create evidence nodes
        ev1_id = await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Evidence node 1.",
            reasoning="analysis",
            confidence=0.8,
        ))
        ev2_id = await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="Evidence node 2.",
            reasoning="challenge",
            confidence=0.6,
        ))

        await agent.tool_write_insight({
            "insight_type": "pattern",
            "description": "Productive tension between agents.",
            "affected_agents": ["deep_thinker", "contrarian"],
            "confidence": 0.8,
            "evidence_node_ids": [ev1_id, ev2_id],
        })

        # Should have created OBSERVES edges to evidence
        assert test_graph.edge_count == 2

    @pytest.mark.asyncio
    async def test_write_insight_emits_event(self, agent, test_bus):
        queue = test_bus.subscribe("test-session")

        await agent.tool_write_insight({
            "insight_type": "improvement_hypothesis",
            "description": "Consider more alternatives at decision points.",
            "affected_agents": ["deep_thinker"],
            "confidence": 0.65,
        })

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())
        event_types = [e["event"] for e in events]
        assert "metacognition_insight" in event_types

    @pytest.mark.asyncio
    async def test_write_insight_increments_counter(self, agent):
        for insight_type in ["bias_detection", "pattern", "improvement_hypothesis"]:
            await agent.tool_write_insight({
                "insight_type": insight_type,
                "description": f"Test insight: {insight_type}",
                "affected_agents": ["deep_thinker"],
                "confidence": 0.7,
            })

        assert len(agent._insights) == 3


# ---------------------------------------------------------------------------
# Multi-turn follow-up logic
# ---------------------------------------------------------------------------


class TestMultiTurnFollowUp:
    @pytest.fixture
    def agent(self, test_graph, test_bus):
        return MetacognitionAgent(test_graph, test_bus, "test-session", api_key="sk-test")

    def test_find_missing_types_all_missing(self, agent):
        missing = agent._find_missing_insight_types()
        assert missing == INSIGHT_TYPES

    def test_find_missing_types_some_produced(self, agent):
        agent._insights.append({"insight_type": "bias_detection"})
        missing = agent._find_missing_insight_types()
        assert "bias_detection" not in missing
        assert "pattern" in missing
        assert "improvement_hypothesis" in missing

    def test_find_missing_types_all_produced(self, agent):
        for t in INSIGHT_TYPES:
            agent._insights.append({"insight_type": t})
        missing = agent._find_missing_insight_types()
        assert len(missing) == 0

    def test_build_follow_up_prompt(self, agent):
        prompt = agent._build_follow_up_prompt({"bias_detection", "pattern"})
        assert "BIAS DETECTION" in prompt
        assert "PATTERN RECOGNITION" in prompt
        assert "observe_swarm_state" in prompt

    def test_build_follow_up_prompt_improvement(self, agent):
        prompt = agent._build_follow_up_prompt({"improvement_hypothesis"})
        assert "IMPROVEMENT HYPOTHESES" in prompt
        assert "testable" in prompt


# ---------------------------------------------------------------------------
# Groupthink detection
# ---------------------------------------------------------------------------


class TestGroupthinkDetection:
    @pytest.fixture
    def agent(self, test_graph, test_bus):
        return MetacognitionAgent(test_graph, test_bus, "test-session", api_key="sk-test")

    @pytest.mark.asyncio
    async def test_detects_groupthink_when_no_challenges(self, agent, test_graph):
        """Groupthink is flagged when contrarian only supports, never challenges."""
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Original analysis.",
            reasoning="analysis",
            confidence=0.9,
        ))
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="SUPPORTS: Reasoning is sound.",
            reasoning="support",
            confidence=0.8,
        ))

        await agent._detect_swarm_dynamics()

        assert len(agent._insights) == 1
        assert agent._insights[0]["insight_type"] == "groupthink"

    @pytest.mark.asyncio
    async def test_no_groupthink_when_challenges_exist(self, agent, test_graph):
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Original analysis.",
            reasoning="analysis",
            confidence=0.9,
        ))
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="CHALLENGE: This is flawed.",
            reasoning="challenge",
            confidence=0.6,
        ))

        await agent._detect_swarm_dynamics()

        assert len(agent._insights) == 0

    @pytest.mark.asyncio
    async def test_no_groupthink_when_graph_empty(self, agent):
        await agent._detect_swarm_dynamics()
        assert len(agent._insights) == 0

    @pytest.mark.asyncio
    async def test_groupthink_not_duplicated(self, agent, test_graph):
        """Already-flagged groupthink shouldn't be duplicated."""
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Analysis.",
            reasoning="analysis",
            confidence=0.9,
        ))
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="SUPPORTS: Good reasoning.",
            reasoning="support",
            confidence=0.8,
        ))

        # Pre-populate the groupthink insight
        agent._insights.append({"insight_type": "groupthink"})

        await agent._detect_swarm_dynamics()

        groupthink_count = sum(1 for i in agent._insights if i["insight_type"] == "groupthink")
        assert groupthink_count == 1


# ---------------------------------------------------------------------------
# Integration test
# ---------------------------------------------------------------------------


class TestMetacognitionRun:
    @pytest.mark.asyncio
    async def test_run_returns_valid_result(self, test_graph, test_bus, mock_anthropic):
        session_id = "test-meta-run"
        queue = test_bus.subscribe(session_id)
        agent = MetacognitionAgent(test_graph, test_bus, session_id, api_key="sk-test")
        result = await agent.run("Analyze the swarm's reasoning quality")

        assert result.agent == AgentName.METACOGNITION
        assert result.status == "completed"
        assert result.confidence == 0.75  # Fixed confidence for metacognition

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())
        event_types = [e["event"] for e in events]
        assert "agent_started" in event_types
        assert "agent_completed" in event_types
