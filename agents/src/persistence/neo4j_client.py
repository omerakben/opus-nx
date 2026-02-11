"""Neo4j persistence for the shared reasoning graph.

Persists reasoning nodes and edges to Neo4j for cross-session
graph queries and visualization. Gracefully degrades if Neo4j
is unavailable -- the swarm works fine without it.
"""
from __future__ import annotations

from typing import Any

import structlog
from neo4j import AsyncGraphDatabase

from ..config import Settings
from ..graph.models import ReasoningEdge, ReasoningNode
from ..utils import async_retry

log = structlog.get_logger(__name__)


class Neo4jPersistence:
    """Persist reasoning graph nodes and edges to Neo4j."""

    def __init__(self, settings: Settings) -> None:
        self._driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=("neo4j", settings.neo4j_password),
        )

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def save_node(self, node: ReasoningNode) -> None:
        """Persist a reasoning node via MERGE (idempotent upsert)."""
        async with self._driver.session() as session:
            await session.run(
                """
                MERGE (n:ReasoningNode {id: $id})
                SET n.agent = $agent,
                    n.session_id = $session_id,
                    n.content = $content,
                    n.confidence = $confidence,
                    n.created_at = $created_at
                """,
                id=node.id,
                agent=node.agent.value,
                session_id=node.session_id,
                content=node.content,
                confidence=node.confidence,
                created_at=node.created_at.isoformat(),
            )
        log.debug("neo4j_node_saved", node_id=node.id)

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def save_edge(self, edge: ReasoningEdge) -> None:
        """Persist a reasoning edge via MERGE (idempotent upsert)."""
        async with self._driver.session() as session:
            await session.run(
                """
                MATCH (s:ReasoningNode {id: $source_id}),
                      (t:ReasoningNode {id: $target_id})
                MERGE (s)-[r:RELATES_TO {relation: $relation}]->(t)
                SET r.weight = $weight
                """,
                source_id=edge.source_id,
                target_id=edge.target_id,
                relation=edge.relation.value,
                weight=edge.weight,
            )
        log.debug(
            "neo4j_edge_saved",
            source=edge.source_id,
            target=edge.target_id,
        )

    async def save(self, event_type: str, data: Any) -> None:
        """Dispatch graph change events to the appropriate save method."""
        try:
            if event_type == "node_added" and isinstance(data, ReasoningNode):
                await self.save_node(data)
            elif event_type == "edge_added" and isinstance(data, ReasoningEdge):
                await self.save_edge(data)
            else:
                log.debug("neo4j_event_ignored", event_type=event_type)
        except Exception as e:
            log.warning("neo4j_save_failed", event_type=event_type, error=str(e))

    async def close(self) -> None:
        """Close the Neo4j driver connection."""
        try:
            await self._driver.close()
            log.info("neo4j_disconnected")
        except Exception as e:
            log.warning("neo4j_close_failed", error=str(e))
