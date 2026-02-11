# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Opus Nx makes AI reasoning visible, steerable, and persistent. It transforms Claude Opus 4.6's extended thinking into navigable reasoning graphs and deploys a swarm of 6 specialized AI agents for multi-perspective analysis. Built for the Cerebral Valley Hackathon (Feb 2026).

**Key Innovation**: Extended thinking becomes persistent "ThinkGraph" nodes you can see, steer, verify, and build upon. A swarm of 6 AI agents (Maestro, DeepThinker, Contrarian, Verifier, Synthesizer, Metacognition) collaborate in real-time via WebSocket streaming.

**Two-Service Architecture**:
- **Service 1**: Next.js Dashboard on Vercel (`https://opus-nx.vercel.app`)
- **Service 2**: Python Agent Swarm on Fly.io (`https://opus-nx-agents.fly.dev`)

## Commands

### Development

```bash
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
  src/agents/       -> 6 specialized agents: maestro, deep_thinker, contrarian, synthesizer, metacognition, base
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
configs/
  agents.yaml       -> Agent definitions (model, tools, prompts) -- 5 agents
  categories.yaml   -> Knowledge taxonomy -- 5 categories
  prompts/          -> System prompts for orchestrator and agents
    orchestrator.md, metacognition.md, research.md, code.md, knowledge.md, planning.md, communication.md
    thinkfork/      -> Per-style prompts: conservative.md, aggressive.md, balanced.md, contrarian.md, comparison.md
supabase/
  migrations/       -> Canonical SQL migrations (mirrored to packages/db/migrations/)
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
| `agents/synthesizer.py` | Merges diverse agent outputs into coherent conclusions |
| `agents/metacognition.py` | Audits swarm reasoning for biases and patterns |
| `graph/reasoning_graph.py` | SharedReasoningGraph (NetworkX) for live collaboration |
| `events/bus.py` | Event pub/sub for WebSocket streaming |

### Data Layer (`packages/db/src/`)

Supabase PostgreSQL with pgvector. Key tables:

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

1. `supabase/migrations/` (canonical) -- 3 migrations (001, 002, 003)
2. `packages/db/migrations/` (mirror)

The `pnpm check:migrations` script enforces this.

### TypeScript Strict Mode

All packages use strict TypeScript. Exports use `.js` extensions for ESM compatibility:

```typescript
export * from "./thinking-engine.js";  // Note the .js even for .ts files
```

### Environment Variables (see `.env.example`)

**Required**

- `ANTHROPIC_API_KEY` -- Required for Claude Opus 4.6
- `AUTH_SECRET` -- Required for HMAC auth cookie signing (also used as login password)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` -- Database

**Swarm Backend**

- `NEXT_PUBLIC_SWARM_URL` -- Python swarm backend URL (default: `http://localhost:8000`, production: `https://opus-nx-agents.fly.dev`)

**Optional**

- `DEMO_MODE` -- Set to `"true"` to enable demo data seeder
- `VOYAGE_API_KEY` -- Embeddings (voyage-3, 1024-dim) for Memory Manager; degrades gracefully if absent
- `TAVILY_API_KEY` -- Web search for Research Agent

**Fly.io Secrets (agents/ service)**

- `ANTHROPIC_API_KEY`, `AUTH_SECRET` (must match Vercel), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS` -- JSON array of allowed origins (default includes `https://opus-nx.vercel.app`)

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
- **Database**: Supabase (PostgreSQL + pgvector with HNSW indexes)
- **Visualization**: @xyflow/react (react-flow)
- **Deployment**: Vercel (dashboard) + Fly.io (agents)
- **Runtime**: Node.js 22+, TypeScript 5.7+
- **Testing**: Vitest 4, pytest
