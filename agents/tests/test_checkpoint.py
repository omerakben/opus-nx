"""Tests for human-in-the-loop checkpoint system.

Tests the checkpoint endpoint logic, graph annotation creation,
and the rerun_with_correction flow in SwarmManager.
"""

from __future__ import annotations

from src.events.types import HumanCheckpoint, SwarmRerunStarted
from src.graph.models import AgentName, EdgeRelation, ReasoningEdge, ReasoningNode
from src.swarm import SwarmManager


# ---------------------------------------------------------------------------
# Unit tests: checkpoint event models
# ---------------------------------------------------------------------------


class TestCheckpointEvents:
    def test_human_checkpoint_event(self):
        event = HumanCheckpoint(
            session_id="sess-1",
            node_id="node-abc",
            verdict="verified",
            correction=None,
        )
        data = event.model_dump(mode="json")
        assert data["event"] == "human_checkpoint"
        assert data["verdict"] == "verified"
        assert data["correction"] is None

    def test_human_checkpoint_with_correction(self):
        event = HumanCheckpoint(
            session_id="sess-1",
            node_id="node-abc",
            verdict="disagree",
            correction="The approach should use caching instead",
        )
        data = event.model_dump(mode="json")
        assert data["verdict"] == "disagree"
        assert "caching" in data["correction"]

    def test_swarm_rerun_started_event(self):
        event = SwarmRerunStarted(
            session_id="sess-1",
            agents=["deep_thinker", "contrarian"],
            correction_preview="Use event sourcing",
        )
        data = event.model_dump(mode="json")
        assert data["event"] == "swarm_rerun_started"
        assert len(data["agents"]) == 2
        assert data["correction_preview"] == "Use event sourcing"


# ---------------------------------------------------------------------------
# Integration tests: graph annotation
# ---------------------------------------------------------------------------


class TestGraphAnnotation:
    async def test_annotation_node_creation(self, test_graph):
        """Checkpoint should create an annotation node in the graph."""
        annotation = ReasoningNode(
            agent=AgentName.MAESTRO,
            session_id="test-checkpoint",
            content="Human checkpoint: verified",
            reasoning="human_annotation",
            confidence=1.0,
        )
        node_id = await test_graph.add_node(annotation)
        assert node_id is not None

        nodes = await test_graph.get_session_nodes("test-checkpoint")
        assert len(nodes) >= 1

    async def test_annotation_edge_creation(self, test_graph):
        """Checkpoint should create an OBSERVES edge to the target node."""
        # Create a target node first
        target = ReasoningNode(
            agent=AgentName.DEEP_THINKER,
            session_id="test-edge",
            content="Some analysis result",
            reasoning="analysis",
            confidence=0.85,
        )
        target_id = await test_graph.add_node(target)

        # Create annotation node
        annotation = ReasoningNode(
            agent=AgentName.MAESTRO,
            session_id="test-edge",
            content="Human checkpoint: questionable",
            reasoning="human_annotation",
            confidence=1.0,
        )
        annotation_id = await test_graph.add_node(annotation)

        # Add OBSERVES edge
        edge = ReasoningEdge(
            source_id=annotation_id,
            target_id=target_id,
            relation=EdgeRelation.OBSERVES,
            weight=1.0,
            metadata={"verdict": "questionable"},
        )
        await test_graph.add_edge(edge)

        # Verify the edge exists in the graph
        export = test_graph.to_json()
        assert "edges" in export
        edges = export["edges"]
        assert len(edges) >= 1

        obs_edges = [e for e in edges if e.get("relation") == "OBSERVES"]
        assert len(obs_edges) >= 1


# ---------------------------------------------------------------------------
# Integration tests: rerun_with_correction
# ---------------------------------------------------------------------------


class TestRerunWithCorrection:
    async def test_rerun_emits_events(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Rerun should emit SwarmRerunStarted event."""
        session_id = "test-rerun"
        queue = test_bus.subscribe(session_id)

        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        result = await swarm.rerun_with_correction(
            session_id=session_id,
            node_id="target-node-1",
            correction="Use a different approach",
        )

        assert result["status"] == "rerun_complete"
        assert "deep_thinker" in result["agents"]
        assert "contrarian" in result["agents"]

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        event_types = [e["event"] for e in events]
        assert "swarm_rerun_started" in event_types

    async def test_rerun_runs_two_agents(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Rerun should execute Deep Thinker and Contrarian."""
        session_id = "test-rerun-agents"
        queue = test_bus.subscribe(session_id)

        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        await swarm.rerun_with_correction(
            session_id=session_id,
            node_id="target-node-2",
            correction="Consider caching",
        )

        events = []
        while not queue.empty():
            events.append(queue.get_nowait())

        # Should have agent_started and agent_completed for both agents
        agent_started_events = [
            e for e in events if e["event"] == "agent_started"
        ]
        agent_completed_events = [
            e for e in events if e["event"] == "agent_completed"
        ]

        assert len(agent_started_events) >= 2
        assert len(agent_completed_events) >= 2

        started_agents = {e["agent"] for e in agent_started_events}
        assert "deep_thinker" in started_agents
        assert "contrarian" in started_agents
