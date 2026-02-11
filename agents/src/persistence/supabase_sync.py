"""Supabase persistence -- syncs reasoning graph to PostgreSQL.

Maps Python ReasoningNode -> thinking_nodes table,
ReasoningEdge -> reasoning_edges table. Uses upsert pattern
for safe re-sync with UUID validation and graceful degradation.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog

try:
    from supabase import create_client, Client
except ModuleNotFoundError:
    Client = Any  # type: ignore[assignment,misc]
    create_client = None  # type: ignore[assignment]

from ..config import Settings
from ..graph.models import ReasoningEdge, ReasoningNode
from ..utils import async_retry

log = structlog.get_logger(__name__)

# Edge type normalization: Python enum values -> Supabase column values
_EDGE_TYPE_MAP = {
    "LEADS_TO": "influences",
    "CHALLENGES": "challenges",
    "VERIFIES": "verifies",
    "SUPPORTS": "supports",
    "CONTRADICTS": "contradicts",
    "MERGES": "merges",
    "OBSERVES": "observes",
}


def _coerce_uuid(value: str | None, *, field: str) -> str | None:
    """Validate and normalize a UUID string. Returns None on invalid input."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return str(UUID(raw))
    except (TypeError, ValueError):
        log.warning("invalid_uuid_skipped", field=field, value=value)
        return None


def _clamp_confidence(value: float, *, default: float = 0.0) -> float:
    """Clamp confidence to [0.0, 1.0] range."""
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return max(0.0, min(1.0, parsed))


def _normalize_edge_type(relation: str) -> str:
    """Map Python EdgeRelation enum values to Supabase edge_type strings."""
    return _EDGE_TYPE_MAP.get(relation.upper(), relation.lower())


class SupabasePersistence:
    """Sync reasoning graph to Supabase PostgreSQL.

    Gracefully degrades if supabase-py is not installed or init fails.
    Uses fire-and-forget pattern -- never blocks swarm operation on sync failure.
    """

    def __init__(self, settings: Settings) -> None:
        self._client: Client | None
        if create_client is None:
            self._client = None
            log.warning("supabase_package_missing", msg="sync disabled")
            return
        try:
            self._client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
        except Exception:
            self._client = None
            log.exception("supabase_init_failed", msg="sync disabled")

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def sync_node(self, node: ReasoningNode) -> None:
        """Upsert a reasoning node to the thinking_nodes table."""
        if self._client is None:
            return

        node_id = _coerce_uuid(node.id, field="thinking_nodes.id")
        session_id = _coerce_uuid(node.session_id, field="thinking_nodes.session_id")
        if node_id is None or session_id is None:
            log.warning("node_sync_skipped", reason="invalid UUID")
            return

        row: dict[str, Any] = {
            "id": node_id,
            "session_id": session_id,
            "parent_node_id": None,
            "reasoning": node.reasoning or node.content,
            "response": node.content,
            "structured_reasoning": {
                "swarm": True,
                "agent": node.agent.value,
                "decision_points": node.decision_points,
            },
            "confidence_score": _clamp_confidence(node.confidence),
            "signature": f"swarm-{node.agent.value}",
            "input_query": node.input_query,
            "token_usage": node.token_usage if node.token_usage else {"source": "swarm_v2"},
            "node_type": "thinking",
            "agent_name": node.agent.value,
            "created_at": node.created_at.isoformat()
            if isinstance(node.created_at, datetime)
            else datetime.now(timezone.utc).isoformat(),
        }

        await asyncio.to_thread(
            lambda: self._client.table("thinking_nodes")  # type: ignore[union-attr]
            .upsert(row, on_conflict="id")
            .execute()
        )
        log.debug("supabase_node_synced", node_id=node_id)

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def sync_edge(self, edge: ReasoningEdge) -> None:
        """Upsert a reasoning edge to the reasoning_edges table."""
        if self._client is None:
            return

        source_id = _coerce_uuid(edge.source_id, field="reasoning_edges.source_id")
        target_id = _coerce_uuid(edge.target_id, field="reasoning_edges.target_id")
        if source_id is None or target_id is None:
            log.warning("edge_sync_skipped", reason="invalid UUID")
            return

        row: dict[str, Any] = {
            "source_id": source_id,
            "target_id": target_id,
            "edge_type": _normalize_edge_type(edge.relation.value),
            "weight": _clamp_confidence(edge.weight, default=1.0),
            "metadata": edge.metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        await asyncio.to_thread(
            lambda: self._client.table("reasoning_edges")  # type: ignore[union-attr]
            .upsert(row, on_conflict="source_id,target_id,edge_type")
            .execute()
        )
        log.debug(
            "supabase_edge_synced",
            source=source_id,
            target=target_id,
        )

    @async_retry(max_retries=3, backoff_delays=(1.0, 2.0, 4.0))
    async def backfill_node_tokens(
        self,
        node_ids: list[str],
        tokens_used: int,
        agent_name: str,
        input_tokens_used: int = 0,
    ) -> None:
        """Backfill token_usage on nodes after an agent completes.

        Distributes the agent's total token count evenly across its nodes
        using the same schema as the Node.js ThinkGraph (inputTokens,
        outputTokens, thinkingTokens).
        """
        if self._client is None or not node_ids:
            return

        # Distribute tokens evenly across nodes
        n = max(len(node_ids), 1)
        out_per_node = tokens_used // n
        out_remainder = tokens_used % n
        in_per_node = input_tokens_used // n
        in_remainder = input_tokens_used % n

        for i, raw_id in enumerate(node_ids):
            node_id = _coerce_uuid(raw_id, field="backfill.node_id")
            if node_id is None:
                continue

            node_out_tokens = out_per_node + (1 if i < out_remainder else 0)
            node_in_tokens = in_per_node + (1 if i < in_remainder else 0)
            token_data = {
                "inputTokens": node_in_tokens,
                "outputTokens": node_out_tokens,
                "thinkingTokens": 0,
                "source": "swarm_v2",
                "agent": agent_name,
            }

            try:
                await asyncio.to_thread(
                    lambda nid=node_id, td=token_data: (
                        self._client.table("thinking_nodes")  # type: ignore[union-attr]
                        .update({"token_usage": td})
                        .eq("id", nid)
                        .execute()
                    )
                )
                log.debug("backfill_tokens_updated", node_id=node_id, output_tokens=node_out_tokens, input_tokens=node_in_tokens)
            except Exception as e:
                log.warning("backfill_tokens_failed", node_id=node_id, error=str(e))

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
