# Opus Nx System Architecture

## Overview

Opus Nx is a research system for **persistent, analyzable, and improvable LLM reasoning**. It transforms Claude Opus 4.6's extended thinking into navigable reasoning graphs and deploys a 6-agent swarm for multi-perspective analysis, structured hypothesis management, and human-in-the-reasoning checkpoints.

**Primary thesis**: From Hidden Reasoning to Auditable Policies — an end-to-end system for persistent reasoning artifacts with measurable policy improvement.

## Architecture Summary

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Browser Client                              │
│  Next.js Dashboard (React 19, @xyflow/react, Tailwind CSS 4)        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ThinkGraph│ │  Swarm   │ │   GoT    │ │  Verify  │ │Hypothesis│  │
│  │   Tab    │ │   Tab    │ │   Tab    │ │   Tab    │ │  Panel   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
└───────┼────────────┼────────────┼────────────┼────────────┼──────────┘
        │ REST/SSE   │ WebSocket  │ REST/SSE   │ REST       │ REST
        ▼            ▼            ▼            ▼            ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Service 1: Next.js on Vercel                       │
│  API Routes: /api/think, /api/fork, /api/got, /api/verify,           │
│              /api/swarm (proxy), /api/sessions, /api/insights         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                   packages/core (9 engines)                     │  │
│  │  ThinkingEngine │ ThinkGraph │ Orchestrator │ MetacognitionEngine│ │
│  │  ThinkFork │ PRMVerifier │ GoTEngine │ MemoryHierarchy │ MemMgr │ │
│  │  CircuitBreaker (shared)                                        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │ HMAC-authenticated proxy
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                  Service 2: Python FastAPI on Fly.io                   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    SwarmManager (3-phase)                       │   │
│  │  Phase 1: DeepThinker + Contrarian + Verifier (parallel)      │   │
│  │  Phase 2: Synthesizer (sequential)                             │   │
│  │  Phase 3: MetacognitionAgent (sequential)                      │   │
│  │  + Reasoning Rehydration (pre-query)                           │   │
│  │  + Hypothesis Lifecycle (promote → rerun → compare → retain)  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│  SharedReasoningGraph (NetworkX) │ EventBus │ SupabasePersistence     │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL + pgvector)                    │
│  thinking_nodes │ reasoning_edges │ decision_points │ sessions        │
│  reasoning_artifacts │ structured_reasoning_{steps,hypotheses}        │
│  hypothesis_experiments │ hypothesis_experiment_actions               │
│  session_rehydration_runs │ metacognitive_insights                    │
│  RPC: match_reasoning_artifacts, match_structured_reasoning_hypotheses│
│  Indexes: HNSW (vector_cosine_ops, m=16, ef=64)                      │
└───────────────────────────────────────────────────────────────────────┘
```

## Novel Research Contributions

### 1. Persistent Decision Graphs (ThinkGraph)

**Module**: `packages/core/src/think-graph.ts`

ThinkGraph parses Claude's extended thinking output into a persistent graph of reasoning nodes, decision points, and edges. Unlike systems that store only final outputs, ThinkGraph captures the *structure* of reasoning — branches, confidence scores, rejection rationales, and alternative paths.

Key capabilities:
- Automatic extraction of decision points from extended thinking blocks
- Confidence scoring per node with propagation across edges
- Session-level graph persistence via Supabase
- Cross-session graph comparison for hypothesis lifecycle

### 2. Self-Reflection via Extended Thinking (MetacognitionEngine)

**Module**: `packages/core/src/metacognition.ts`

MetacognitionEngine uses Claude Opus 4.6's 50,000-token extended thinking budget for systematic self-reflection. It analyzes reasoning patterns across sessions, detects biases, and produces structured metacognitive insights.

Key capabilities:
- 50k thinking token budget (maximum effort level)
- Cross-session pattern analysis
- Bias detection and reasoning quality audit
- Structured insight generation with confidence calibration

### 3. Multi-Perspective Convergent Debate (ThinkFork)

**Module**: `packages/core/src/thinkfork.ts`

ThinkFork enables 4-style concurrent reasoning (conservative, aggressive, balanced, contrarian) with convergence detection and steering. It models the multi-perspective analysis pattern from ensemble reasoning literature.

Key capabilities:
- 4 reasoning styles running in parallel
- Convergence detection across styles
- Mid-reasoning steering (user can bias toward a style)
- Debate mode for direct style-to-style argumentation

### 4. Reasoning Artifact Rehydration Pipeline

**Module**: `agents/src/swarm.py` (`_build_reasoning_rehydration_context`)

The rehydration pipeline retrieves semantically similar reasoning artifacts from prior sessions and injects them as hypotheses for the current query. This closes the loop between past reasoning and future quality.

Candidate scoring formula:
```
score = 0.60 × similarity + 0.25 × importance + 0.10 × recency + 0.05 × retained_policy_bonus
```

Pipeline stages:
1. **Embed**: Generate Voyage-3 (1024-dim) embedding for the query
2. **Search**: Parallel RPC calls to `match_reasoning_artifacts` and `match_structured_reasoning_hypotheses`
3. **Score**: Compute composite scores with importance, recency, and retained policy bonus
4. **Dedup**: Remove duplicates by `session_id:content_hash` (keep highest score)
5. **Cross-session preference**: Prefer artifacts from different sessions
6. **Select**: Top-4 candidates injected as prior hypotheses

### 5. Hypothesis Lifecycle Management

**Module**: `agents/src/server.py` (experiment endpoints), `packages/db/src/hypothesis-experiments.ts`

The hypothesis lifecycle converts ephemeral reasoning outputs into testable, comparable, and retainable knowledge policies:

```
promote → rerun → compare → retain/archive
            ↑                    │
            └── human feedback ──┘
```

States: `promoted` → `checkpointed` → `rerunning` → `comparing` → `retained` | `archived`

Human-in-the-reasoning checkpoint verdicts: `agree`, `disagree`, `explore`, `note`

## 9 Reasoning Engines

| # | Engine | Module | Purpose | Research Relevance |
|---|--------|--------|---------|-------------------|
| 1 | ThinkingEngine | `thinking-engine.ts` | Claude Opus 4.6 wrapper with adaptive effort (low/medium/high/max) | Foundation for all reasoning; effort routing |
| 2 | ThinkGraph | `think-graph.ts` | Parse reasoning into persistent graph nodes | **Novel**: Persistent Decision Graphs |
| 3 | Orchestrator | `orchestrator.ts` | Dynamic effort routing, token budget enforcement | Resource-aware reasoning |
| 4 | MetacognitionEngine | `metacognition.ts` | Self-reflection with 50k thinking budget | **Novel**: Extended thinking self-reflection |
| 5 | ThinkFork | `thinkfork.ts` | 4-style concurrent reasoning with debate | **Novel**: Multi-perspective convergent debate |
| 6 | PRMVerifier | `prm-verifier.ts` | Process Reward Model step-by-step verification | Step-level quality validation |
| 7 | GoTEngine | `got-engine.ts` | Graph of Thoughts with BFS/DFS/best-first search | Thought topology exploration |
| 8 | MemoryHierarchy | `memory-hierarchy.ts` | 3-tier memory (working/recall/archival) with eviction | Session memory management |
| 9 | MemoryManager | `memory-manager.ts` | Voyage AI embeddings, semantic search, knowledge storage | Semantic knowledge retrieval |

## 6-Agent Swarm

| Agent | Role | Phase |
|-------|------|-------|
| Maestro | Decomposes queries, selects agents, assigns subtasks | Pre-phase |
| DeepThinker | Extended reasoning with maximum thinking budget | Phase 1 (parallel) |
| Contrarian | Challenges assumptions, finds counterarguments | Phase 1 (parallel) |
| Verifier | Validates reasoning steps and agent outputs | Phase 1 (parallel) |
| Synthesizer | Merges diverse outputs into coherent conclusions | Phase 2 (sequential) |
| MetacognitionAgent | Audits swarm reasoning for biases and patterns | Phase 3 (sequential) |

### Swarm Execution Pipeline

```
Query → Rehydration → Maestro Planning → Phase 1 (parallel) → Phase 2 → Phase 3 → Result
  │         │               │                  │                │          │
  │    Retrieve prior   Task decomp      3 agents run      Synthesize  Metacognitive
  │    artifacts        + agent          simultaneously    into single   audit of
  │    from pgvector    selection                          conclusion    reasoning
  │                                                                     quality
  └──────────────────────────────────────────────────────────────────────────────────┘
                                    Event Bus (WebSocket streaming)
```

## Data Architecture

### Core Tables

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `thinking_nodes` | Reasoning graph nodes with content and confidence | B-tree on session_id |
| `reasoning_edges` | Directed edges between thinking nodes | B-tree on source/target |
| `decision_points` | Extracted decision alternatives with chosen path | B-tree on node_id |
| `reasoning_artifacts` | Semantic artifacts for cross-session rehydration | HNSW on embedding (1024-dim) |
| `structured_reasoning_steps` | Normalized reasoning steps (analysis, hypothesis, etc.) | B-tree on thinking_node_id |
| `structured_reasoning_hypotheses` | Hypothesis records with status tracking | HNSW on embedding; unique on (node_id, text_hash) |
| `hypothesis_experiments` | Lifecycle state machine for promoted hypotheses | B-tree on session_id, status |
| `hypothesis_experiment_actions` | Append-only action log for experiments | B-tree on experiment_id |
| `session_rehydration_runs` | Audit trail of rehydration candidate selection | B-tree on session_id |

### Vector Search (pgvector)

Both RPC functions use cosine similarity with HNSW indexes:

- **`match_reasoning_artifacts`**: Searches reasoning artifacts with optional session/type filters
- **`match_structured_reasoning_hypotheses`**: Searches hypotheses with retained policy bonus scoring

Index configuration: `m=16, ef_construction=64` (balanced for insert speed and recall quality).

## Evaluation Framework

### Benchmark Tasks

20 tasks across 4 categories (`configs/evals/reasoning-artifacts-benchmark.v2.json`):

| Category | Count | Difficulty Range | Focus |
|----------|-------|-----------------|-------|
| Analytical Reasoning | 5 | 0.56–0.68 | Tradeoff analysis, system reasoning |
| Adversarial/Conflict | 5 | 0.64–0.72 | Conflicting evidence, assumption detection |
| High-Stakes Decisions | 5 | 0.69–0.76 | Risk framing, regulatory reasoning |
| Ambiguous Synthesis | 5 | 0.58–0.67 | Uncertainty navigation, open synthesis |

### Evaluation Harnesses

| Harness | Script | Purpose |
|---------|--------|---------|
| Live eval | `pnpm eval:live` | Full SwarmManager pipeline with real Claude API calls |
| Dry-run eval | `pnpm eval:live:dry` | Mock LLM for CI-safe validation |
| Retrieval eval | `pnpm eval:retrieval` | Precision@k and MRR for rehydration pipeline |
| Synthetic eval | `pnpm eval:reasoning` | Deterministic metrics with synthetic noise |

### Metrics

**Quality**: verifier_score, contradiction_rate, synthesis_confidence
**Efficiency**: total_tokens, total_duration_ms, agent_count, error_count
**Retrieval**: precision@k, MRR, cross-session hit rate
**Lifecycle**: promoted count, retained rate, checkpoint acceptance rate

## Research Foundation

| Paper | Module | Contribution |
|-------|--------|-------------|
| Tree of Thoughts (Yao et al., 2023) | ThinkFork | BFS/DFS search over reasoning trees |
| Let's Verify Step by Step (Lightman et al., 2023) | PRMVerifier | Process supervision per reasoning step |
| Graph of Thoughts (Besta et al., 2023) | GoTEngine | Arbitrary thought graph topology |
| MemGPT (Packer et al., 2023) | MemoryHierarchy | 3-tier memory with paging and eviction |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| LLM | Claude Opus 4.6 (50k extended thinking budget) |
| Dashboard | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Agent Swarm | Python 3.12, FastAPI, Anthropic SDK, NetworkX |
| Database | Supabase (PostgreSQL + pgvector, HNSW indexes) |
| Embeddings | Voyage AI (voyage-3, 1024-dim) |
| Visualization | @xyflow/react |
| Deployment | Vercel (dashboard) + Fly.io (agents) |
| Testing | Vitest (691 TS tests), pytest (256 Python tests) |
