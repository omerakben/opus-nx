"""Shared in-memory reasoning graph backed by NetworkX.

The central substrate where all agents collaborate. When Deep Thinker
writes a node, Contrarian can immediately read it. When Contrarian
creates a CHALLENGES edge, the dashboard sees it instantly via the
listener callback -> EventBus -> WebSocket.

All mutations are protected by asyncio.Lock for coroutine safety.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime
from typing import Any

import networkx as nx

from .models import AgentName, EdgeRelation, ReasoningEdge, ReasoningNode

logger = logging.getLogger(__name__)


class CycleDetectedError(Exception):
    """Raised when adding an edge would create a cycle in the reasoning graph."""

    def __init__(self, source_id: str, target_id: str) -> None:
        self.source_id = source_id
        self.target_id = target_id
        super().__init__(
            f"Adding edge {source_id} -> {target_id} would create a cycle"
        )


class SharedReasoningGraph:
    """In-memory reasoning graph. All agent interactions flow through here."""

    def __init__(self) -> None:
        self._graph = nx.DiGraph()
        self._lock = asyncio.Lock()
        self._listeners: list[Callable] = []

    @property
    def node_count(self) -> int:
        return self._graph.number_of_nodes()

    @property
    def edge_count(self) -> int:
        return self._graph.number_of_edges()

    async def add_node(self, node: ReasoningNode) -> str:
        """Add a reasoning node. Notifies listeners for real-time streaming."""
        async with self._lock:
            self._graph.add_node(node.id, **node.model_dump())
            await self._notify("node_added", node)
            return node.id

    async def add_edge(self, edge: ReasoningEdge) -> None:
        """Add a relationship edge between nodes.

        Raises CycleDetectedError if the edge would create a cycle.
        """
        async with self._lock:
            # Cycle detection: if there's already a path from target to source,
            # adding source -> target would create a cycle.
            if (
                edge.target_id in self._graph
                and edge.source_id in self._graph
                and nx.has_path(self._graph, edge.target_id, edge.source_id)
            ):
                logger.warning(
                    "Cycle detected: %s -> %s rejected",
                    edge.source_id,
                    edge.target_id,
                )
                raise CycleDetectedError(edge.source_id, edge.target_id)

            self._graph.add_edge(
                edge.source_id,
                edge.target_id,
                **edge.model_dump(exclude={"source_id", "target_id"}),
            )
            await self._notify("edge_added", edge)

    async def get_node(self, node_id: str) -> dict | None:
        """Get a single node by ID."""
        if node_id not in self._graph:
            return None
        data = self._graph.nodes[node_id]
        return {**data, "id": node_id}

    async def get_nodes_by_agent(self, agent: AgentName) -> list[dict]:
        """Get all reasoning nodes from a specific agent."""
        return [
            {**data, "id": nid}
            for nid, data in self._graph.nodes(data=True)
            if data.get("agent") == agent.value
        ]

    async def get_session_nodes(self, session_id: str) -> list[dict]:
        """Get all nodes for a session, ordered by creation time."""
        nodes = [
            {**data, "id": nid}
            for nid, data in self._graph.nodes(data=True)
            if data.get("session_id") == session_id
        ]
        return sorted(nodes, key=lambda n: n.get("created_at", ""))

    async def get_challenges_for(self, node_id: str) -> list[dict]:
        """Get all CHALLENGES edges targeting a node."""
        challenges = []
        if node_id not in self._graph:
            return challenges
        for src, _tgt, data in self._graph.in_edges(node_id, data=True):
            if data.get("relation") == EdgeRelation.CHALLENGES.value:
                src_data = self._graph.nodes.get(src, {})
                challenges.append(
                    {"source_node": {**src_data, "id": src}, "edge": data}
                )
        return challenges

    async def get_verifications_for(self, node_id: str) -> list[dict]:
        """Get all VERIFIES edges targeting a node."""
        verifications = []
        if node_id not in self._graph:
            return verifications
        for src, _tgt, data in self._graph.in_edges(node_id, data=True):
            if data.get("relation") == EdgeRelation.VERIFIES.value:
                src_data = self._graph.nodes.get(src, {})
                verifications.append(
                    {"source_node": {**src_data, "id": src}, "edge": data}
                )
        return verifications

    def to_json(self) -> dict[str, Any]:
        """Export graph as JSON for API responses and dashboard."""
        return nx.node_link_data(self._graph, edges="edges")

    def to_snapshot(self, session_id: str) -> dict[str, Any]:
        """Export session-scoped graph snapshot for persistence.

        Returns a dict with 'nodes' and 'edges' that can be stored
        and later restored via load_snapshot().
        """
        nodes = []
        node_ids: set[str] = set()
        for nid, data in self._graph.nodes(data=True):
            if data.get("session_id") == session_id:
                node_ids.add(nid)
                serializable = {}
                for k, v in data.items():
                    if isinstance(v, datetime):
                        serializable[k] = v.isoformat()
                    else:
                        serializable[k] = v
                nodes.append({"id": nid, **serializable})

        edges = []
        for src, tgt, data in self._graph.edges(data=True):
            if src in node_ids and tgt in node_ids:
                edges.append({"source_id": src, "target_id": tgt, **data})

        return {"session_id": session_id, "nodes": nodes, "edges": edges}

    async def load_snapshot(self, snapshot: dict[str, Any]) -> int:
        """Restore a session graph from a previously exported snapshot.

        Returns the number of nodes loaded.
        """
        nodes = snapshot.get("nodes", [])
        edges = snapshot.get("edges", [])

        async with self._lock:
            for node_data in nodes:
                nid = node_data.pop("id", None)
                if nid:
                    self._graph.add_node(nid, **node_data)

            for edge_data in edges:
                src = edge_data.pop("source_id", None)
                tgt = edge_data.pop("target_id", None)
                if src and tgt:
                    self._graph.add_edge(src, tgt, **edge_data)

        loaded = len(nodes)
        if loaded > 0:
            logger.info(
                "Loaded graph snapshot: %d nodes, %d edges",
                loaded,
                len(edges),
            )
        return loaded

    async def cleanup_session(self, session_id: str) -> int:
        """Remove all nodes (and their edges) for a session. Returns count removed."""
        async with self._lock:
            to_remove = [
                nid
                for nid, data in self._graph.nodes(data=True)
                if data.get("session_id") == session_id
            ]
            for nid in to_remove:
                self._graph.remove_node(nid)
            if to_remove:
                logger.info(
                    "Cleaned up session %s: %d nodes removed",
                    session_id,
                    len(to_remove),
                )
            return len(to_remove)

    def on_change(self, callback: Callable) -> None:
        """Register a listener for graph changes (feeds EventBus)."""
        self._listeners.append(callback)

    async def _notify(self, event_type: str, data: Any) -> None:
        """Notify all listeners of graph changes."""
        for listener in self._listeners:
            try:
                await listener(event_type, data)
            except Exception:
                logger.exception("Listener error during %s notification", event_type)
