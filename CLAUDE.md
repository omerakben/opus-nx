# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Opus Nx is a persistent AI orchestrator that transforms Claude Opus 4.6's extended thinking into a queryable, navigable data structure. Built for the Cerebral Valley Hackathon (Feb 2026).

**Key Innovation**: Extended thinking becomes persistent "ThinkGraph" nodes that can be searched, analyzed, and traversed—not just used to improve response quality.

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
apps/web/           → Next.js 16 dashboard (App Router, Turbopack)
packages/
  core/             → ThinkingEngine, ThinkGraph, Metacognition, ThinkFork, Orchestrator
  db/               → Supabase client, query functions, types
  agents/           → LangChain/LangGraph agent implementations
  shared/           → Shared types, utilities, config loaders
configs/
  agents.yaml       → Agent definitions (model, tools, prompts)
  categories.yaml   → Knowledge taxonomy
  prompts/          → System prompts for orchestrator and agents
supabase/
  migrations/       → Canonical SQL migrations (mirrored to packages/db/migrations/)
```

### Core Components (`@opus-nx/core`)

| Module                | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `thinking-engine.ts`  | Claude Opus 4.6 wrapper with extended thinking (5k-50k tokens)       |
| `think-graph.ts`      | Parses reasoning into nodes, extracts decisions, persists graph      |
| `metacognition.ts`    | Self-reflection using 50k thinking budget to analyze patterns/biases |
| `thinkfork.ts`        | Parallel reasoning branches (conservative/aggressive/balanced)       |
| `orchestrator.ts`     | Session management, task routing, knowledge context injection        |
| `memory-manager.ts`   | Voyage AI embeddings, semantic search, knowledge storage             |
| `got-engine.ts`       | Graph of Thoughts reasoning (BFS/DFS/best-first with aggregation)    |
| `prm-verifier.ts`     | Process Reward Model — step-by-step reasoning verification           |
| `memory-hierarchy.ts` | MemGPT-inspired 3-tier memory (context/recall/archival)              |

### Data Layer (`@opus-nx/db`)

Supabase PostgreSQL with pgvector. Key tables:

- `thinking_nodes` / `reasoning_edges` / `decision_points` — ThinkGraph storage
- `knowledge_entries` / `knowledge_relations` — Embedded knowledge base
- `metacognitive_insights` — Self-reflection outputs
- `contradictions` — Tracked knowledge conflicts with resolution

### API Routes (`apps/web/src/app/api/`)

| Route            | Purpose                           |
| ---------------- | --------------------------------- |
| `/api/think`     | Extended thinking request         |
| `/api/fork`      | ThinkFork parallel reasoning      |
| `/api/stream`    | SSE streaming for thinking deltas |
| `/api/insights`  | Metacognitive insights            |
| `/api/reasoning` | ThinkGraph queries                |
| `/api/sessions`  | Session management                |
| `/api/got`       | Graph of Thoughts reasoning       |
| `/api/verify`    | PRM step-by-step verification     |
| `/api/memory`    | Hierarchical memory operations    |

## Key Patterns

### Extended Thinking Configuration

```typescript
// ThinkingEngine supports effort levels: 'low' | 'medium' | 'high' | 'max'
// 'max' = 50k thinking tokens (required for metacognition)
await thinkingEngine.think(prompt, { effort: 'max' });
```

### Migration Workflow

Migrations must exist in BOTH locations and be identical:

1. `supabase/migrations/` (canonical)
2. `packages/db/migrations/` (mirror)

The `pnpm check:migrations` script enforces this.

### Environment Variables (see `.env.example`)

- `ANTHROPIC_API_KEY` — Required for Claude Opus 4.6
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` — Database
- `VOYAGE_API_KEY` — Embeddings (voyage-3, 1024-dim)
- `TAVILY_API_KEY` — Web search for Research Agent
- `AUTH_SECRET` — HMAC signature for auth cookies

### TypeScript Strict Mode

All packages use strict TypeScript. Exports use `.js` extensions for ESM compatibility:

```typescript
export * from "./thinking-engine.js";  // Note the .js even for .ts files
```

## Research Foundation

Opus Nx implements algorithms from four foundational papers:

| Paper | Module | Key Contribution |
|-------|--------|-----------------|
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023) | `thinkfork.ts`, `got-engine.ts` | BFS/DFS search over reasoning trees with state evaluation |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023) | `got-engine.ts` | Arbitrary thought graph topology with aggregation and refinement |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | `prm-verifier.ts` | Process supervision — verify each reasoning step independently |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023) | `memory-hierarchy.ts` | 3-tier memory hierarchy (main context / recall / archival) |

### Testing

Core tests use Vitest: `pnpm --filter @opus-nx/core test`

## Tech Stack

- **LLM**: Claude Opus 4.6 (only model with 50k extended thinking budget)
- **Framework**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Database**: Supabase (PostgreSQL + pgvector with HNSW indexes)
- **Embeddings**: Voyage AI (voyage-3)
- **Agents**: LangChain + LangGraph
- **Visualization**: @xyflow/react (react-flow)
