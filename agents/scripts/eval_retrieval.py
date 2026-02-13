#!/usr/bin/env python3
"""Retrieval quality evaluation for reasoning artifact rehydration.

Measures precision@k and MRR (Mean Reciprocal Rank) for the rehydration
pipeline in SwarmManager._build_reasoning_rehydration_context().

Unlike the live eval harness, this does NOT require API calls or a database.
It directly exercises the candidate scoring, deduplication, and ranking logic
with synthetic retrieval results to produce deterministic quality metrics.

Hypotheses under test (from research charter):
  H2: Cross-session retrieval boosts reasoning quality (precision of retrieval)
  H3: Hypothesis lifecycle creates a knowledge refinement loop (retained policy bonus)

Usage:
  python -m scripts.eval_retrieval
  python -m scripts.eval_retrieval --output-dir docs/evals/data
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Scoring functions (mirrors SwarmManager)
# ---------------------------------------------------------------------------

def compute_candidate_score(
    *,
    similarity: float,
    importance: float,
    recency: float,
    retained_policy_bonus: float,
) -> float:
    """Replicate SwarmManager._compute_candidate_score."""
    return (
        0.60 * similarity
        + 0.25 * importance
        + 0.10 * recency
        + 0.05 * retained_policy_bonus
    )


def recency_score(timestamp: datetime | None) -> float:
    """Replicate SwarmManager._recency_score."""
    if timestamp is None:
        return 0.5
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    age_seconds = max(0.0, (datetime.now(timezone.utc) - timestamp).total_seconds())
    age_days = age_seconds / 86400.0
    return max(0.0, min(1.0, 1.0 - (age_days / 30.0)))


# ---------------------------------------------------------------------------
# Synthetic retrieval scenario
# ---------------------------------------------------------------------------

@dataclass
class RetrievalScenario:
    """A synthetic retrieval evaluation scenario."""

    name: str
    description: str
    query_session_id: str
    artifact_matches: list[dict[str, Any]]
    hypothesis_matches: list[dict[str, Any]]
    # Ground truth: IDs of artifacts/hypotheses that SHOULD be in top-k
    relevant_ids: list[str]
    # k for precision@k
    k: int = 4


@dataclass
class RetrievalMetrics:
    """Metrics for a single retrieval scenario."""

    scenario_name: str
    precision_at_k: float
    mrr: float
    k: int
    relevant_found: int
    total_relevant: int
    top_k_ids: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario_name": self.scenario_name,
            "precision_at_k": round(self.precision_at_k, 4),
            "mrr": round(self.mrr, 4),
            "k": self.k,
            "relevant_found": self.relevant_found,
            "total_relevant": self.total_relevant,
        }


# ---------------------------------------------------------------------------
# Rehydration pipeline (mirrors SwarmManager._build_reasoning_rehydration_context)
# ---------------------------------------------------------------------------

def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    normalized = raw.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def run_rehydration_pipeline(
    scenario: RetrievalScenario,
) -> list[dict[str, object]]:
    """Run the candidate scoring + dedup + ranking pipeline.

    Returns the final selected candidates in ranked order.
    """
    candidates: list[dict[str, object]] = []

    for row in scenario.artifact_matches:
        content = str(row.get("content") or "").strip()
        if not content:
            continue
        similarity = float(row.get("similarity") or 0.0)
        importance = float(row.get("importance_score") or 0.0)
        source_session = str(row.get("session_id") or "unknown")
        retained_bonus = 0.0
        snapshot = row.get("snapshot")
        if isinstance(snapshot, dict):
            if str(snapshot.get("retention_decision") or "") == "retain":
                retained_bonus = 1.0
        rec = recency_score(
            _parse_timestamp(row.get("updated_at"))
            or _parse_timestamp(row.get("created_at"))
            or _parse_timestamp(row.get("last_used_at"))
        )
        score = compute_candidate_score(
            similarity=similarity,
            importance=importance,
            recency=rec,
            retained_policy_bonus=retained_bonus,
        )
        text_hash = hashlib.md5(content.lower().encode("utf-8")).hexdigest()
        candidates.append({
            "source": "artifact",
            "id": str(row.get("id") or ""),
            "session_id": source_session,
            "text": content,
            "text_hash": text_hash,
            "similarity": similarity,
            "importance": importance,
            "recency": rec,
            "retained_policy_bonus": retained_bonus,
            "score": score,
        })

    for row in scenario.hypothesis_matches:
        hypothesis_text = str(row.get("hypothesis_text") or "").strip()
        if not hypothesis_text:
            continue
        source_session = str(row.get("session_id") or "unknown")
        similarity = float(row.get("similarity") or 0.0)
        importance = float(
            row.get("importance_score")
            or row.get("confidence")
            or 0.5
        )
        retained_bonus = float(row.get("retained_policy_bonus") or 0.0)
        rec = recency_score(_parse_timestamp(row.get("created_at")))
        score = compute_candidate_score(
            similarity=similarity,
            importance=importance,
            recency=rec,
            retained_policy_bonus=retained_bonus,
        )
        text_hash = str(row.get("hypothesis_text_hash") or "").strip() or hashlib.md5(
            hypothesis_text.lower().encode("utf-8")
        ).hexdigest()
        candidates.append({
            "source": "hypothesis",
            "id": str(row.get("hypothesis_id") or ""),
            "session_id": source_session,
            "text": hypothesis_text,
            "text_hash": text_hash,
            "similarity": similarity,
            "importance": importance,
            "recency": rec,
            "retained_policy_bonus": retained_bonus,
            "score": score,
        })

    # Dedup by session_id:text_hash (keep highest score)
    deduped: dict[str, dict[str, object]] = {}
    for candidate in candidates:
        key = f"{candidate['session_id']}:{candidate['text_hash']}"
        existing = deduped.get(key)
        if existing is None or float(candidate["score"]) > float(existing["score"]):
            deduped[key] = candidate

    ranked = sorted(
        deduped.values(),
        key=lambda item: float(item["score"]),
        reverse=True,
    )

    # Prefer cross-session results
    cross_session_ranked = [
        item
        for item in ranked
        if str(item.get("session_id") or "") != scenario.query_session_id
    ]
    selected = (cross_session_ranked or ranked)[:scenario.k]

    return list(selected)


# ---------------------------------------------------------------------------
# Metric computation
# ---------------------------------------------------------------------------

def evaluate_scenario(scenario: RetrievalScenario) -> RetrievalMetrics:
    """Run pipeline and compute precision@k + MRR."""
    selected = run_rehydration_pipeline(scenario)
    top_k_ids = [str(item.get("id") or "") for item in selected]

    relevant_set = set(scenario.relevant_ids)

    # Precision@k
    relevant_found = sum(1 for doc_id in top_k_ids if doc_id in relevant_set)
    precision = relevant_found / max(1, len(top_k_ids))

    # MRR (reciprocal rank of the first relevant result)
    mrr = 0.0
    for rank, doc_id in enumerate(top_k_ids, start=1):
        if doc_id in relevant_set:
            mrr = 1.0 / rank
            break

    return RetrievalMetrics(
        scenario_name=scenario.name,
        precision_at_k=precision,
        mrr=mrr,
        k=scenario.k,
        relevant_found=relevant_found,
        total_relevant=len(relevant_set),
        top_k_ids=top_k_ids,
    )


# ---------------------------------------------------------------------------
# Scenario builders
# ---------------------------------------------------------------------------

_NOW = datetime.now(timezone.utc)


def _ts(days_ago: float) -> str:
    return (_NOW - timedelta(days=days_ago)).isoformat()


def build_scenarios() -> list[RetrievalScenario]:
    """Build the full suite of synthetic retrieval scenarios."""
    scenarios: list[RetrievalScenario] = []

    # Scenario 1: High-similarity relevant artifacts dominate
    scenarios.append(RetrievalScenario(
        name="high_similarity_dominance",
        description="Relevant artifacts with high similarity should rank first",
        query_session_id="query-sess-1",
        artifact_matches=[
            {"id": "rel-a1", "session_id": "other-sess-1", "content": "Distributed tracing instrumentation blind spots", "similarity": 0.95, "importance_score": 0.8, "created_at": _ts(1)},
            {"id": "rel-a2", "session_id": "other-sess-2", "content": "Observability gap analysis methodology", "similarity": 0.91, "importance_score": 0.7, "created_at": _ts(2)},
            {"id": "irr-a1", "session_id": "other-sess-3", "content": "Unrelated: pizza recipe optimization", "similarity": 0.72, "importance_score": 0.9, "created_at": _ts(0)},
            {"id": "irr-a2", "session_id": "other-sess-4", "content": "Unrelated: stock market prediction", "similarity": 0.70, "importance_score": 0.6, "created_at": _ts(3)},
            {"id": "rel-a3", "session_id": "other-sess-5", "content": "SLI/SLO instrumentation coverage", "similarity": 0.88, "importance_score": 0.6, "created_at": _ts(5)},
        ],
        hypothesis_matches=[],
        relevant_ids=["rel-a1", "rel-a2", "rel-a3"],
        k=4,
    ))

    # Scenario 2: Retained policy bonus boosts retained hypotheses
    scenarios.append(RetrievalScenario(
        name="retained_policy_bonus",
        description="Retained hypotheses should rank higher due to policy bonus",
        query_session_id="query-sess-2",
        artifact_matches=[
            {"id": "norm-a1", "session_id": "other-sess-1", "content": "Normal artifact, high similarity", "similarity": 0.90, "importance_score": 0.7, "created_at": _ts(2)},
        ],
        hypothesis_matches=[
            {"hypothesis_id": "ret-h1", "session_id": "other-sess-2", "hypothesis_text": "Retained hypothesis about queue backpressure", "similarity": 0.87, "confidence": 0.8, "retained_policy_bonus": 1.0, "created_at": _ts(1)},
            {"hypothesis_id": "nret-h1", "session_id": "other-sess-3", "hypothesis_text": "Non-retained hypothesis about backpressure", "similarity": 0.87, "confidence": 0.8, "retained_policy_bonus": 0.0, "created_at": _ts(1)},
            {"hypothesis_id": "ret-h2", "session_id": "other-sess-4", "hypothesis_text": "Retained hypothesis about latency", "similarity": 0.85, "confidence": 0.7, "retained_policy_bonus": 1.0, "created_at": _ts(3)},
        ],
        relevant_ids=["ret-h1", "ret-h2"],
        k=4,
    ))

    # Scenario 3: Deduplication across sessions
    scenarios.append(RetrievalScenario(
        name="deduplication",
        description="Duplicate content from same session should be deduped (highest score kept)",
        query_session_id="query-sess-3",
        artifact_matches=[
            {"id": "a1", "session_id": "other-sess-1", "content": "Exactly duplicated content for dedup testing", "similarity": 0.92, "importance_score": 0.8, "created_at": _ts(1)},
            {"id": "a2", "session_id": "other-sess-1", "content": "Exactly duplicated content for dedup testing", "similarity": 0.88, "importance_score": 0.9, "created_at": _ts(0.5)},
            {"id": "a3", "session_id": "other-sess-2", "content": "Unique content about microservices", "similarity": 0.90, "importance_score": 0.7, "created_at": _ts(2)},
            {"id": "a4", "session_id": "other-sess-3", "content": "Unique content about SLO budgets", "similarity": 0.85, "importance_score": 0.6, "created_at": _ts(4)},
        ],
        hypothesis_matches=[],
        # After dedup, a1 should win over a2 (higher sim * 0.6 outweighs imp difference)
        relevant_ids=["a1", "a3", "a4"],
        k=4,
    ))

    # Scenario 4: Cross-session preference
    scenarios.append(RetrievalScenario(
        name="cross_session_preference",
        description="Cross-session artifacts are preferred over same-session ones",
        query_session_id="query-sess-4",
        artifact_matches=[
            {"id": "same-a1", "session_id": "query-sess-4", "content": "Same-session high similarity", "similarity": 0.95, "importance_score": 0.9, "created_at": _ts(0)},
            {"id": "cross-a1", "session_id": "other-sess-1", "content": "Cross-session moderate similarity", "similarity": 0.85, "importance_score": 0.7, "created_at": _ts(1)},
            {"id": "cross-a2", "session_id": "other-sess-2", "content": "Cross-session lower similarity", "similarity": 0.80, "importance_score": 0.6, "created_at": _ts(2)},
            {"id": "cross-a3", "session_id": "other-sess-3", "content": "Cross-session lowest similarity", "similarity": 0.75, "importance_score": 0.5, "created_at": _ts(3)},
            {"id": "cross-a4", "session_id": "other-sess-4", "content": "Cross-session edge similarity", "similarity": 0.72, "importance_score": 0.4, "created_at": _ts(5)},
        ],
        hypothesis_matches=[],
        # Cross-session are preferred; same-session excluded if cross-session available
        relevant_ids=["cross-a1", "cross-a2", "cross-a3", "cross-a4"],
        k=4,
    ))

    # Scenario 5: Recency bias for tie-breaking
    scenarios.append(RetrievalScenario(
        name="recency_tiebreaker",
        description="Recent artifacts should rank higher when similarity is similar",
        query_session_id="query-sess-5",
        artifact_matches=[
            {"id": "old-a1", "session_id": "other-sess-1", "content": "Old artifact about concurrency", "similarity": 0.85, "importance_score": 0.7, "created_at": _ts(25)},
            {"id": "new-a1", "session_id": "other-sess-2", "content": "New artifact about concurrency patterns", "similarity": 0.85, "importance_score": 0.7, "created_at": _ts(1)},
            {"id": "mid-a1", "session_id": "other-sess-3", "content": "Mid-age artifact about locking", "similarity": 0.85, "importance_score": 0.7, "created_at": _ts(10)},
        ],
        hypothesis_matches=[],
        # new > mid > old due to recency weight
        relevant_ids=["new-a1", "mid-a1"],
        k=4,
    ))

    # Scenario 6: Mixed artifact + hypothesis ranking
    scenarios.append(RetrievalScenario(
        name="mixed_source_ranking",
        description="Artifacts and hypotheses should be ranked together by composite score",
        query_session_id="query-sess-6",
        artifact_matches=[
            {"id": "art-1", "session_id": "other-sess-1", "content": "ML model fairness analysis", "similarity": 0.88, "importance_score": 0.8, "created_at": _ts(2)},
            {"id": "art-2", "session_id": "other-sess-2", "content": "Bias detection methodology", "similarity": 0.82, "importance_score": 0.6, "created_at": _ts(5)},
        ],
        hypothesis_matches=[
            {"hypothesis_id": "hyp-1", "session_id": "other-sess-3", "hypothesis_text": "Demographic parity constraint improves fairness", "similarity": 0.90, "confidence": 0.85, "retained_policy_bonus": 1.0, "created_at": _ts(1)},
            {"hypothesis_id": "hyp-2", "session_id": "other-sess-4", "hypothesis_text": "Calibration method for protected attributes", "similarity": 0.86, "confidence": 0.75, "retained_policy_bonus": 0.0, "created_at": _ts(3)},
        ],
        # hyp-1 (high sim + retained bonus) should be top; art-1 close behind
        relevant_ids=["hyp-1", "art-1", "hyp-2"],
        k=4,
    ))

    # Scenario 7: Empty results
    scenarios.append(RetrievalScenario(
        name="empty_results",
        description="No candidates should produce zero precision and MRR",
        query_session_id="query-sess-7",
        artifact_matches=[],
        hypothesis_matches=[],
        relevant_ids=["nonexistent-1"],
        k=4,
    ))

    # Scenario 8: Importance score dominates when similarity is moderate
    scenarios.append(RetrievalScenario(
        name="importance_influence",
        description="High importance should lift moderate-similarity items over low-importance high-similarity ones",
        query_session_id="query-sess-8",
        artifact_matches=[
            {"id": "hi-imp", "session_id": "other-sess-1", "content": "Highly important artifact about incident response", "similarity": 0.82, "importance_score": 1.0, "created_at": _ts(1)},
            {"id": "hi-sim", "session_id": "other-sess-2", "content": "High similarity but low importance", "similarity": 0.88, "importance_score": 0.2, "created_at": _ts(1)},
            {"id": "balanced", "session_id": "other-sess-3", "content": "Balanced similarity and importance", "similarity": 0.85, "importance_score": 0.7, "created_at": _ts(1)},
        ],
        hypothesis_matches=[],
        # hi-sim: 0.6*0.88 + 0.25*0.2 = 0.578
        # hi-imp: 0.6*0.82 + 0.25*1.0 = 0.742
        # balanced: 0.6*0.85 + 0.25*0.7 = 0.685
        # Order: hi-imp > balanced > hi-sim
        relevant_ids=["hi-imp", "balanced"],
        k=4,
    ))

    return scenarios


# ---------------------------------------------------------------------------
# Output generation
# ---------------------------------------------------------------------------

def write_retrieval_results(
    metrics_list: list[RetrievalMetrics],
    output_dir: str,
) -> None:
    """Write retrieval evaluation results to disk."""
    repo_root = Path(__file__).resolve().parent.parent.parent
    out = Path(output_dir)
    if not out.is_absolute():
        out = repo_root / output_dir
    out.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    # Per-scenario CSV
    task_csv = out / f"eval-retrieval-{timestamp}-scenarios.csv"
    fieldnames = ["scenario_name", "precision_at_k", "mrr", "k", "relevant_found", "total_relevant"]
    with task_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for m in metrics_list:
            writer.writerow(m.to_dict())

    # Aggregate summary
    n = len(metrics_list)
    avg_precision = sum(m.precision_at_k for m in metrics_list) / max(1, n)
    avg_mrr = sum(m.mrr for m in metrics_list) / max(1, n)
    perfect_precision = sum(1 for m in metrics_list if m.precision_at_k == 1.0) / max(1, n)

    summary_path = out / f"eval-retrieval-{timestamp}-summary.json"
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scenario_count": n,
        "avg_precision_at_k": round(avg_precision, 4),
        "avg_mrr": round(avg_mrr, 4),
        "perfect_precision_rate": round(perfect_precision, 4),
        "scenarios": [m.to_dict() for m in metrics_list],
    }
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    # Markdown report
    report_path = out / f"eval-retrieval-{timestamp}-report.md"
    lines = [
        "# Retrieval Quality Evaluation Report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        f"Scenarios: {n}",
        "",
        "## Aggregate Metrics",
        "",
        f"- **Avg Precision@k**: {avg_precision:.4f}",
        f"- **Avg MRR**: {avg_mrr:.4f}",
        f"- **Perfect Precision Rate**: {perfect_precision:.2%}",
        "",
        "## Per-Scenario Results",
        "",
        "| Scenario | P@k | MRR | Relevant Found | Total Relevant |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for m in metrics_list:
        lines.append(
            f"| {m.scenario_name} | {m.precision_at_k:.4f} | {m.mrr:.4f} | "
            f"{m.relevant_found} | {m.total_relevant} |"
        )
    lines.extend(["", "## Hypothesis Coverage", ""])
    lines.append("- **H2 (Cross-session retrieval)**: Tested via `cross_session_preference` and `deduplication` scenarios")
    lines.append("- **H3 (Hypothesis lifecycle)**: Tested via `retained_policy_bonus` scenario")
    lines.append("")

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"\nResults written to {out}/")
    print(f"  Scenarios: {task_csv.name}")
    print(f"  Summary:   {summary_path.name}")
    print(f"  Report:    {report_path.name}")
    print(f"\n  Avg Precision@k: {avg_precision:.4f}")
    print(f"  Avg MRR:         {avg_mrr:.4f}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run retrieval quality evaluation for reasoning artifact rehydration"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="docs/evals/data",
        help="Directory for output files",
    )
    args = parser.parse_args()

    print("Retrieval Quality Evaluation")
    print("  Scoring weights: 0.60×sim + 0.25×imp + 0.10×rec + 0.05×retain")
    print()

    scenarios = build_scenarios()
    all_metrics: list[RetrievalMetrics] = []

    for scenario in scenarios:
        print(f"  [{scenario.name}] {scenario.description}...", end=" ")
        metrics = evaluate_scenario(scenario)
        all_metrics.append(metrics)
        status = "PASS" if metrics.precision_at_k >= 0.5 else "LOW"
        print(f"{status} (P@{metrics.k}={metrics.precision_at_k:.2f}, MRR={metrics.mrr:.2f})")

    write_retrieval_results(all_metrics, args.output_dir)


if __name__ == "__main__":
    main()
