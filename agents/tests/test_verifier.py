"""Tests for VerifierAgent — PRM step-by-step verification tool handlers.

Tests reasoning chain reads, step scoring, verification edge creation,
chain score computation, pattern detection, and summary emission.
"""

from __future__ import annotations

import pytest

from src.agents.verifier import VerifierAgent, VERIFIER_TOOLS
from src.graph.models import AgentName, EdgeRelation, ReasoningNode


# ---------------------------------------------------------------------------
# Tool schema validation
# ---------------------------------------------------------------------------


class TestVerifierToolSchemas:
    def test_tool_names(self):
        names = {t["name"] for t in VERIFIER_TOOLS}
        assert names == {"read_reasoning_chain", "verify_reasoning_step", "emit_verification"}

    def test_verify_step_schema_has_required_fields(self):
        tool = next(t for t in VERIFIER_TOOLS if t["name"] == "verify_reasoning_step")
        required = tool["input_schema"]["required"]
        assert "node_id" in required
        assert "verdict" in required
        assert "confidence" in required
        assert "explanation" in required

    def test_verdict_enum(self):
        tool = next(t for t in VERIFIER_TOOLS if t["name"] == "verify_reasoning_step")
        props = tool["input_schema"]["properties"]
        assert set(props["verdict"]["enum"]) == {"correct", "incorrect", "neutral", "uncertain"}


# ---------------------------------------------------------------------------
# Agent configuration
# ---------------------------------------------------------------------------


class TestVerifierConfig:
    def test_agent_name(self, test_graph, test_bus):
        agent = VerifierAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent.name == AgentName.VERIFIER

    def test_effort_is_high(self, test_graph, test_bus):
        agent = VerifierAgent(test_graph, test_bus, "sess", api_key="sk-test")
        assert agent.effort == "high"


# ---------------------------------------------------------------------------
# Tool handler unit tests
# ---------------------------------------------------------------------------


class TestVerifierToolHandlers:
    @pytest.fixture
    def agent(self, test_graph, test_bus):
        return VerifierAgent(test_graph, test_bus, "test-session", api_key="sk-test")

    @pytest.mark.asyncio
    async def test_read_chain_empty(self, agent):
        result = await agent.tool_read_reasoning_chain({})
        assert "No reasoning nodes" in result

    @pytest.mark.asyncio
    async def test_read_chain_by_agent_filter(self, agent, test_graph):
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Step 1: Identify the problem",
            reasoning="analysis",
            confidence=0.8,
        ))
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="Challenge: assumption is weak",
            reasoning="challenge",
            confidence=0.6,
        ))

        # Filter to deep_thinker only
        result = await agent.tool_read_reasoning_chain({"agent_filter": "deep_thinker"})
        assert "Step 1" in result
        assert "Challenge" not in result

    @pytest.mark.asyncio
    async def test_read_chain_unknown_agent(self, agent):
        result = await agent.tool_read_reasoning_chain({"agent_filter": "nonexistent"})
        assert "Unknown agent" in result

    @pytest.mark.asyncio
    async def test_read_chain_shows_all_session_nodes(self, agent, test_graph):
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Node A",
            reasoning="analysis",
            confidence=0.8,
        ))
        await test_graph.add_node(ReasoningNode(
            agent=AgentName.CONTRARIAN,
            session_id="test-session",
            content="Node B",
            reasoning="challenge",
            confidence=0.6,
        ))

        # No filter — should show all
        result = await agent.tool_read_reasoning_chain({})
        assert "Node A" in result
        assert "Node B" in result

    @pytest.mark.asyncio
    async def test_verify_step_correct(self, agent, test_graph):
        node = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="2 + 2 = 4",
            reasoning="calculation",
            confidence=0.95,
        )
        node_id = await test_graph.add_node(node)

        result = await agent.tool_verify_reasoning_step({
            "node_id": node_id,
            "verdict": "correct",
            "confidence": 0.95,
            "explanation": "Basic arithmetic verified.",
        })

        assert "correct" in result
        assert len(agent._step_scores) == 1
        assert agent._step_scores[0]["verdict"] == "correct"
        assert test_graph.edge_count == 1

    @pytest.mark.asyncio
    async def test_verify_step_incorrect_with_issues(self, agent, test_graph):
        node = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="All swans are white, therefore black swans don't exist.",
            reasoning="deduction",
            confidence=0.9,
        )
        node_id = await test_graph.add_node(node)

        issues = [
            {
                "type": "overgeneralization",
                "description": "Inductive conclusion doesn't prove universal claim.",
                "severity": "critical",
            }
        ]

        result = await agent.tool_verify_reasoning_step({
            "node_id": node_id,
            "verdict": "incorrect",
            "confidence": 0.85,
            "explanation": "Logically flawed induction.",
            "issues": issues,
        })

        assert "incorrect" in result
        assert "overgeneralization" in result
        assert agent._step_scores[0]["issues"] == issues

    @pytest.mark.asyncio
    async def test_verify_step_nonexistent_node(self, agent):
        result = await agent.tool_verify_reasoning_step({
            "node_id": "missing-id",
            "verdict": "correct",
            "confidence": 0.8,
            "explanation": "Looks fine.",
        })
        assert "not found" in result
        assert len(agent._step_scores) == 0

    @pytest.mark.asyncio
    async def test_emit_verification_builds_summary(self, agent, test_graph):
        # Create and verify two nodes
        for content, verdict, conf in [
            ("Step 1: Valid", "correct", 0.9),
            ("Step 2: Valid", "correct", 0.85),
        ]:
            nid = await test_graph.add_node(ReasoningNode(
                agent=AgentName.DEEP_THINKER,
                session_id="test-session",
                content=content,
                reasoning="step",
                confidence=0.8,
            ))
            await agent.tool_verify_reasoning_step({
                "node_id": nid,
                "verdict": verdict,
                "confidence": conf,
                "explanation": "Verified.",
            })

        result = await agent.tool_emit_verification({
            "summary": "Both steps verified as correct.",
        })

        assert "Score:" in result
        assert "Valid: True" in result
        assert "Steps: 2" in result
        assert "Errors: 0" in result

    @pytest.mark.asyncio
    async def test_emit_verification_with_errors(self, agent, test_graph):
        nid = await test_graph.add_node(ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-session",
            content="Bad step",
            reasoning="step",
            confidence=0.8,
        ))
        await agent.tool_verify_reasoning_step({
            "node_id": nid,
            "verdict": "incorrect",
            "confidence": 0.3,
            "explanation": "Fundamentally flawed.",
        })

        result = await agent.tool_emit_verification({"summary": "Chain has errors."})

        assert "Errors: 1" in result
        assert "Valid: False" in result


# ---------------------------------------------------------------------------
# Integration test
# ---------------------------------------------------------------------------


class TestVerifierRun:
    @pytest.mark.asyncio
    async def test_run_returns_valid_result(self, test_graph, test_bus, mock_anthropic):
        session_id = "test-verifier-run"
        queue = test_bus.subscribe(session_id)
        agent = VerifierAgent(test_graph, test_bus, session_id, api_key="sk-test")
        result = await agent.run("Verify this reasoning chain")

        assert result.agent == AgentName.VERIFIER
        assert result.status == "completed"
        assert 0.0 <= result.confidence <= 1.0

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())
        event_types = [e["event"] for e in events]
        assert "agent_started" in event_types
        assert "agent_completed" in event_types
