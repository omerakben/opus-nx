# Research Mindset and Operating Model

## 1. Principle

Treat reasoning as an artifact lifecycle, not a one-shot response stream.

## 2. Core Research Loop

1. Observe: capture structured reasoning artifacts per run.
2. Hypothesize: identify candidate policy improvements.
3. Intervene: rerun with controlled corrections or prompts.
4. Evaluate: compare quality and efficiency deltas.
5. Retain: promote winning policies and archive weak alternatives.

## 3. Experimental Discipline

### 3.1 What We Track

1. Quality metrics: verifier score, contradiction rate, synthesis confidence.
2. Efficiency metrics: time-to-policy, reruns, token cost.
3. Retrieval metrics: precision@k, MRR, cross-session hit rate.
4. Human impact metrics: checkpoint acceptance and correction uptake.

### 3.2 What Counts as Evidence

1. Repeatable improvement across benchmark tasks.
2. Measured tradeoff, not single-metric optimization.
3. Clear attribution between intervention and quality lift.

## 4. Repository Ground Rules

1. Preserve historical context in archive docs.
2. Keep canonical docs current with implementation changes.
3. Require tests for behavioral changes.
4. Prefer explicit assumptions and measurable acceptance criteria.

## 5. Contribution Mindset

Contributions should improve at least one of:

1. Reasoning quality
2. Reproducibility
3. Inspectability
4. Setup and contributor ergonomics

## 6. Publication-Ready Thinking

When proposing major changes, frame them as:

1. Why this matters scientifically or operationally.
2. What mechanism is changing.
3. How it will be evaluated.
4. So what impact we expect.

## 7. Open Research Questions

The following gaps represent areas where Opus Nx can contribute new findings:

1. **Persistent reasoning retrieval**: What retrieval strategies (semantic, graph-based, hybrid) yield the highest quality lift when reusing prior reasoning artifacts across sessions?
2. **Multi-agent vs single-model tradeoff**: Under what task complexity thresholds does swarm deliberation outperform a single model with equivalent token budget?
3. **Process reward model transfer**: Does step-level verification generalize from structured domains (math, logic) to open-ended analysis (research, strategy)?
4. **Memory eviction policy**: What eviction strategies for the 3-tier memory hierarchy maximize downstream reasoning quality per token spent?
5. **Checkpoint intervention granularity**: At what frequency and specificity do human-in-the-loop corrections yield the highest quality improvement per intervention?
6. **Metacognitive drift detection**: Can self-reflection reliably detect reasoning degradation across long sessions before it impacts output quality?

## 8. Benchmarks and Baselines

Evaluation infrastructure lives in `agents/src/evals/` and supports:

- **Live harness**: End-to-end swarm reasoning evaluation against benchmark task sets.
- **Retrieval benchmarks**: Precision@k, MRR, and cross-session hit rate for the knowledge base and memory hierarchy.
- **CI integration**: Automated evaluation runs via CI scripts for regression detection.

Run evaluations:

```bash
cd agents && uv run pytest src/evals/
```

Key baseline metrics to track:

| Metric | Source | Module |
|--------|--------|--------|
| Verifier score (geometric mean) | PRM step-level scoring | `prm-verifier.ts` |
| Contradiction rate | Multi-agent debate output | `swarm.py` |
| Synthesis confidence | Synthesizer agent output | `agents/synthesizer.py` |
| Precision@k | Knowledge retrieval | `memory-manager.ts` |
| MRR | Cross-session retrieval | `memory-manager.ts` |
| Token cost per quality unit | Orchestrator routing | `orchestrator.ts` |
| Checkpoint acceptance rate | Human-in-the-loop flow | Workspace UI |

## 9. Citation and Attribution

If you use Opus Nx in your research, see `RESEARCH.md` in the repository root for the recommended citation format.

Built by [Ozzy](https://omerakben.com) + [Claude](https://tuel.ai)
