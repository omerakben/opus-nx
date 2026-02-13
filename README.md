# Opus Nx

## Open-source platform for persistent AI reasoning research

Opus Nx turns model reasoning traces into persistent, inspectable artifacts you can explore, verify, rerun, and improve.

This repository is now positioned for research and open-source collaboration.

- Primary CTA: run locally with your own credentials
- Public entry: `GET /`
- Authenticated app: `GET /workspace`
- Access route: `GET /login`

## Why Opus Nx

Most AI workflows keep only final answers. Opus Nx keeps the reasoning path and supports policy improvement over time.

| Standard AI UX | Opus Nx |
| --- | --- |
| Final answer only | Persistent reasoning graph artifacts |
| Single perspective | Multi-agent swarm + branching workflows |
| Limited traceability | Decision points, edges, verification, and lifecycle state |
| Prompt-only iteration | Promote -> rerun -> compare -> retain loops |

## Current Capabilities

1. ThinkGraph persistence with queryable nodes and edges
2. ThinkFork branching and steering
3. PRM-style step verification
4. Swarm orchestration with event streaming
5. Metacognitive insights
6. Hypothesis lifecycle workflows
7. Session sharing and replay
8. Evaluation harnesses for retrieval and quality metrics

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

### 1) Prerequisites

1. Node.js >= 22
2. pnpm 9.x
3. Python 3.12+
4. uv

### 2) Install

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
pnpm install
```

### 3) Bootstrap local env

```bash
pnpm setup
```

This creates `.env` and `agents/.env` if missing and aligns `AUTH_SECRET` across both files.

### 4) Add your own credentials

Required values:

1. `ANTHROPIC_API_KEY`
2. `AUTH_SECRET`
3. `SUPABASE_URL`
4. `SUPABASE_SERVICE_ROLE_KEY`
5. `SUPABASE_ANON_KEY`

### 5) Verify setup

```bash
pnpm setup:verify
```

### 6) Run

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
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm setup
pnpm setup:verify
```

Agent tests:

```bash
cd agents
uv run pytest
```

## API Groups

### Reasoning

- `POST /api/thinking`
- `POST /api/thinking/stream`
- `POST /api/fork`
- `POST /api/verify`
- `POST /api/got`

### Sessions and artifacts

- `GET/POST /api/sessions`
- `GET /api/sessions/[sessionId]/nodes`
- `GET /api/reasoning/[id]`

### Swarm

- `POST /api/swarm`
- `GET /api/swarm/token`
- `POST /api/swarm/[sessionId]/checkpoint`
- `POST /api/swarm/[sessionId]/experiments`

## Research Foundation

Implemented concepts are grounded in:

1. Tree of Thoughts
2. Let's Verify Step by Step
3. Graph of Thoughts
4. MemGPT-inspired memory hierarchy

See:

- [`docs/reasoning-artifacts-research-charter.md`](./docs/reasoning-artifacts-research-charter.md)
- [`docs/evals/reasoning-artifacts-v1.md`](./docs/evals/reasoning-artifacts-v1.md)

## Documentation Map

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
