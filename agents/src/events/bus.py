"""In-process event bus for real-time swarm event delivery.

Each session gets its own set of subscriber queues. Events are
delivered non-blocking — slow subscribers get events dropped
rather than blocking the swarm.
"""

import asyncio
from datetime import datetime, timezone

from .types import SwarmEvent


class EventBus:
    """Per-session asyncio.Queue pub/sub. Feeds WebSocket streams."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = {}
        self._session_timestamps: dict[str, datetime] = {}

    async def publish(self, session_id: str, event: SwarmEvent) -> None:
        """Publish an event to all subscribers for a session.

        Drops events on QueueFull — never blocks the publishing agent.
        """
        for queue in self._subscribers.get(session_id, []):
            try:
                queue.put_nowait(event.model_dump(mode="json"))
            except asyncio.QueueFull:
                pass  # Drop events if subscriber is too slow

    def subscribe(self, session_id: str) -> asyncio.Queue:
        """Subscribe to events for a session. Returns an asyncio.Queue."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=500)
        self._subscribers.setdefault(session_id, []).append(queue)
        self._session_timestamps[session_id] = datetime.now(timezone.utc)
        return queue

    def unsubscribe(self, session_id: str, queue: asyncio.Queue) -> None:
        """Remove a subscriber queue for a session."""
        if session_id in self._subscribers:
            self._subscribers[session_id] = [
                q for q in self._subscribers[session_id] if q is not queue
            ]

    def cleanup_session(self, session_id: str) -> None:
        """Remove all subscriber queues and timestamp for a session."""
        self._subscribers.pop(session_id, None)
        self._session_timestamps.pop(session_id, None)

    def get_stale_sessions(self, max_age_seconds: int = 1800) -> list[str]:
        """Return session IDs that have been inactive longer than max_age_seconds."""
        now = datetime.now(timezone.utc)
        stale: list[str] = []
        for session_id, ts in self._session_timestamps.items():
            age = (now - ts).total_seconds()
            if age > max_age_seconds:
                stale.append(session_id)
        return stale
