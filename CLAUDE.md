# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Opus Nx makes AI reasoning visible, steerable, and persistent. It transforms Claude Opus 4.6's extended thinking into navigable reasoning graphs. Built for the Cerebral Valley Hackathon (Feb 2026).

**Key Innovation**: Extended thinking becomes persistent "ThinkGraph" nodes you can see, steer, verify, and build upon across sessions.

**Hackathon Scope**: The demo focuses on six core modules -- ThinkingEngine, ThinkGraph, Orchestrator, Metacognition, ThinkFork, and PRM Verifier. Additional modules (GoT Engine, Memory, Agents) exist in the codebase as future-scope work and should not be prioritized for the hackathon.

## Commands

### Development

```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages (Turborepo)
pnpm dev                  # Start all dev servers
pnpm --filter @opus-nx/web dev   # Start just the web dashboard
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
packages/
  core/             -> Hackathon Core: ThinkingEngine, ThinkGraph, Orchestrator, Metacognition, ThinkFork, PRM
                       Future Scope: GoT Engine, MemoryHierarchy, MemoryManager
  db/               -> Supabase client, query functions, types
  agents/           -> [Future Scope] LangChain/LangGraph agent implementations
  shared/           -> Shared types, utilities, config loaders
configs/
  agents.yaml       -> Agent definitions (model, tools, prompts) -- 5 agents
  categories.yaml   -> Knowledge taxonomy -- 5 categories
  prompts/          -> System prompts for orchestrator and agents
    orchestrator.md, metacognition.md, research.md, code.md, knowledge.md, planning.md, communication.md
    thinkfork/      -> Per-style prompts: conservative.md, aggressive.md, balanced.md, contrarian.md, comparison.md
supabase/
  migrations/       -> Canonical SQL migrations (mirrored to packages/db/migrations/)
```

### Core Components (`packages/core/src/`)

**Hackathon Core -- 6 Modules (what judges will see)**

| Module | Purpose |
|--------|---------|
| `thinking-engine.ts` | Claude Opus 4.6 wrapper with adaptive thinking (effort: low/medium/high/max), context compaction, streaming |
| `think-graph.ts` | Parses reasoning into persistent graph nodes, extracts decision points, builds reasoning graph |
| `orchestrator.ts` | Central brain: dynamic effort routing, token budget enforcement, compaction boundary nodes, session management |
| `metacognition.ts` | Self-reflection using 50k thinking budget to analyze patterns/biases across sessions |
| `thinkfork.ts` | 4-style concurrent reasoning (conservative/aggressive/balanced/contrarian) with debate mode and steering |
| `prm-verifier.ts` | Process Reward Model -- step-by-step reasoning verification with geometric mean scoring |

**Future Scope -- 3 Modules (exist in codebase, not prioritized for hackathon)**

| Module | Purpose |
|--------|---------|
| `got-engine.ts` | [Future] Graph of Thoughts reasoning with BFS/DFS/best-first search, thought aggregation/refinement |
| `memory-hierarchy.ts` | [Future] MemGPT-inspired 3-tier memory (main context / recall / archival) with auto-eviction |
| `memory-manager.ts` | [Future] Voyage AI embeddings (voyage-3, 1024-dim), semantic search, knowledge storage |

### Data Layer (`packages/db/src/`)

Supabase PostgreSQL with pgvector. Key tables:

**Hackathon Core Tables**

- `thinking_nodes` / `reasoning_edges` / `decision_points` -- ThinkGraph storage
- `metacognitive_insights` -- Self-reflection outputs
- `sessions` -- Session management
- `decision_log` -- Decision audit trail

**Future Scope Tables**

- `knowledge_entries` / `knowledge_relations` -- [Future] Embedded knowledge base
- `contradictions` -- [Future] Tracked knowledge conflicts (table exists, no resolver module)
- `agent_runs` -- [Future] Agent execution tracking

Query modules: `sessions.ts`, `knowledge.ts`, `thinking-nodes.ts`, `decisions.ts`, `agent-runs.ts`, `metacognition.ts`

### API Routes (`apps/web/src/app/api/`)

**Hackathon Core Routes**

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
| `/api/verify` | POST | PRM step-by-step verification |
| `/api/sessions` | GET, POST | List/create sessions |
| `/api/sessions/[sessionId]` | GET, PATCH, DELETE | Session CRUD |
| `/api/sessions/[sessionId]/nodes` | GET | Get thinking nodes for session |
| `/api/reasoning/[id]` | GET | Get reasoning node details |
| `/api/reasoning/[id]/checkpoint` | POST | Human-in-the-loop checkpoint |
| `/api/insights` | GET, POST | List/trigger metacognitive insights |
| `/api/health` | GET | Health check |
| `/api/demo` | POST | Generate demo data |

**Future Scope Routes**

| Route | Method(s) | Purpose |
|-------|-----------|---------|
| `/api/got` | POST | [Future] Graph of Thoughts reasoning |
| `/api/memory` | GET, POST | [Future] Hierarchical memory operations |
| `/api/seed` | POST | [Future] Seed knowledge base |
| `/api/seed/business-strategy` | POST | [Future] Seed business strategy data |

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

**Required (Hackathon Core)**

- `ANTHROPIC_API_KEY` -- Required for Claude Opus 4.6
- `AUTH_SECRET` -- Required for HMAC auth cookie signing (also used as login password)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` -- Database

**Optional**

- `DEMO_MODE` -- Optional; set to `"true"` to enable demo data seeder (not in .env.example)

**Future Scope**

- `VOYAGE_API_KEY` -- [Future] Embeddings (voyage-3, 1024-dim) for Memory Manager
- `TAVILY_API_KEY` -- [Future] Web search for Research Agent

## Research Foundation

Opus Nx implements algorithms from four foundational papers. Two are in hackathon scope; two are future scope.

**Hackathon Core**

| Paper | Module | Key Contribution |
|-------|--------|-----------------|
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023) | `thinkfork.ts` | BFS/DFS search over reasoning trees with state evaluation |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | `prm-verifier.ts` | Process supervision -- verify each reasoning step independently |

**Future Scope**

| Paper | Module | Key Contribution |
|-------|--------|-----------------|
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023) | `got-engine.ts` | [Future] Arbitrary thought graph topology with aggregation and refinement |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023) | `memory-hierarchy.ts` | [Future] 3-tier memory hierarchy with paging and auto-eviction |

## Testing

Core tests use Vitest: `pnpm --filter @opus-nx/core test`

## Tech Stack

**Hackathon Core**

- **LLM**: Claude Opus 4.6 (only model with 50k extended thinking budget)
- **Framework**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Database**: Supabase (PostgreSQL + pgvector with HNSW indexes)
- **Visualization**: @xyflow/react (react-flow)
- **Runtime**: Node.js 22+, TypeScript 5.7+
- **Testing**: Vitest 4

**Future Scope**

- **Embeddings**: [Future] Voyage AI (voyage-3)
- **Agents**: [Future] LangChain + LangGraph
