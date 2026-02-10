"""Real Claude API smoke test — only runs when ANTHROPIC_API_KEY is set.

This test hits the live Claude API with a minimal query to verify
end-to-end swarm execution. Skipped in CI unless API key is configured.
"""

from __future__ import annotations

import os

import pytest

from src.config import Settings
from src.events.bus import EventBus
from src.graph.reasoning_graph import SharedReasoningGraph
from src.swarm import SwarmManager


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set",
)
class TestRealClaudeSmoke:
    """Smoke tests with real Claude API -- only run when API key is available."""

    async def test_minimal_swarm_with_real_api(self):
        """Full swarm pipeline against live Claude Opus 4.6."""
        settings = Settings()
        graph = SharedReasoningGraph()
        bus = EventBus()

        swarm = SwarmManager(settings, graph, bus)
        result = await swarm.run("What is 2+2?", "smoke-test-session")

        # All 5 agents should be present
        assert len(result["agents"]) == 5

        # Token usage should be non-zero
        assert result["total_tokens"] > 0

        # At least the primary agents should complete
        completed = [a for a in result["agents"] if a["status"] == "completed"]
        assert len(completed) >= 3, (
            f"Only {len(completed)} agents completed: "
            f"{[a['agent'] for a in result['agents']]}"
        )

    async def test_graph_has_nodes_after_real_run(self):
        """After a real swarm run, the graph should contain reasoning nodes."""
        settings = Settings()
        graph = SharedReasoningGraph()
        bus = EventBus()

        swarm = SwarmManager(settings, graph, bus)
        await swarm.run("Explain recursion briefly", "smoke-graph-session")

        nodes = await graph.get_session_nodes("smoke-graph-session")
        # At least some nodes should have been created by agents
        assert len(nodes) >= 1, "No graph nodes created during real swarm run"
