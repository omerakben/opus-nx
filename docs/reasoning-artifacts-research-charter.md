# Reasoning Artifacts Research Charter

## Title

From Trace to Policy: A WHY-WHAT-HOW-SO-WHAT Cycle for Reasoning Artifacts in LLM Systems

## Thesis

Reasoning should not be treated as disposable token output. Reasoning steps, hypotheses, decisions, and metacognitive critiques should be persisted as reusable artifacts that can be retrieved, tested, compared, and promoted into better future reasoning policies.

Human feedback checkpoints are part of the reasoning system itself, not post-hoc review.

## WHY

Current LLM systems are strong at one-off answers but weak at iterative learning from their own reasoning process.

Core gaps we will close:

1. Historical reasoning is mostly write-only and weakly reused across sessions.
2. `structured_reasoning` is stored but not deeply queryable at hypothesis granularity.
3. Reasoning retrieval relies mostly on lexical search instead of semantic similarity.
4. UI supports inspection, but not a full hypothesis experiment lifecycle.

## WHAT

We introduce a Reasoning Artifact Cycle with five artifact classes:

1. Step artifacts: `analysis`, `hypothesis`, `evaluation`, `consideration`, `conclusion`.
2. Decision artifacts: alternatives, chosen path, confidence, rejection rationale.
3. Retrieval artifacts: semantic embeddings and ranked similar reasoning candidates.
4. Policy artifacts: retained or archived hypotheses after rerun comparison.
5. Human checkpoint artifacts: explicit human judgments/corrections tied to rerun outcomes.

## HOW

### System design

1. Persist step-level artifacts in normalized tables (not only JSONB blobs).
2. Build a reasoning artifact vector index with Voyage embeddings.
3. Rehydrate prior artifacts into new sessions with ranking (semantic + importance + recency).
4. Add a lifecycle workflow: promote alternative -> rerun -> compare -> retain policy.
5. Add a human-in-the-loop checkpoint workflow: review -> agree/disagree/correct -> rerun -> compare -> retain.

### Architecture stance

1. Primary store and retrieval: Supabase + pgvector + Voyage.
2. Neo4j: optional graph analytics and visualization, not primary semantic retrieval.
3. Rollout: schema first, then ingestion/retrieval, then lifecycle API, then UI loop.

## Human-In-The-Reasoning Definition

Human-in-the-reasoning means humans intervene at explicit decision checkpoints inside the reasoning loop, not only after final answer generation.

Checkpoint actions:

1. `agree`: validate current path and increase confidence to proceed.
2. `disagree`: reject current path and supply corrective guidance.
3. `explore`: request a targeted alternative path.
4. `note`: record constraints or context without forcing rerun.

## SO-WHAT

### Scientific contribution

1. Converts hidden chain-of-thought fragments into explicit, testable artifacts.
2. Makes reasoning quality improvable by experiment, not only by prompt edits.
3. Establishes a reproducible pipeline for iterative reasoning policy learning.
4. Treats human checkpoint feedback as a measurable causal variable in quality and efficiency.

### Product contribution

1. Better consistency on repeated or similar problems.
2. Faster convergence on high quality answers with less redundant exploration.
3. Explainable improvement path with auditable experiment history.
4. Clearer Human+AI collaboration contract with measurable ROI.

## Research Questions

1. Does artifact rehydration improve answer quality on similar future tasks?
2. Do step-level indexed hypotheses improve retrieval precision over text-only search?
3. Does semantic reasoning retrieval (Voyage) reduce time-to-good-answer?
4. Does lifecycle UX increase the rate of retained high-value reasoning policies?
5. Do human checkpoints improve output quality beyond autonomous reruns?
6. Do human checkpoints reduce iteration cost (tokens/time) to reach retained policies?

## Testable Hypotheses

1. H1: Rehydration increases verifier score and final confidence on matched tasks.
2. H2: Normalized step/hypothesis indexing improves retrieval precision@k versus FTS-only.
3. H3: Voyage-based reasoning retrieval improves rerun win-rate versus recency baseline.
4. H4: Lifecycle workflow reduces abandoned hypotheses and increases retained policies.
5. H5: Human checkpoint corrections increase rerun quality delta versus no-checkpoint reruns.
6. H6: Adaptive checkpoints reduce median time-to-retained-policy versus fixed checkpoints.

## Measurement Plan

Primary metrics:

1. Quality delta: verifier score, contradiction rate, consensus score.
2. Retrieval quality: precision@k, MRR, semantic recall on labeled similar prompts.
3. Iteration efficiency: reruns to acceptable answer, median time-to-retained-policy.
4. Adoption: promoted hypotheses, compare completion rate, retain/defer/archive ratios.
5. Human impact: checkpoint acceptance rate, correction uptake rate, checkpoint-to-improvement lift.

Guardrail metrics:

1. Latency added by retrieval and comparison steps.
2. Token overhead from rehydration context.
3. Cost per successful retained policy.
4. Human burden: checkpoints per successful retained policy.

## Human Checkpoint Evaluation Design

Compare three modes on the same benchmark task set:

1. Autonomous: no human checkpoint.
2. Fixed checkpoint: one checkpoint at a predefined stage.
3. Adaptive checkpoint: checkpoint only when uncertainty/risk triggers fire (for example low confidence, high contradiction, high branch divergence).

Report:

1. Quality gain over autonomous baseline.
2. Time/token cost to reach retained policy.
3. Human effort required per gain unit.

## Novelty Claim

Most systems store outcomes. This system stores reasoning process artifacts and closes the loop from hypothesis generation to policy retention. The novelty is not only persistence, but operationalizing reasoning artifacts as an experiment lifecycle with measurable policy improvement.

The additional novelty is treating human checkpoint feedback as a first-class, measurable variable in the same lifecycle.

## Execution Plan (Mapped to Codebase)

Phase 1: Data foundation

1. Add artifact and lifecycle tables in `supabase/migrations/`. **DONE** — migrations 012-014.
2. Extend DB access in `packages/db/src/`. **DONE** — `reasoning-artifacts.ts`, `structured-reasoning.ts`, `hypothesis-experiments.ts`, `supabase-error.ts`.

Phase 2: Artifact ingestion and retrieval

1. Extend persistence in `packages/core/src/think-graph.ts`. **DONE** — reasoning graph persistence with circuit breaker.
2. Add Voyage-based reasoning embeddings via `packages/core/src/memory-manager.ts`. **DONE** — 1024-dim Voyage-3 embeddings.
3. Add rehydration query paths in `agents/src/persistence/supabase_sync.py`. **DONE** — `search_reasoning_artifacts`, `search_structured_reasoning_hypotheses_semantic`, `create_session_rehydration_run`.

Phase 3: Swarm integration

1. Add experiment endpoints in `agents/src/server.py`. **DONE** — experiment CRUD, action logging, experiment listing.
2. Add rerun and lifecycle event hooks in `agents/src/swarm.py`. **DONE** — `rerun_with_correction`, reasoning rehydration pipeline, lifecycle events.
3. Add explicit checkpoint telemetry in `agents/src/server.py`. **DONE** — expanded verdict set (agree/disagree/explore/note), experiment_id flow.

Phase 4: UX loop

1. Add hypothesis panel in `apps/web/src/components/swarm/SwarmHypothesisPanel.tsx`. **DONE** — promote action, experiment display.
2. Add experiment API routes in `apps/web/src/app/api/swarm/`. **DONE** — experiment endpoints.
3. Add API client and hook updates in `apps/web/src/lib/`. **DONE** — `api.ts`, `use-swarm.ts`, `swarm-client.ts`.
4. Human-checkpoint UI polish and impact summaries. **IN PROGRESS** — basic checkpoint flow works; comparison charts pending.

## Implementation Status

### Hypothesis Readiness

| Hypothesis | Infrastructure | Evaluation | Status |
|-----------|---------------|-----------|--------|
| H1: Rehydration quality lift | Rehydration pipeline in `swarm.py`, artifact persistence | Live eval harness (`pnpm eval:live`) with verifier_score tracking | **Ready to test** |
| H2: Step/hypothesis indexing precision | HNSW indexes, normalized tables, `match_*` RPCs | Retrieval eval (`pnpm eval:retrieval`) with precision@k, MRR | **Ready to test** |
| H3: Semantic retrieval vs recency | Voyage embeddings, composite scoring (sim+imp+rec+retain) | Retrieval eval scenarios (cross-session, recency tiebreaker) | **Ready to test** |
| H4: Lifecycle adoption rate | Full lifecycle state machine, experiment actions audit trail | Live eval tracks completion_rate; lifecycle metrics need dashboard | **Partially ready** |
| H5: Checkpoint quality delta | Checkpoint verdicts, rerun_with_correction, experiment comparison | Need checkpoint ROI eval harness (3-mode comparison) | **Infrastructure ready** |
| H6: Adaptive vs fixed checkpoint | Checkpoint triggers, session-level metrics | Need checkpoint ROI eval harness | **Infrastructure ready** |

### Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| Core TS engines (9 engines + circuit breaker) | 289 tests across 9 suites | High |
| DB modules (4 modules) | 146 tests across 8 files | High |
| Python agents (4 agents + swarm + persistence) | 256 tests, 2 skipped | Medium-high |
| Evaluation framework | 3 harnesses, 20 benchmark tasks, 8 retrieval scenarios | Functional |

### Evaluation Infrastructure

| Harness | Command | Hypotheses Tested |
|---------|---------|-------------------|
| Live eval (dry-run) | `pnpm eval:live:dry` | H1 (verifier score, contradiction rate, synthesis confidence) |
| Live eval (real) | `pnpm eval:live` | H1, H4 (requires ANTHROPIC_API_KEY) |
| Retrieval quality | `pnpm eval:retrieval` | H2, H3 (precision@k=0.625, MRR=0.8125 baseline) |
| Synthetic metrics | `pnpm eval:reasoning` | H1 (deterministic noise, no LLM calls) |

## Publication-ready WHY-WHAT-HOW-SO-WHAT Summary

WHY: LLM reasoning quality degrades when reasoning traces are disposable and human feedback is not structurally integrated.
WHAT: A reasoning artifact system with step, decision, retrieval, policy, and human checkpoint artifacts.
HOW: Normalized schemas, semantic retrieval, rehydration ranking, hypothesis lifecycle workflow, and checkpoint interventions.
SO-WHAT: Measurable quality and iteration gains, with auditable Human+AI collaboration and reproducible reasoning improvement.
