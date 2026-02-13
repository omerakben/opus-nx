"""Shared evaluation utilities for scoring swarm results.

Used by both the synthetic runner (run_reasoning_eval.py) and the
live evaluation harness (run_reasoning_eval_live.py).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class SwarmEvalMetrics:
    """Metrics extracted from a single swarm run result."""

    task_id: str
    variant: str
    session_id: str

    # Quality
    verifier_score: float = 0.0
    contradiction_rate: float = 0.0
    synthesis_confidence: float = 0.0

    # Efficiency
    total_tokens: int = 0
    total_duration_ms: int = 0
    agent_count: int = 0
    error_count: int = 0

    # Agent-level
    agent_statuses: dict[str, str] = field(default_factory=dict)
    agent_confidences: dict[str, float] = field(default_factory=dict)

    # Graph
    node_count: int = 0
    edge_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "task_id": self.task_id,
            "variant": self.variant,
            "session_id": self.session_id,
            "verifier_score": round(self.verifier_score, 6),
            "contradiction_rate": round(self.contradiction_rate, 6),
            "synthesis_confidence": round(self.synthesis_confidence, 6),
            "total_tokens": self.total_tokens,
            "total_duration_ms": self.total_duration_ms,
            "agent_count": self.agent_count,
            "error_count": self.error_count,
            "node_count": self.node_count,
            "edge_count": self.edge_count,
        }


def extract_metrics_from_swarm_result(
    result: dict[str, Any],
    *,
    task_id: str,
    variant: str,
) -> SwarmEvalMetrics:
    """Extract evaluation metrics from a SwarmManager.run() result.

    Parses agent results, graph state, and synthesis to compute quality,
    efficiency, and structural metrics.
    """
    session_id = str(result.get("session_id", ""))
    agents = result.get("agents", [])
    graph = result.get("graph", {})

    # Agent-level extraction
    agent_statuses: dict[str, str] = {}
    agent_confidences: dict[str, float] = {}
    verifier_confidence = 0.0
    contrarian_challenges = 0
    contrarian_total = 0
    synthesis_confidence = 0.0

    for agent in agents:
        name = str(agent.get("agent", ""))
        status = str(agent.get("status", ""))
        confidence = float(agent.get("confidence", 0.0))
        agent_statuses[name] = status
        agent_confidences[name] = confidence

        if name == "verifier" and status == "completed":
            verifier_confidence = confidence

        if name == "contrarian" and status == "completed":
            reasoning = str(agent.get("reasoning", ""))
            # Count CHALLENGE vs SUPPORT mentions in reasoning
            challenges = len(re.findall(r"CHALLENGE|challenge|incorrect|flawed", reasoning))
            supports = len(re.findall(r"SUPPORT|support|concede|correct", reasoning))
            contrarian_challenges = challenges
            contrarian_total = challenges + supports

        if name == "synthesizer" and status == "completed":
            synthesis_confidence = confidence

    # Contradiction rate: fraction of contrarian findings that are challenges
    contradiction_rate = 0.0
    if contrarian_total > 0:
        contradiction_rate = contrarian_challenges / contrarian_total

    # Graph metrics
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    error_count = sum(1 for a in agents if a.get("status") == "error")

    return SwarmEvalMetrics(
        task_id=task_id,
        variant=variant,
        session_id=session_id,
        verifier_score=verifier_confidence,
        contradiction_rate=contradiction_rate,
        synthesis_confidence=synthesis_confidence,
        total_tokens=int(result.get("total_tokens", 0)),
        total_duration_ms=int(result.get("total_duration_ms", 0)),
        agent_count=len(agents),
        error_count=error_count,
        agent_statuses=agent_statuses,
        agent_confidences=agent_confidences,
        node_count=len(nodes),
        edge_count=len(edges) if isinstance(edges, list) else 0,
    )


def compute_aggregate_metrics(
    metrics_list: list[SwarmEvalMetrics],
) -> dict[str, Any]:
    """Compute aggregate statistics over a list of eval metrics."""
    if not metrics_list:
        return {}

    n = len(metrics_list)
    return {
        "count": n,
        "avg_verifier_score": sum(m.verifier_score for m in metrics_list) / n,
        "avg_contradiction_rate": sum(m.contradiction_rate for m in metrics_list) / n,
        "avg_synthesis_confidence": sum(m.synthesis_confidence for m in metrics_list) / n,
        "avg_total_tokens": sum(m.total_tokens for m in metrics_list) / n,
        "avg_total_duration_ms": sum(m.total_duration_ms for m in metrics_list) / n,
        "avg_node_count": sum(m.node_count for m in metrics_list) / n,
        "error_rate": sum(1 for m in metrics_list if m.error_count > 0) / n,
        "completion_rate": sum(
            1 for m in metrics_list
            if all(s == "completed" for s in m.agent_statuses.values())
        ) / n,
    }


def load_benchmark(path: str) -> dict[str, Any]:
    """Load a benchmark JSON file and validate its structure.

    Resolves relative paths from the repository root (parent of agents/).
    """
    resolved = Path(path)
    if not resolved.is_absolute():
        repo_root = Path(__file__).resolve().parent.parent.parent
        resolved = repo_root / path
    with open(resolved, encoding="utf-8") as f:
        data = json.load(f)

    if "tasks" not in data or not isinstance(data["tasks"], list):
        raise ValueError(f"Benchmark JSON must contain a 'tasks' array: {path}")

    for i, task in enumerate(data["tasks"]):
        if "id" not in task:
            raise ValueError(f"Task at index {i} missing 'id' field")
        if "prompt" not in task:
            raise ValueError(f"Task '{task.get('id', i)}' missing 'prompt' field")

    return data
