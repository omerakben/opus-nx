"""In-process event bus for real-time swarm event delivery.

Each session gets its own set of subscriber queues. Events are
delivered non-blocking — slow subscribers get events dropped
rather than blocking the swarm. Drops are logged with rate-limiting
to avoid log spam.
"""

import asyncio
import logging
from datetime import datetime, timezone

from .types import SwarmEvent

logger = logging.getLogger(__name__)


class EventBus:
    """Per-session asyncio.Queue pub/sub. Feeds WebSocket streams."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = {}
        self._session_timestamps: dict[str, datetime] = {}
        self._drop_counts: dict[str, int] = {}
        self._last_drop_log: dict[str, float] = {}

    async def publish(self, session_id: str, event: SwarmEvent) -> None:
        """Publish an event to all subscribers for a session.

        Drops events on QueueFull — never blocks the publishing agent.
        Logs drops at most once per 10 seconds per session to avoid spam.
        """
        import time

        self._session_timestamps[session_id] = datetime.now(timezone.utc)

        for queue in self._subscribers.get(session_id, []):
            try:
                queue.put_nowait(event.model_dump(mode="json"))
            except asyncio.QueueFull:
                self._drop_counts[session_id] = self._drop_counts.get(session_id, 0) + 1
                now = time.monotonic()
                last_log = self._last_drop_log.get(session_id, 0)
                if now - last_log > 10:
                    logger.warning(
                        "Event dropped (subscriber too slow): session=%s total_drops=%d",
                        session_id,
                        self._drop_counts[session_id],
                    )
                    self._last_drop_log[session_id] = now
            except AttributeError:
                # Event might be a raw dict (from checkpoint/lifecycle code)
                try:
                    queue.put_nowait(event if isinstance(event, dict) else event.model_dump(mode="json"))
                except asyncio.QueueFull:
                    self._drop_counts[session_id] = self._drop_counts.get(session_id, 0) + 1

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
        """Remove all subscriber queues, timestamp, and drop stats for a session."""
        dropped = self._drop_counts.pop(session_id, 0)
        if dropped > 0:
            logger.info(
                "Session cleanup: session=%s total_events_dropped=%d",
                session_id,
                dropped,
            )
        self._subscribers.pop(session_id, None)
        self._session_timestamps.pop(session_id, None)
        self._last_drop_log.pop(session_id, None)

    def get_stale_sessions(self, max_age_seconds: int = 1800) -> list[str]:
        """Return session IDs that have been inactive longer than max_age_seconds."""
        now = datetime.now(timezone.utc)
        stale: list[str] = []
        for session_id, ts in self._session_timestamps.items():
            age = (now - ts).total_seconds()
            if age > max_age_seconds:
                stale.append(session_id)
        return stale

    def get_drop_count(self, session_id: str) -> int:
        """Get the number of dropped events for a session (for monitoring)."""
        return self._drop_counts.get(session_id, 0)

    @property
    def total_drops(self) -> int:
        """Total dropped events across all sessions."""
        return sum(self._drop_counts.values())
