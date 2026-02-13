#!/usr/bin/env python3
"""Live evaluation harness — runs real swarm sessions against benchmark tasks.

Unlike run_reasoning_eval.py (synthetic metrics), this harness executes the
full SwarmManager pipeline with actual (or mocked) LLM calls. Produces:
- Per-task JSON metrics
- Aggregate summary CSV
- Markdown report with hypothesis pass/fail analysis

Usage:
  # Dry run (CI-safe, uses mock LLM):
  python -m scripts.run_reasoning_eval_live --dry-run

  # Live run (requires ANTHROPIC_API_KEY):
  python -m scripts.run_reasoning_eval_live --benchmark configs/evals/reasoning-artifacts-benchmark.v2.json

  # Live run with task limit (for quick testing):
  python -m scripts.run_reasoning_eval_live --max-tasks 3
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Add parent directory to path for module imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.eval_utils import (
    SwarmEvalMetrics,
    compute_aggregate_metrics,
    extract_metrics_from_swarm_result,
    load_benchmark,
)


async def run_single_task(
    task: dict[str, Any],
    variant: str,
    *,
    dry_run: bool = False,
) -> SwarmEvalMetrics:
    """Run a single benchmark task through the swarm pipeline.

    Args:
        task: Benchmark task dict with 'id', 'prompt', etc.
        variant: Evaluation variant name (e.g., 'baseline_autonomous').
        dry_run: If True, use mock LLM (no API calls).

    Returns:
        Extracted evaluation metrics.
    """
    from src.config import Settings
    from src.events.bus import EventBus
    from src.graph.reasoning_graph import SharedReasoningGraph
    from src.swarm import SwarmManager

    session_id = f"eval-{task['id']}-{variant}-{uuid.uuid4().hex[:8]}"

    settings = Settings(
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY", "sk-ant-eval-placeholder"),
        supabase_url=os.environ.get("SUPABASE_URL", "http://localhost:54321"),
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "eval-key"),
        auth_secret=os.environ.get("AUTH_SECRET", "eval-secret"),
        agent_stagger_seconds=0.0 if dry_run else 2.5,
        agent_timeout_seconds=10 if dry_run else 120,
    )

    graph = SharedReasoningGraph()
    bus = EventBus()
    swarm = SwarmManager(settings, graph, bus, persistence=None)

    if dry_run:
        from unittest.mock import patch

        from tests.conftest import SmartMockAsyncAnthropic

        mock_client = SmartMockAsyncAnthropic()

        with patch("anthropic.AsyncAnthropic", return_value=mock_client):
            result = await swarm.run(task["prompt"], session_id)
    else:
        result = await swarm.run(task["prompt"], session_id)

    return extract_metrics_from_swarm_result(
        result,
        task_id=task["id"],
        variant=variant,
    )


async def run_evaluation(
    benchmark_path: str,
    output_dir: str,
    *,
    dry_run: bool = False,
    max_tasks: int | None = None,
    variants: list[str] | None = None,
) -> list[SwarmEvalMetrics]:
    """Run the full evaluation suite.

    Args:
        benchmark_path: Path to the benchmark JSON file.
        output_dir: Directory for output files.
        dry_run: If True, use mock LLM.
        max_tasks: Limit number of tasks to run.
        variants: List of variant names to evaluate.

    Returns:
        List of all evaluation metrics.
    """
    benchmark = load_benchmark(benchmark_path)
    tasks = benchmark["tasks"]

    if max_tasks:
        tasks = tasks[:max_tasks]

    if variants is None:
        variants = ["baseline_autonomous"]

    all_metrics: list[SwarmEvalMetrics] = []
    total = len(tasks) * len(variants)
    completed = 0

    for variant in variants:
        for task in tasks:
            completed += 1
            task_label = f"[{completed}/{total}] {task['id']} ({variant})"
            print(f"  Running {task_label}...", end=" ", flush=True)

            try:
                metrics = await run_single_task(task, variant, dry_run=dry_run)
                all_metrics.append(metrics)
                status = "OK" if metrics.error_count == 0 else f"PARTIAL ({metrics.error_count} errors)"
                print(f"{status} ({metrics.total_duration_ms}ms, {metrics.total_tokens} tokens)")
            except Exception as exc:
                print(f"FAILED: {exc}")
                all_metrics.append(SwarmEvalMetrics(
                    task_id=task["id"],
                    variant=variant,
                    session_id="error",
                    error_count=1,
                ))

    return all_metrics


def _resolve_repo_path(path: str) -> Path:
    """Resolve a path relative to the repository root."""
    p = Path(path)
    if p.is_absolute():
        return p
    repo_root = Path(__file__).resolve().parent.parent.parent
    return repo_root / path


def write_results(
    metrics: list[SwarmEvalMetrics],
    output_dir: str,
    benchmark_path: str,
    dry_run: bool,
) -> None:
    """Write evaluation results to disk."""
    out = _resolve_repo_path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    mode = "dry-run" if dry_run else "live"

    # Per-task CSV
    task_csv = out / f"eval-{mode}-{timestamp}-tasks.csv"
    fieldnames = [
        "task_id", "variant", "session_id",
        "verifier_score", "contradiction_rate", "synthesis_confidence",
        "total_tokens", "total_duration_ms",
        "agent_count", "error_count", "node_count", "edge_count",
    ]
    with task_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for m in metrics:
            writer.writerow(m.to_dict())

    # Aggregate summary by variant
    variants = sorted(set(m.variant for m in metrics))
    agg_rows = []
    for variant in variants:
        variant_metrics = [m for m in metrics if m.variant == variant]
        agg = compute_aggregate_metrics(variant_metrics)
        agg["variant"] = variant
        agg_rows.append(agg)

    summary_csv = out / f"eval-{mode}-{timestamp}-summary.csv"
    if agg_rows:
        agg_fields = list(agg_rows[0].keys())
        with summary_csv.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=agg_fields)
            writer.writeheader()
            for row in agg_rows:
                writer.writerow(row)

    # Markdown report
    report_path = out / f"eval-{mode}-{timestamp}-report.md"
    lines: list[str] = [
        f"# Live Evaluation Report ({mode})",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        f"Benchmark: `{benchmark_path}`",
        f"Tasks evaluated: {len(metrics)}",
        f"Variants: {', '.join(variants)}",
        "",
        "## Aggregate Summary",
        "",
    ]

    if agg_rows:
        lines.append("| Variant | Verifier | Contradiction | Synthesis Conf | Avg Tokens | Avg Duration (ms) | Error Rate | Completion Rate |")
        lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
        for row in agg_rows:
            lines.append(
                f"| {row['variant']} | {row.get('avg_verifier_score', 0):.3f} | "
                f"{row.get('avg_contradiction_rate', 0):.3f} | "
                f"{row.get('avg_synthesis_confidence', 0):.3f} | "
                f"{row.get('avg_total_tokens', 0):.0f} | "
                f"{row.get('avg_total_duration_ms', 0):.0f} | "
                f"{row.get('error_rate', 0):.2%} | "
                f"{row.get('completion_rate', 0):.2%} |"
            )

    lines.append("")
    lines.append("## Output Files")
    lines.append(f"- Task metrics: `{task_csv.name}`")
    lines.append(f"- Summary: `{summary_csv.name}`")
    lines.append(f"- This report: `{report_path.name}`")

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Run metadata JSON
    meta_path = out / f"eval-{mode}-{timestamp}-meta.json"
    meta_path.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "benchmark": benchmark_path,
        "task_count": len(metrics),
        "variants": variants,
        "files": {
            "tasks_csv": task_csv.name,
            "summary_csv": summary_csv.name,
            "report": report_path.name,
        },
    }, indent=2) + "\n", encoding="utf-8")

    print(f"\nResults written to {out}/")
    print(f"  Tasks:   {task_csv.name}")
    print(f"  Summary: {summary_csv.name}")
    print(f"  Report:  {report_path.name}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run live reasoning-artifact evaluation against benchmark tasks"
    )
    parser.add_argument(
        "--benchmark",
        type=str,
        default="configs/evals/reasoning-artifacts-benchmark.v2.json",
        help="Path to benchmark JSON file",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="docs/evals/data",
        help="Directory for output files",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Use mock LLM (no API calls, CI-safe)",
    )
    parser.add_argument(
        "--max-tasks",
        type=int,
        default=None,
        help="Maximum number of tasks to evaluate",
    )
    parser.add_argument(
        "--variants",
        nargs="+",
        default=None,
        help="Variant names to evaluate (default: baseline_autonomous)",
    )
    args = parser.parse_args()

    print("Reasoning Artifacts Live Evaluation")
    print(f"  Mode: {'dry-run (mock LLM)' if args.dry_run else 'live (real API calls)'}")
    print(f"  Benchmark: {args.benchmark}")
    print(f"  Max tasks: {args.max_tasks or 'all'}")
    print()

    metrics = asyncio.run(
        run_evaluation(
            benchmark_path=args.benchmark,
            output_dir=args.output_dir,
            dry_run=args.dry_run,
            max_tasks=args.max_tasks,
            variants=args.variants,
        )
    )

    write_results(
        metrics,
        output_dir=args.output_dir,
        benchmark_path=args.benchmark,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
