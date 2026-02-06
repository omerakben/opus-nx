# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Opus Nx is a **cognitive architecture** that transforms Claude's extended thinking into persistent, queryable graph structures. Built for the Cerebral Valley Hackathon (Feb 2026), it's the first AI system where reasoning is persistent, navigable, and evolving.

**Core Innovation**: Extended thinking becomes a first-class data structure—every reasoning session creates graph nodes that can be traversed, searched, and analyzed for metacognition.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (required before running)
pnpm build

# Development (watch mode)
pnpm dev

# Type checking
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test

# Clean build artifacts
pnpm clean

# Database operations
pnpm db:migrate      # Push schema to Supabase
pnpm db:generate     # Generate TypeScript types from schema

# Run single package
pnpm --filter @opus-nx/core build
pnpm --filter @opus-nx/core dev
pnpm --filter @opus-nx/web dev

# Run ThinkGraph tests specifically
cd packages/core && node --experimental-strip-types src/test-think-graph.ts
```

## Architecture

### Monorepo Structure (Turborepo + pnpm workspaces)

```
opus-nx/
├── packages/
│   ├── core/           # ThinkingEngine, ThinkGraph, Orchestrator, MemoryManager
│   ├── db/             # Supabase client, migrations, query functions
│   ├── agents/         # LangChain/LangGraph specialized sub-agents
│   └── shared/         # Config loaders, logger, utilities
├── apps/
│   └── web/            # Next.js 16 dashboard (not yet implemented)
└── configs/
    ├── agents.yaml     # Agent definitions
    ├── categories.yaml # Knowledge taxonomy
    └── prompts/        # System prompts for orchestrator and agents
```

### Package Dependencies

```
@opus-nx/core ──► @opus-nx/db ──► @opus-nx/shared
@opus-nx/agents ──► @opus-nx/core
```

### Core Components

**ThinkingEngine** (`packages/core/src/thinking-engine.ts`)
- Wraps Claude Opus 4.6 with extended thinking
- Configurable thinking budgets: low (5k), medium (10k), high (20k), max (50k)
- Streaming and non-streaming modes
- Parses responses into typed blocks: thinking, text, tool_use

**ThinkGraph** (`packages/core/src/think-graph.ts`)
- Parses raw thinking text into structured reasoning
- Extracts decision points (chosen path, alternatives, confidence)
- Persists thinking nodes to database with graph edges
- Query methods: getRelatedReasoning, getReasoningChain, searchReasoning

**Orchestrator** (`packages/core/src/orchestrator.ts`)
- Session management and user message processing
- Integrates ThinkGraph after each thinking call
- Routes tasks to specialized sub-agents
- Maintains lastThinkingNodeId for linking sequential reasoning

**MemoryManager** (`packages/core/src/memory-manager.ts`)
- Voyage AI embeddings (voyage-3, 1024-dim)
- Semantic search on knowledge entries
- Context building for prompt injection

### Database Schema

Key tables in Supabase (PostgreSQL + pgvector):
- `sessions` - Orchestration session state
- `thinking_nodes` - Persisted reasoning with structured_reasoning JSONB
- `reasoning_edges` - Graph edges (influences, contradicts, supports, supersedes)
- `decision_points` - Extracted decisions with alternatives
- `knowledge_entries` - Embeddings for semantic search (1024-dim HNSW index)
- `knowledge_relations` - Knowledge graph edges
- `metacognitive_insights` - Self-reflection results

### Edge Types for Reasoning Graph

```typescript
type EdgeType = "influences" | "contradicts" | "supports" | "supersedes" | "refines"
```

## Environment Variables

Required in `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
VOYAGE_API_KEY=pa-...
TAVILY_API_KEY=tvly-...  # Optional
```

## Key Patterns

### Extended Thinking Configuration
```typescript
const config: OrchestratorConfig = {
  model: "claude-opus-4-6-20260101",
  thinking: {
    type: "enabled",
    effort: "high", // low=5k, medium=10k, high=20k, max=50k tokens
  },
  streaming: true,
  maxTokens: 8192,
}
```

### Persisting Thinking to Graph
```typescript
const graphResult = await thinkGraph.persistThinkingNode(
  result.thinkingBlocks,
  {
    sessionId: session.id,
    parentNodeId: lastThinkingNodeId, // Links reasoning chain
    inputQuery: userMessage,
    tokenUsage: result.usage,
  }
);
```

### Decision Point Extraction
ThinkGraph automatically extracts decision points by pattern-matching reasoning text for:
- Choice markers: "I'll choose...", "Going with...", "Selecting..."
- Alternatives: "On the other hand...", "Alternatively..."
- Confidence indicators: "certainly", "probably", "uncertain"

## Conventions

- ESM modules throughout (`"type": "module"`)
- TypeScript strict mode
- Zod for runtime validation
- YAML for configuration files (validated with Zod schemas)
- UUID-based IDs from database
- ISO timestamps
- Functional async/await patterns (no callbacks)
