"""Tests for EventBus pub/sub."""


import pytest

from src.events.bus import EventBus
from src.events.types import AgentStarted, SwarmStarted


@pytest.fixture
def bus():
    return EventBus()


class TestEventBus:
    @pytest.mark.asyncio
    async def test_subscribe_and_receive(self, bus):
        queue = bus.subscribe("session-1")
        event = AgentStarted(
            session_id="session-1", agent="deep_thinker", effort="max"
        )
        await bus.publish("session-1", event)

        msg = queue.get_nowait()
        assert msg["event"] == "agent_started"
        assert msg["agent"] == "deep_thinker"
        assert msg["effort"] == "max"

    @pytest.mark.asyncio
    async def test_publish_to_empty_session(self, bus):
        """Publishing to a session with no subscribers should not error."""
        event = AgentStarted(
            session_id="no-one-here", agent="deep_thinker", effort="max"
        )
        await bus.publish("no-one-here", event)

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, bus):
        q1 = bus.subscribe("session-1")
        q2 = bus.subscribe("session-1")

        event = SwarmStarted(
            session_id="session-1",
            agents=["deep_thinker", "contrarian"],
            query="test query",
        )
        await bus.publish("session-1", event)

        msg1 = q1.get_nowait()
        msg2 = q2.get_nowait()
        assert msg1["event"] == "swarm_started"
        assert msg2["event"] == "swarm_started"

    @pytest.mark.asyncio
    async def test_session_isolation(self, bus):
        q1 = bus.subscribe("session-1")
        q2 = bus.subscribe("session-2")

        event = AgentStarted(
            session_id="session-1", agent="deep_thinker", effort="max"
        )
        await bus.publish("session-1", event)

        msg1 = q1.get_nowait()
        assert msg1["event"] == "agent_started"

        # session-2 queue should be empty
        assert q2.empty()

    @pytest.mark.asyncio
    async def test_unsubscribe(self, bus):
        q1 = bus.subscribe("session-1")
        q2 = bus.subscribe("session-1")

        bus.unsubscribe("session-1", q1)

        event = AgentStarted(
            session_id="session-1", agent="deep_thinker", effort="max"
        )
        await bus.publish("session-1", event)

        # q1 unsubscribed — should not receive
        assert q1.empty()
        # q2 still subscribed
        assert not q2.empty()

    @pytest.mark.asyncio
    async def test_full_queue_drops_events(self, bus):
        """When a queue is full, events should be dropped (not block)."""
        # Create a tiny queue by subscribing then filling it
        queue = bus.subscribe("session-1")
        # Fill the queue (maxsize=500)
        for i in range(500):
            event = AgentStarted(
                session_id="session-1", agent="deep_thinker", effort="max"
            )
            await bus.publish("session-1", event)

        # Queue should be full
        assert queue.full()

        # Publishing one more should NOT raise
        event = AgentStarted(
            session_id="session-1", agent="contrarian", effort="high"
        )
        await bus.publish("session-1", event)  # Should not raise
