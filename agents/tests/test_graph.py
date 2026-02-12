"""Tests for SharedReasoningGraph."""

import pytest

from src.graph.models import (
    AgentName,
    EdgeRelation,
    ReasoningEdge,
    ReasoningNode,
)
from src.graph.reasoning_graph import CycleDetectedError, SharedReasoningGraph


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


class TestCycleDetection:
    @pytest.mark.asyncio
    async def test_direct_cycle_rejected(self, graph):
        """A -> B -> A should be rejected."""
        n1 = _make_node()
        n2 = _make_node()
        id1 = await graph.add_node(n1)
        id2 = await graph.add_node(n2)

        await graph.add_edge(ReasoningEdge(
            source_id=id1, target_id=id2, relation=EdgeRelation.LEADS_TO,
        ))

        with pytest.raises(CycleDetectedError):
            await graph.add_edge(ReasoningEdge(
                source_id=id2, target_id=id1, relation=EdgeRelation.LEADS_TO,
            ))

    @pytest.mark.asyncio
    async def test_transitive_cycle_rejected(self, graph):
        """A -> B -> C -> A should be rejected."""
        n1 = _make_node()
        n2 = _make_node()
        n3 = _make_node()
        id1 = await graph.add_node(n1)
        id2 = await graph.add_node(n2)
        id3 = await graph.add_node(n3)

        await graph.add_edge(ReasoningEdge(
            source_id=id1, target_id=id2, relation=EdgeRelation.LEADS_TO,
        ))
        await graph.add_edge(ReasoningEdge(
            source_id=id2, target_id=id3, relation=EdgeRelation.LEADS_TO,
        ))

        with pytest.raises(CycleDetectedError):
            await graph.add_edge(ReasoningEdge(
                source_id=id3, target_id=id1, relation=EdgeRelation.LEADS_TO,
            ))

    @pytest.mark.asyncio
    async def test_non_cyclic_edge_allowed(self, graph):
        """A -> B, A -> C, B -> C should all be fine (DAG)."""
        n1 = _make_node()
        n2 = _make_node()
        n3 = _make_node()
        id1 = await graph.add_node(n1)
        id2 = await graph.add_node(n2)
        id3 = await graph.add_node(n3)

        await graph.add_edge(ReasoningEdge(
            source_id=id1, target_id=id2, relation=EdgeRelation.LEADS_TO,
        ))
        await graph.add_edge(ReasoningEdge(
            source_id=id1, target_id=id3, relation=EdgeRelation.LEADS_TO,
        ))
        await graph.add_edge(ReasoningEdge(
            source_id=id2, target_id=id3, relation=EdgeRelation.LEADS_TO,
        ))
        assert graph.edge_count == 3

    @pytest.mark.asyncio
    async def test_edge_to_new_node_allowed(self, graph):
        """Edge involving a node not yet in the graph should not trigger cycle check."""
        n1 = _make_node()
        id1 = await graph.add_node(n1)

        await graph.add_edge(ReasoningEdge(
            source_id=id1, target_id="new-node-id", relation=EdgeRelation.LEADS_TO,
        ))
        assert graph.edge_count == 1


class TestGraphSnapshot:
    @pytest.mark.asyncio
    async def test_snapshot_roundtrip(self, graph):
        """Export and re-import should preserve graph structure."""
        sid = "snapshot-session"
        n1 = _make_node(session_id=sid)
        n2 = _make_node(session_id=sid)
        id1 = await graph.add_node(n1)
        id2 = await graph.add_node(n2)
        await graph.add_edge(ReasoningEdge(
            source_id=id1, target_id=id2, relation=EdgeRelation.LEADS_TO,
        ))

        snapshot = graph.to_snapshot(sid)
        assert len(snapshot["nodes"]) == 2
        assert len(snapshot["edges"]) == 1

        # Load into a fresh graph
        new_graph = SharedReasoningGraph()
        loaded = await new_graph.load_snapshot(snapshot)
        assert loaded == 2
        assert new_graph.node_count == 2
        assert new_graph.edge_count == 1

    @pytest.mark.asyncio
    async def test_snapshot_scoped_to_session(self, graph):
        """Snapshot should only include nodes from the requested session."""
        n1 = _make_node(session_id="session-a")
        n2 = _make_node(session_id="session-b")
        await graph.add_node(n1)
        await graph.add_node(n2)

        snapshot = graph.to_snapshot("session-a")
        assert len(snapshot["nodes"]) == 1
        assert snapshot["nodes"][0]["session_id"] == "session-a"

    @pytest.mark.asyncio
    async def test_empty_snapshot(self, graph):
        """Snapshot of empty session returns empty lists."""
        snapshot = graph.to_snapshot("nonexistent")
        assert snapshot["nodes"] == []
        assert snapshot["edges"] == []

    @pytest.mark.asyncio
    async def test_load_empty_snapshot(self, graph):
        """Loading an empty snapshot should be a no-op."""
        loaded = await graph.load_snapshot({"nodes": [], "edges": []})
        assert loaded == 0
        assert graph.node_count == 0


class TestGraphProperties:
    @pytest.mark.asyncio
    async def test_node_count(self, graph):
        assert graph.node_count == 0
        await graph.add_node(_make_node())
        assert graph.node_count == 1
        await graph.add_node(_make_node())
        assert graph.node_count == 2

    @pytest.mark.asyncio
    async def test_edge_count(self, graph):
        assert graph.edge_count == 0
        n1 = _make_node()
        n2 = _make_node()
        id1 = await graph.add_node(n1)
        id2 = await graph.add_node(n2)
        await graph.add_edge(ReasoningEdge(
            source_id=id1, target_id=id2, relation=EdgeRelation.LEADS_TO,
        ))
        assert graph.edge_count == 1

    @pytest.mark.asyncio
    async def test_listener_error_logged_not_raised(self, graph):
        """Listener errors should be logged, not silently swallowed."""
        async def bad_listener(event_type, data):
            raise ValueError("boom")

        graph.on_change(bad_listener)
        # Should not raise
        await graph.add_node(_make_node())
        assert graph.node_count == 1
