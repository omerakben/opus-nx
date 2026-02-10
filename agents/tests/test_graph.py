"""Tests for SharedReasoningGraph."""

import pytest

from src.graph.models import (
    AgentName,
    EdgeRelation,
    ReasoningEdge,
    ReasoningNode,
)
from src.graph.reasoning_graph import SharedReasoningGraph


@pytest.fixture
def graph():
    return SharedReasoningGraph()


def _make_node(agent: AgentName = AgentName.DEEP_THINKER, session_id: str = "test-session") -> ReasoningNode:
    return ReasoningNode(
        agent=agent,
        session_id=session_id,
        content="Test reasoning content",
        reasoning="analysis",
        confidence=0.85,
    )


class TestSharedReasoningGraph:
    @pytest.mark.asyncio
    async def test_add_and_get_node(self, graph):
        node = _make_node()
        node_id = await graph.add_node(node)

        fetched = await graph.get_node(node_id)
        assert fetched is not None
        assert fetched["content"] == "Test reasoning content"
        assert fetched["confidence"] == 0.85
        assert fetched["agent"] == "deep_thinker"

    @pytest.mark.asyncio
    async def test_get_nonexistent_node(self, graph):
        result = await graph.get_node("does-not-exist")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_nodes_by_agent(self, graph):
        await graph.add_node(_make_node(AgentName.DEEP_THINKER))
        await graph.add_node(_make_node(AgentName.DEEP_THINKER))
        await graph.add_node(_make_node(AgentName.CONTRARIAN))

        dt_nodes = await graph.get_nodes_by_agent(AgentName.DEEP_THINKER)
        assert len(dt_nodes) == 2

        con_nodes = await graph.get_nodes_by_agent(AgentName.CONTRARIAN)
        assert len(con_nodes) == 1

    @pytest.mark.asyncio
    async def test_get_session_nodes(self, graph):
        await graph.add_node(_make_node(session_id="session-a"))
        await graph.add_node(_make_node(session_id="session-a"))
        await graph.add_node(_make_node(session_id="session-b"))

        nodes_a = await graph.get_session_nodes("session-a")
        assert len(nodes_a) == 2

        nodes_b = await graph.get_session_nodes("session-b")
        assert len(nodes_b) == 1

    @pytest.mark.asyncio
    async def test_add_edge(self, graph):
        n1 = _make_node()
        n2 = _make_node()
        id1 = await graph.add_node(n1)
        id2 = await graph.add_node(n2)

        edge = ReasoningEdge(
            source_id=id1,
            target_id=id2,
            relation=EdgeRelation.LEADS_TO,
            weight=0.9,
        )
        await graph.add_edge(edge)

        # Verify edge exists via graph export
        export = graph.to_json()
        assert len(export.get("edges", [])) == 1

    @pytest.mark.asyncio
    async def test_get_challenges_for(self, graph):
        target = _make_node(AgentName.DEEP_THINKER)
        target_id = await graph.add_node(target)

        challenger = _make_node(AgentName.CONTRARIAN)
        challenger_id = await graph.add_node(challenger)

        edge = ReasoningEdge(
            source_id=challenger_id,
            target_id=target_id,
            relation=EdgeRelation.CHALLENGES,
            weight=0.8,
        )
        await graph.add_edge(edge)

        challenges = await graph.get_challenges_for(target_id)
        assert len(challenges) == 1
        assert challenges[0]["source_node"]["agent"] == "contrarian"

    @pytest.mark.asyncio
    async def test_get_verifications_for(self, graph):
        target = _make_node(AgentName.DEEP_THINKER)
        target_id = await graph.add_node(target)

        verifier = _make_node(AgentName.VERIFIER)
        verifier_id = await graph.add_node(verifier)

        edge = ReasoningEdge(
            source_id=verifier_id,
            target_id=target_id,
            relation=EdgeRelation.VERIFIES,
            weight=0.9,
        )
        await graph.add_edge(edge)

        verifications = await graph.get_verifications_for(target_id)
        assert len(verifications) == 1
        assert verifications[0]["source_node"]["agent"] == "verifier"

    @pytest.mark.asyncio
    async def test_challenges_returns_empty_for_unknown_node(self, graph):
        challenges = await graph.get_challenges_for("unknown-id")
        assert challenges == []

    @pytest.mark.asyncio
    async def test_to_json(self, graph):
        await graph.add_node(_make_node())
        export = graph.to_json()
        assert "nodes" in export

    @pytest.mark.asyncio
    async def test_listener_notification(self, graph):
        events: list[tuple] = []

        async def listener(event_type, data):
            events.append((event_type, data))

        graph.on_change(listener)
        await graph.add_node(_make_node())

        assert len(events) == 1
        assert events[0][0] == "node_added"
