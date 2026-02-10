"""Concurrent session tests — verifies isolation between simultaneous swarm runs.

Tests that two swarm sessions running on the same graph + bus maintain
proper isolation of events, graph nodes, and subscriber queues.
"""

from __future__ import annotations

import asyncio

from src.events.bus import EventBus
from src.graph.reasoning_graph import SharedReasoningGraph
from src.swarm import SwarmManager

# SharedReasoningGraph also used directly in TestCleanupSession


class TestSessionIsolation:
    """Events from session A should not appear in session B's queue."""

    async def test_events_only_reach_own_session_queue(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Events from session A must not appear in session B's queue."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        queue_a = test_bus.subscribe("session-a")
        queue_b = test_bus.subscribe("session-b")

        result_a, result_b = await asyncio.gather(
            swarm.run("Query A about microservices", "session-a"),
            swarm.run("Query B about databases", "session-b"),
        )

        # Drain events from both queues
        events_a = []
        while not queue_a.empty():
            events_a.append(queue_a.get_nowait())

        events_b = []
        while not queue_b.empty():
            events_b.append(queue_b.get_nowait())

        # All events in queue A should have session_id == "session-a"
        for event in events_a:
            assert event["session_id"] == "session-a", (
                f"Session B event leaked into session A queue: {event}"
            )

        # All events in queue B should have session_id == "session-b"
        for event in events_b:
            assert event["session_id"] == "session-b", (
                f"Session A event leaked into session B queue: {event}"
            )

    async def test_both_sessions_produce_events(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Both sessions should emit events (not starved by the other)."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        queue_a = test_bus.subscribe("session-a")
        queue_b = test_bus.subscribe("session-b")

        await asyncio.gather(
            swarm.run("Query A", "session-a"),
            swarm.run("Query B", "session-b"),
        )

        count_a = queue_a.qsize()
        count_b = queue_b.qsize()

        assert count_a > 0, "Session A produced no events"
        assert count_b > 0, "Session B produced no events"


class TestGraphNodeScoping:
    """Nodes created in each session should carry their session_id."""

    async def test_nodes_scoped_to_session(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Nodes in session A carry session_id='session-a', and vice versa."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await asyncio.gather(
            swarm.run("Analyze architecture", "session-a"),
            swarm.run("Analyze security", "session-b"),
        )

        nodes_a = await test_graph.get_session_nodes("session-a")
        nodes_b = await test_graph.get_session_nodes("session-b")

        for n in nodes_a:
            assert n.get("session_id") == "session-a"

        for n in nodes_b:
            assert n.get("session_id") == "session-b"

    async def test_sessions_have_nonoverlapping_node_ids(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Node IDs should be unique across sessions."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        await asyncio.gather(
            swarm.run("Query A", "session-a"),
            swarm.run("Query B", "session-b"),
        )

        nodes_a = await test_graph.get_session_nodes("session-a")
        nodes_b = await test_graph.get_session_nodes("session-b")

        ids_a = {n["id"] for n in nodes_a}
        ids_b = {n["id"] for n in nodes_b}

        assert ids_a.isdisjoint(ids_b), "Session A and B share node IDs"


class TestEventBusSubscriberIsolation:
    """Verify that EventBus subscribers only receive their session's events."""

    async def test_unsubscribed_session_gets_no_events(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """A queue for session-c should receive nothing when A and B run."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)
        queue_c = test_bus.subscribe("session-c")

        await asyncio.gather(
            swarm.run("Query A", "session-a"),
            swarm.run("Query B", "session-b"),
        )

        assert queue_c.empty(), "Session C received events from other sessions"


class TestConcurrentResults:
    """Both concurrent swarm runs should produce valid results."""

    async def test_both_sessions_return_all_agents(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Both results should contain all 5 agent results."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        result_a, result_b = await asyncio.gather(
            swarm.run("Query A about auth", "session-a"),
            swarm.run("Query B about caching", "session-b"),
        )

        assert len(result_a["agents"]) == 5
        assert len(result_b["agents"]) == 5

    async def test_both_sessions_have_correct_query(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Each result should carry its own query string."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        result_a, result_b = await asyncio.gather(
            swarm.run("Query A about auth", "session-a"),
            swarm.run("Query B about caching", "session-b"),
        )

        assert result_a["query"] == "Query A about auth"
        assert result_b["query"] == "Query B about caching"

    async def test_both_sessions_track_tokens(
        self, mock_settings, test_graph, test_bus, mock_anthropic
    ):
        """Both results should have positive token counts."""
        swarm = SwarmManager(mock_settings, test_graph, test_bus)

        result_a, result_b = await asyncio.gather(
            swarm.run("Query A", "session-a"),
            swarm.run("Query B", "session-b"),
        )

        assert result_a["total_tokens"] > 0
        assert result_b["total_tokens"] > 0


class TestCleanupSession:
    """After cleanup, session resources should be removed."""

    async def test_graph_cleanup_removes_session_nodes(self):
        """cleanup_session() should remove all nodes for that session."""
        from src.graph.models import AgentName, ReasoningNode

        graph = SharedReasoningGraph()

        # Manually add nodes to the graph for the session
        for _ in range(3):
            node = ReasoningNode(
                agent=AgentName.DEEP_THINKER,
                session_id="session-cleanup",
                content="Test node",
                confidence=0.8,
            )
            await graph.add_node(node)

        nodes_before = await graph.get_session_nodes("session-cleanup")
        assert len(nodes_before) == 3

        removed = await graph.cleanup_session("session-cleanup")
        assert removed == 3

        nodes_after = await graph.get_session_nodes("session-cleanup")
        assert len(nodes_after) == 0

    async def test_bus_cleanup_removes_subscribers(self):
        """cleanup_session() should remove all subscriber queues."""
        bus = EventBus()
        _ = bus.subscribe("session-x")
        assert "session-x" in bus._subscribers

        bus.cleanup_session("session-x")
        assert "session-x" not in bus._subscribers

    async def test_bus_cleanup_removes_timestamp(self):
        """cleanup_session() should remove the session timestamp."""
        bus = EventBus()
        bus.subscribe("session-ts")
        assert "session-ts" in bus._session_timestamps

        bus.cleanup_session("session-ts")
        assert "session-ts" not in bus._session_timestamps
