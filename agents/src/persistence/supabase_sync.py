"""Supabase persistence -- syncs reasoning graph to PostgreSQL.

Maps Python ReasoningNode -> thinking_nodes table,
ReasoningEdge -> reasoning_edges table. Uses upsert pattern
for safe re-sync.
"""
from __future__ import annotations

import asyncio
from typing import Any

import structlog
from supabase import create_client, Client

from ..config import Settings
from ..graph.models import ReasoningEdge, ReasoningNode
from ..utils import async_retry

log = structlog.get_logger(__name__)


class SupabasePersistence:
    """Sync reasoning graph to Supabase PostgreSQL."""

    def __init__(self, settings: Settings) -> None:
        self._client: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def sync_node(self, node: ReasoningNode) -> None:
        """Upsert a reasoning node to the thinking_nodes table."""
        row = {
            "id": node.id,
            "session_id": node.session_id,
            "reasoning": node.content,
            "confidence_score": node.confidence,
            "structured_reasoning": {},
            "input_query": None,
            "agent_name": node.agent.value,
        }
        await asyncio.to_thread(
            lambda: self._client.table("thinking_nodes")
            .upsert(row, on_conflict="id")
            .execute()
        )
        log.debug("supabase_node_synced", node_id=node.id)

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def sync_edge(self, edge: ReasoningEdge) -> None:
        """Upsert a reasoning edge to the reasoning_edges table."""
        row = {
            "source_id": edge.source_id,
            "target_id": edge.target_id,
            "edge_type": edge.relation.value.lower(),
            "weight": edge.weight,
            "metadata": edge.metadata,
        }
        await asyncio.to_thread(
            lambda: self._client.table("reasoning_edges")
            .upsert(row, on_conflict="source_id,target_id,edge_type")
            .execute()
        )
        log.debug(
            "supabase_edge_synced",
            source=edge.source_id,
            target=edge.target_id,
        )

    async def sync(self, event_type: str, data: Any) -> None:
        """Dispatch graph change events to the appropriate sync method."""
        try:
            if event_type == "node_added" and isinstance(data, ReasoningNode):
                await self.sync_node(data)
            elif event_type == "edge_added" and isinstance(data, ReasoningEdge):
                await self.sync_edge(data)
            else:
                log.debug("supabase_event_ignored", event_type=event_type)
        except Exception as e:
            log.warning("supabase_sync_failed", event_type=event_type, error=str(e))
