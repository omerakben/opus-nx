# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Opus Nx is a research system for persistent reasoning artifacts and hypothesis lifecycle management. It transforms Claude Opus 4.6's extended thinking into navigable reasoning graphs and deploys a swarm of 6 specialized AI agents for multi-perspective analysis. Reasoning steps, hypotheses, and decisions are persisted as reusable artifacts that can be retrieved, tested, compared, and promoted into better future reasoning policies.

**Key Innovation**: Extended thinking becomes persistent "ThinkGraph" nodes you can see, steer, verify, and build upon. A swarm of 6 AI agents (Maestro, DeepThinker, Contrarian, Verifier, Synthesizer, Metacognition) collaborate in real-time via WebSocket streaming.

**Two-Service Architecture** (cloud) or **all-local via Docker**:
- **Service 1**: Next.js Dashboard — Vercel (`https://opus-nx.vercel.app`) or local (`localhost:3000`)
- **Service 2**: Python Agent Swarm — Fly.io (`https://opus-nx-agents.fly.dev`) or local (`localhost:8000`)
- **Database**: Supabase cloud or local Docker (PostgreSQL 17 + pgvector + PostgREST)

## Commands

### Docker Local Setup (Recommended for Contributors)

```bash
./scripts/docker-start.sh              # Start DB + install deps + build + launch dev servers
./scripts/docker-start.sh --stop       # Stop everything (dev servers + Docker database)
./scripts/docker-start.sh --reset      # Wipe database volume and start fresh
./scripts/docker-start.sh --db-only    # Start only the local database
```

Only requires Docker, Node.js 22+, pnpm, and an `ANTHROPIC_API_KEY`. The script copies `.env.docker` → `.env` with pre-configured local DB credentials (PostgREST JWT tokens, Supabase-compatible URL at `localhost:54321`).

### Development (Supabase Cloud)

```bash
./scripts/dev-start.sh                 # Full setup + launch (Supabase cloud)
./scripts/dev-start.sh --docker        # Delegates to docker-start.sh
pnpm install              # Install dependencies
pnpm build                # Build all packages (Turborepo)
pnpm dev                  # Start all dev servers
pnpm --filter @opus-nx/web dev   # Start just the web dashboard
```

### Agent Swarm (Python)

```bash
cd agents
uv run uvicorn src.main:app --reload --port 8000  # Start Python backend
uv run ruff check src/                             # Lint Python code
uv run pytest                                      # Run Python tests
```

### Database

```bash
pnpm db:migrate           # Run Supabase migrations
pnpm db:generate          # Regenerate TypeScript types from Supabase
pnpm check:migrations     # Verify migration drift between supabase/ and packages/db/migrations/
docker exec -it opus-nx-postgres psql -U postgres -d opus_nx  # Direct SQL access (Docker)
```

### Quality

```bash
pnpm lint                 # Run linting
pnpm typecheck            # Type-check all packages
pnpm test                 # Run tests (includes migration drift check)
```

### Package-Specific

```bash
pnpm --filter @opus-nx/core test        # Run core package tests
pnpm --filter @opus-nx/web typecheck    # Type-check web only
```

## Architecture

### Monorepo Structure (Turborepo + pnpm workspaces)

```
apps/web/           -> Next.js 16 dashboard (App Router, Turbopack)
agents/             -> Python FastAPI swarm backend (Fly.io deployment)
  src/agents/       -> 6 specialized agents: maestro, deep_thinker, contrarian, verifier, synthesizer, metacognition, base
  src/graph/        -> SharedReasoningGraph (NetworkX)
  src/events/       -> Event bus + WebSocket streaming
  src/persistence/  -> Neo4j + Supabase sync
  src/server.py     -> FastAPI routes + WebSocket endpoints
  src/swarm.py      -> 3-phase swarm orchestration pipeline
packages/
  core/             -> ThinkingEngine, ThinkGraph, Orchestrator, Metacognition, ThinkFork, PRM
                       GoT Engine, MemoryHierarchy, MemoryManager
  db/               -> Supabase client, query functions, types
  shared/           -> Shared types, utilities, config loaders
docker/
  postgres/
    init.sql        -> Local DB bootstrap (schemas, roles, pgvector extension)
    run-migrations.sh -> Runs all SQL migrations on first container start
  nginx/
    nginx.conf      -> Gateway: strips /rest/v1/ prefix, proxies to PostgREST
configs/
  agents.yaml       -> Agent definitions (model, tools, prompts) -- 5 agents
  categories.yaml   -> Knowledge taxonomy -- 5 categories
  prompts/          -> System prompts for orchestrator and agents
    orchestrator.md, metacognition.md, research.md, code.md, knowledge.md, planning.md, communication.md
    thinkfork/      -> Per-style prompts: conservative.md, aggressive.md, balanced.md, contrarian.md, comparison.md
scripts/
  dev-start.sh      -> Full setup + launch (Supabase cloud, --docker flag available)
  docker-start.sh   -> Docker local setup: DB + deps + build + launch (one command)
supabase/
  migrations/       -> Canonical SQL migrations (14 migrations, 001-014)
docs/
  build-history/    -> Archived build session prompts and specs
```

### Dashboard Layout

```
Header: [Logo] [Session Title] [Replay Tour] [Help]

Left Sidebar: Sessions list (create, select, archive, share)

Center Tabs:
  +-- ThinkGraph  (default -- interactive reasoning graph via @xyflow/react)
  +-- Swarm       (multi-agent orchestration: 6 agents + WebSocket streaming)
  +-- GoT         (Graph of Thoughts: BFS/DFS/best-first search)
  +-- Verify      (PRM step-by-step verification)

Right Sidebar:
  +-- Insights    (metacognitive audit results)
  +-- Fork        (ThinkFork 4-style parallel reasoning + debate mode)
  +-- Memory      (3-tier memory hierarchy: working/recall/archival)

Bottom Panel: Thinking stream + query input (ThinkGraph tab only)
```

### Core Components (`packages/core/src/`)

| Module | Purpose |
|--------|---------|
| `thinking-engine.ts` | Claude Opus 4.6 wrapper with adaptive thinking (effort: low/medium/high/max), context compaction, streaming |
| `think-graph.ts` | Parses reasoning into persistent graph nodes, extracts decision points, builds reasoning graph |
| `orchestrator.ts` | Central brain: dynamic effort routing, token budget enforcement, compaction boundary nodes, session management |
| `metacognition.ts` | Self-reflection using 50k thinking budget to analyze patterns/biases across sessions |
| `thinkfork.ts` | 4-style concurrent reasoning (conservative/aggressive/balanced/contrarian) with debate mode and steering |
| `prm-verifier.ts` | Process Reward Model -- step-by-step reasoning verification with geometric mean scoring |
| `got-engine.ts` | Graph of Thoughts reasoning with BFS/DFS/best-first search, thought aggregation/refinement |
| `memory-hierarchy.ts` | MemGPT-inspired 3-tier memory (main context / recall / archival) with auto-eviction |
| `memory-manager.ts` | Voyage AI embeddings (voyage-3, 1024-dim), semantic search, knowledge storage |

### Python Agent Swarm (`agents/src/`)

| Module | Purpose |
|--------|---------|
| `swarm.py` | 3-phase orchestration: Phase 1 (Maestro decomposition), Phase 2 (parallel agents), Phase 3 (synthesis + metacognition) |
| `server.py` | FastAPI routes + WebSocket endpoints with HMAC auth |
| `agents/maestro.py` | Swarm conductor -- decomposes queries, selects agents, assigns subtasks |
| `agents/deep_thinker.py` | Extended reasoning with maximum thinking budget |
| `agents/contrarian.py` | Devil's advocate -- challenges assumptions |
| `agents/verifier.py` | Validates reasoning steps and agent outputs |
| `agents/synthesizer.py` | Merges diverse agent outputs into coherent conclusions |
| `agents/metacognition.py` | Audits swarm reasoning for biases and patterns |
| `graph/reasoning_graph.py` | SharedReasoningGraph (NetworkX) for live collaboration |
| `events/bus.py` | Event pub/sub for WebSocket streaming |

### Data Layer (`packages/db/src/`)

PostgreSQL with pgvector (Supabase cloud or local Docker via PostgREST). Key tables:

- `thinking_nodes` / `reasoning_edges` / `decision_points` -- ThinkGraph storage
- `metacognitive_insights` -- Self-reflection outputs
- `sessions` -- Session management
- `decision_log` -- Decision audit trail
- `knowledge_entries` / `knowledge_relations` -- Embedded knowledge base
- `agent_runs` -- Agent execution tracking

Query modules: `sessions.ts`, `knowledge.ts`, `thinking-nodes.ts`, `decisions.ts`, `agent-runs.ts`, `metacognition.ts`

### API Routes (`apps/web/src/app/api/`)

| Route | Method(s) | Purpose |
|-------|-----------|---------|
| `/api/auth` | POST | Password auth with HMAC cookie signing |
| `/api/auth/logout` | POST | Clear auth cookie |
| `/api/think` | POST | Extended thinking request (alias for /api/thinking) |
| `/api/thinking` | POST | Extended thinking request (canonical) |
| `/api/thinking/stream` | POST | SSE streaming for thinking deltas |
| `/api/stream/[sessionId]` | GET | SSE stream (compatibility alias) |
| `/api/fork` | POST | ThinkFork parallel reasoning |
| `/api/fork/steer` | POST | Branch steering during active fork |
| `/api/fork/stream` | POST | SSE streaming for fork phases |
| `/api/verify` | POST | PRM step-by-step verification |
| `/api/got` | POST | Graph of Thoughts reasoning |
| `/api/got/stream` | POST | SSE streaming for GoT reasoning |
| `/api/memory` | GET, POST | Hierarchical memory operations |
| `/api/swarm` | POST | Initiate multi-agent swarm (proxied to Fly.io) |
| `/api/swarm/token` | GET | Generate WebSocket auth token for swarm |
| `/api/swarm/[sessionId]/checkpoint` | POST | Human-in-the-loop checkpoint |
| `/api/sessions` | GET, POST | List/create sessions |
| `/api/sessions/[sessionId]` | GET, PATCH, DELETE | Session CRUD |
| `/api/sessions/[sessionId]/nodes` | GET | Get thinking nodes for session |
| `/api/sessions/[sessionId]/share` | POST | Generate session share link |
| `/api/reasoning/[id]` | GET | Get reasoning node details |
| `/api/reasoning/[id]/checkpoint` | POST | Human-in-the-loop checkpoint |
| `/api/reasoning/search` | GET | Search across reasoning nodes |
| `/api/insights` | GET, POST | List/trigger metacognitive insights |
| `/api/insights/search` | GET | Search insights |
| `/api/insights/stats` | GET | Insight statistics |
| `/api/insights/swarm` | POST | Bridge swarm insights to metacognition |
| `/api/health` | GET | Health check |
| `/api/demo` | POST | Generate demo data |
| `/api/seed` | POST | Seed knowledge base |

## Key Patterns

### Extended Thinking Configuration

```typescript
// ThinkingEngine supports effort levels: 'low' | 'medium' | 'high' | 'max'
// 'max' = 50k thinking tokens (required for metacognition)
// Dynamic effort routing: orchestrator classifies tasks via regex patterns
// Effort is set via updateConfig(), not as a think() parameter:
thinkingEngine.updateConfig({ effort: 'max' });
await thinkingEngine.think(systemPrompt, messages, tools);
```

### Auth System

- HMAC-signed cookies via Web Crypto API (Edge-compatible)
- `AUTH_SECRET` used as both password AND HMAC signing key
- Middleware protects all `/api/*` routes except `/api/auth`, `/api/health`, and `/api/demo`
- `DEMO_MODE=true` enables the `/api/demo` data seeder (does NOT bypass auth)
- Swarm WebSocket uses HMAC token: `HMAC(key=AUTH_SECRET, message="opus-nx-authenticated")`

### Swarm Connectivity

```
Browser -> POST /api/swarm -> Vercel proxy -> Fly.io /api/swarm (HMAC token injected server-side)
Browser -> GET /api/swarm/token -> Returns { token, wsUrl } for direct WebSocket
Browser -> wss://opus-nx-agents.fly.dev/ws/{sessionId}?token=HMAC
```

- `NEXT_PUBLIC_SWARM_URL` env var controls the Fly.io base URL
- `swarm-client.ts` handles WebSocket subscription with auto-reconnect (3 attempts, exponential backoff)
- Token cache expires after 60 minutes
- CORS configured in `agents/src/config.py` (includes `https://opus-nx.vercel.app`)

### Migration Workflow

Migrations must exist in BOTH locations and be identical:

1. `supabase/migrations/` (canonical) -- 14 migrations (001 through 014)
2. `packages/db/migrations/` (mirror)

The `pnpm check:migrations` script enforces this.

**Docker local mode**: Migrations run automatically on first `docker compose up` via `docker/postgres/run-migrations.sh`. To re-run after adding new migrations, use `./scripts/docker-start.sh --reset`.

### TypeScript Strict Mode

All packages use strict TypeScript. Exports use `.js` extensions for ESM compatibility:

```typescript
export * from "./thinking-engine.js";  // Note the .js even for .ts files
```

### Environment Variables

**Two env templates**:
- `.env.example` -- For Supabase cloud setup (5 required keys)
- `.env.docker` -- For Docker local setup (only `ANTHROPIC_API_KEY` required, everything else pre-configured)

**Required (cloud)**

- `ANTHROPIC_API_KEY` -- Required for Claude Opus 4.6
- `AUTH_SECRET` -- Required for HMAC auth cookie signing (also used as login password)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` -- Database

**Required (Docker local)**

- `ANTHROPIC_API_KEY` -- Only key you need to add
- All other values are pre-configured in `.env.docker` (local PostgREST JWT tokens, `localhost:54321` URL)

**Swarm Backend**

- `NEXT_PUBLIC_SWARM_URL` -- Python swarm backend URL (default: `http://localhost:8000`, production: `https://opus-nx-agents.fly.dev`)

**Optional**

- `DEMO_MODE` -- Set to `"true"` to enable demo data seeder
- `VOYAGE_API_KEY` -- Embeddings (voyage-3, 1024-dim) for Memory Manager; degrades gracefully if absent
- `TAVILY_API_KEY` -- Web search for Research Agent

**Fly.io Secrets (agents/ service)**

- `ANTHROPIC_API_KEY`, `AUTH_SECRET` (must match Vercel), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS` -- JSON array of allowed origins (default includes `https://opus-nx.vercel.app`)

### Docker Local Architecture

When using `docker-compose.local.yml`, three containers replace Supabase cloud:

```
Browser → Next.js (host :3000)
  → packages/db (Supabase JS client, unchanged)
    → nginx gateway (:54321) strips /rest/v1/ prefix
      → PostgREST (:3000 internal) validates JWT, switches PG role
        → PostgreSQL 17 + pgvector (:54322 external)
```

- **Zero code changes**: Supabase JS client talks to PostgREST via the same REST API
- **JWT auth**: Pre-signed tokens in `.env.docker` use Supabase's well-known local dev secret
- **Roles**: `service_role` (full access), `anon` (read-only), `authenticator` (PostgREST connection role)
- **Data persistence**: Docker volume `pgdata` survives restarts; `--reset` wipes it

## Research Foundation

| Paper | Module | Key Contribution |
|-------|--------|-----------------|
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023) | `thinkfork.ts` | BFS/DFS search over reasoning trees with state evaluation |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | `prm-verifier.ts` | Process supervision -- verify each reasoning step independently |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023) | `got-engine.ts` | Arbitrary thought graph topology with aggregation and refinement |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023) | `memory-hierarchy.ts` | 3-tier memory hierarchy with paging and auto-eviction |

## Testing

Core tests use Vitest: `pnpm --filter @opus-nx/core test` (273 tests across 8 suites)

Python agent tests: `cd agents && uv run pytest`

## Tech Stack

- **LLM**: Claude Opus 4.6 (only model with 50k extended thinking budget)
- **Dashboard**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Agent Swarm**: Python 3.12, FastAPI, Anthropic SDK, NetworkX
- **Database**: PostgreSQL 17 + pgvector (Supabase cloud or local Docker via PostgREST)
- **Local DB Stack**: pgvector/pgvector:0.8.1-pg17, PostgREST v12.2.3, nginx 1.27-alpine
- **Visualization**: @xyflow/react (react-flow)
- **Deployment**: Vercel (dashboard) + Fly.io (agents), or fully local via Docker
- **Runtime**: Node.js 22+, TypeScript 5.7+
- **Testing**: Vitest 4, pytest
