"""Shared in-memory reasoning graph backed by NetworkX.

The central substrate where all agents collaborate. When Deep Thinker
writes a node, Contrarian can immediately read it. When Contrarian
creates a CHALLENGES edge, the dashboard sees it instantly via the
listener callback -> EventBus -> WebSocket.

All mutations are protected by asyncio.Lock for coroutine safety.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

import networkx as nx

from .models import AgentName, EdgeRelation, ReasoningEdge, ReasoningNode


class SharedReasoningGraph:
    """In-memory reasoning graph. All agent interactions flow through here."""

    def __init__(self) -> None:
        self._graph = nx.DiGraph()
        self._lock = asyncio.Lock()
        self._listeners: list[Callable] = []

    async def add_node(self, node: ReasoningNode) -> str:
        """Add a reasoning node. Notifies listeners for real-time streaming."""
        async with self._lock:
            self._graph.add_node(node.id, **node.model_dump())
            await self._notify("node_added", node)
            return node.id

    async def add_edge(self, edge: ReasoningEdge) -> None:
        """Add a relationship edge between nodes."""
        async with self._lock:
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
                pass  # Don't let listener errors crash the graph
