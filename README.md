# Opus Nx

## Open-source platform for persistent AI reasoning research

Opus Nx turns model reasoning traces into persistent, inspectable artifacts you can explore, verify, rerun, and improve. Every thinking step becomes a node in a navigable graph — not a black box.

This repository is positioned for research and open-source collaboration. Run it locally with your own credentials.

<p align="center">
  <img src="images/ThinkGraph.png" alt="Opus Nx — Persistent Reasoning Graph" width="100%" />
  <br />
  <em>A live reasoning session: 17 thinking nodes, typed edges (influence, support, contradiction, refinement), compaction boundaries, and fork branches — all persisted and queryable.</em>
</p>

---

## Why Opus Nx

Most AI workflows keep only final answers. Opus Nx keeps the entire reasoning path and supports policy improvement over time.

| Standard AI UX | Opus Nx |
| --- | --- |
| Final answer only | Persistent reasoning graph artifacts |
| Single perspective | 6-agent swarm + 4-style branching workflows |
| Limited traceability | Decision points, typed edges, step verification, lifecycle state |
| Prompt-only iteration | Promote → rerun → compare → retain loops |
| Ephemeral context | 3-tier memory hierarchy (working → recall → archival) |

---

## See It In Action

> Full visual walkthrough with all screenshots: [`docs/features.md`](./docs/features.md)

### Persistent Reasoning Graphs (ThinkGraph)

Every extended thinking session becomes a graph of discrete reasoning steps — nodes scored for confidence, connected by typed edges showing how ideas flow, branch, and build on each other.

<p align="center">
  <img src="images/ThinkGraph2.png" alt="ThinkGraph — Reasoning nodes with typed edges" width="100%" />
  <br />
  <em>Reasoning nodes colored by type (thinking, compaction, fork branch) with edges showing influence, support, contradiction, and refinement relationships. Minimap in corner for navigation.</em>
</p>

### 6-Agent Swarm Orchestration

Deploy a swarm of 6 specialized AI agents that collaborate in real-time via WebSocket streaming. Maestro decomposes the problem, DeepThinker analyzes, Contrarian challenges, Verifier validates, Synthesizer merges, and Metacognition audits.

<p align="center">
  <img src="images/Swarm.png" alt="Agent Swarm — 6 specialists collaborating" width="100%" />
  <br />
  <em>The Synthesizer agent merging perspectives from all agents into a coherent framework, with live session stats (17 nodes, 62K tokens) and human-in-the-loop checkpoints.</em>
</p>

### Graph of Thoughts (GoT)

Explore problems using arbitrary reasoning graphs with BFS, DFS, or best-first search. Thoughts branch, aggregate, and get verified at each depth level — a visual implementation of Besta et al. (2023).

<p align="center">
  <img src="images/GoT2.png" alt="Graph of Thoughts — Tree search visualization" width="100%" />
  <br />
  <em>A 4-depth GoT tree with 8 branches. Each node shows its thought, confidence score (40%-94%), verification status (Verified/Aggregated), and reasoning path. Color-coded by depth level.</em>
</p>

### Step-by-Step Verification (PRM)

Process Reward Model verifies each reasoning step independently. See structured steps (CONSIDERATION → HYPOTHESIS → EVALUATION → CONCLUSION) with confidence scores, decision counts, and edge relationships.

<p align="center">
  <img src="images/Reasoning_Steps1.png" alt="Structured Reasoning — Step verification" width="100%" />
  <br />
  <em>13 structured reasoning steps extracted from a single thinking pass. Each step typed (Consideration, Hypothesis, Evaluation, Conclusion) with 1.6K thinking tokens and 13 decision points persisted.</em>
</p>

<p align="center">
  <img src="images/Reasoning_Steps4.png" alt="Reasoning conclusion and model output" width="100%" />
  <br />
  <em>Final steps: EVALUATION → MAIN CONCLUSION → MODEL OUTPUT. The reasoning chain ends with a persisted artifact showing both the internal deliberation and the final structured response.</em>
</p>

### ThinkFork — 4-Style Divergent Analysis

Fork any question into 4 concurrent reasoning styles: conservative, aggressive, balanced, and contrarian. Each branch reasons independently, then results are compared with confidence scores and key points.

<p align="center">
  <img src="images/Fork_Final.png" alt="ThinkFork — 4 divergent perspectives" width="48%" />
  <img src="images/Insights_Ideas.png" alt="Metacognitive Insights — Improvement ideas" width="48%" />
  <br />
  <em>Left: Fork analysis showing 4 perspectives with confidence scores (45%–82%) and synthesis. Right: Metacognitive Insights panel with 3 biases, 3 patterns, and 1 improvement idea detected.</em>
</p>

### Memory Hierarchy (MemGPT-inspired)

A 3-tier memory system: working context (active reasoning), recall buffer (recent history), and archival storage (long-term knowledge). Entries persist across sessions with semantic search and importance scoring.

<p align="center">
  <img src="images/Memory.png" alt="Memory Hierarchy — 3-tier MemGPT system" width="48%" />
  <img src="images/Session.png" alt="Session Stats — Token breakdown" width="48%" />
  <br />
  <em>Left: Memory hierarchy showing 4 entries in Main Context, 4 in Recall, with importance scores and source types. Right: Session stats with confidence breakdown and token usage visualization.</em>
</p>

---

## Current Capabilities

1. **ThinkGraph** — Persistent reasoning graphs with queryable nodes and typed edges
2. **ThinkFork** — 4-style branching, steering, and debate mode
3. **PRM Verification** — Step-level verification with structured reasoning extraction
4. **Agent Swarm** — 6-agent orchestration with WebSocket streaming
5. **Graph of Thoughts** — BFS/DFS/best-first search over thought trees
6. **Metacognitive Insights** — Bias detection, pattern recognition, improvement hypotheses
7. **Memory Hierarchy** — 3-tier MemGPT-style memory with semantic retrieval
8. **Hypothesis Lifecycle** — Promote → rerun → compare → retain loops
9. **Session Sharing** — Persistent sessions with replay and sharing
10. **Evaluation Harnesses** — Retrieval benchmarks and quality metrics

## Architecture

Two-service runtime with shared persistence:

```text
Browser
  -> Next.js web app (apps/web)
      -> packages/core reasoning modules
      -> packages/db Supabase access
      -> swarm proxy routes
  -> Python FastAPI swarm service (agents)
  -> Supabase Postgres + pgvector
```

See full architecture details: [`docs/architecture.md`](./docs/architecture.md)

## Quick Start

### One-Command Setup

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
./scripts/dev-start.sh
```

The setup script handles everything: prerequisites check, dependency install, env bootstrap, connection verify, build, and launch. It will prompt you for API credentials on first run.

### Docker Quick Start (Local Database)

Run everything locally with just an Anthropic API key — no Supabase cloud account needed. Data stays on your machine.

**Prerequisites**: Docker, Node.js 22+, pnpm. Optional: Python 3.12+ and [uv](https://docs.astral.sh/uv/) for the agent swarm.

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
./scripts/docker-start.sh
```

The script handles everything: checks prerequisites, copies `.env.docker` to `.env`, prompts for your Anthropic API key, starts a local PostgreSQL + pgvector database in Docker, installs all dependencies, builds the project, and launches the dev servers.

When it's done, open **http://localhost:3000** in your browser.

**Or step by step:**

```bash
cp .env.docker .env
# Edit .env → add your ANTHROPIC_API_KEY

docker compose -f docker-compose.local.yml up -d    # Start local DB
pnpm install && pnpm build && pnpm dev              # Install, build, run
```

| Service | URL | Purpose |
|---------|-----|---------|
| Dashboard | `http://localhost:3000` | Next.js web app — open this in your browser |
| Agent Swarm | `http://localhost:8000` | Python FastAPI backend (auto-starts if uv is installed) |
| REST API | `http://localhost:54321` | Supabase-compatible DB API (used internally) |
| PostgreSQL | `localhost:54322` | Direct DB access (psql, pgAdmin) |

```bash
# Lifecycle
./scripts/docker-start.sh --stop       # Stop everything (dev servers + database)
./scripts/docker-start.sh --reset      # Wipe database and start fresh
./scripts/docker-start.sh --db-only    # Start only the database (no dev servers)

# Database access
docker exec -it opus-nx-postgres psql -U postgres -d opus_nx  # Direct SQL access
docker compose -f docker-compose.local.yml logs -f postgres   # Stream DB logs
```

### Manual Setup

#### 1) Prerequisites

1. Node.js >= 22
2. pnpm 9.x
3. Python 3.12+
4. uv

#### 2) Install

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
pnpm install
```

#### 3) Bootstrap local env

```bash
pnpm setup
```

This creates `.env` and `agents/.env` if missing and aligns `AUTH_SECRET` across both files.

#### 4) Add your own credentials

Required values:

1. `ANTHROPIC_API_KEY`
2. `AUTH_SECRET`
3. `SUPABASE_URL`
4. `SUPABASE_SERVICE_ROLE_KEY`
5. `SUPABASE_ANON_KEY`

#### 5) Verify setup

```bash
pnpm setup:verify
```

#### 6) Run

```bash
pnpm dev
```

Optional local swarm backend:

```bash
cd agents
uv run uvicorn src.main:app --reload --port 8000
```

## Credential Ownership Model

Use your own provider accounts and keys.

- Do not rely on maintainer personal credentials
- Keep `AUTH_SECRET` consistent across web and agents
- Treat demo mode as optional (`DEMO_MODE=true` only when intentionally enabled)

## Key Commands

```bash
pnpm dev                        # Start all dev servers
pnpm lint                       # Lint all packages
pnpm typecheck                  # Type-check all packages
pnpm test                       # Run tests
pnpm db:migrate                 # Run Supabase migrations
pnpm setup                      # Bootstrap env files
pnpm setup:verify               # Verify API connections
./scripts/dev-start.sh          # Full setup + launch (recommended)
./scripts/docker-start.sh       # Docker local DB + dev servers
./scripts/docker-start.sh --db-only  # Docker DB only (no dev servers)
```

Agent tests:

```bash
cd agents
uv run pytest
```

## API Groups

### Reasoning

- `POST /api/thinking` — Extended thinking request
- `POST /api/thinking/stream` — SSE streaming for thinking deltas
- `POST /api/fork` — ThinkFork parallel reasoning
- `POST /api/verify` — PRM step-by-step verification
- `POST /api/got` — Graph of Thoughts reasoning

### Sessions and Artifacts

- `GET/POST /api/sessions` — List/create sessions
- `GET /api/sessions/[sessionId]/nodes` — Get thinking nodes
- `GET /api/reasoning/[id]` — Get reasoning node details

### Swarm

- `POST /api/swarm` — Initiate multi-agent swarm
- `GET /api/swarm/token` — WebSocket auth token
- `POST /api/swarm/[sessionId]/checkpoint` — Human-in-the-loop checkpoint

### Memory

- `GET/POST /api/memory` — Hierarchical memory operations
- `GET/POST /api/insights` — Metacognitive insights

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Claude Opus 4.6 (50K extended thinking budget) |
| Dashboard | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Agent Swarm | Python 3.12, FastAPI, Anthropic SDK, NetworkX |
| Database | Supabase (PostgreSQL + pgvector with HNSW indexes) |
| Visualization | @xyflow/react (react-flow) |
| Deployment | Vercel (dashboard) + Fly.io (agents) |
| Runtime | Node.js 22+, TypeScript 5.7+ |
| Testing | Vitest 4, Playwright, pytest |

## Research Foundation

Implemented concepts are grounded in:

| Paper | Module | Key Contribution |
|-------|--------|-----------------|
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023) | ThinkFork | BFS/DFS search over reasoning trees with state evaluation |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | PRM Verifier | Process supervision — verify each reasoning step independently |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023) | GoT Engine | Arbitrary thought graph topology with aggregation and refinement |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023) | Memory Hierarchy | 3-tier memory hierarchy with paging and auto-eviction |

See:

- [`docs/reasoning-artifacts-research-charter.md`](./docs/reasoning-artifacts-research-charter.md)
- [`docs/evals/reasoning-artifacts-v1.md`](./docs/evals/reasoning-artifacts-v1.md)
- [`RESEARCH.md`](./RESEARCH.md)

## Documentation Map

- Visual feature guide: [`docs/features.md`](./docs/features.md)
- Canonical docs index: [`docs/README.md`](./docs/README.md)
- PRD: [`docs/prd.md`](./docs/prd.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Runbooks: [`docs/runbooks/`](./docs/runbooks)
- Historical docs archive: [`docs/archive/build-history/`](./docs/archive/build-history)

## Contributing

Contributions are welcome.

- Contribution guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

Priority areas:

1. Reasoning quality and evaluation rigor
2. Setup ergonomics and onboarding
3. Lifecycle and experiment UX
4. Reliability and observability

## Built By

**[Ozzy](https://omerakben.com)** — AI Engineer & Full-Stack Developer

**[TUEL AI](https://tuel.ai)** — AI Research Platform

**[Claude](https://www.anthropic.com/news/claude-opus-4-6)** — AI Research Partner (Anthropic)

A human + AI collaboration exploring persistent reasoning artifacts.

## License

MIT
