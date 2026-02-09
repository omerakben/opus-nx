# Opus Nx

## AI reasoning you can see, steer, and verify.

Opus Nx transforms Claude Opus 4.6's extended thinking from an invisible black box into **persistent, navigable reasoning graphs**. Explore how your AI thinks, fork it into competing perspectives, and verify every step -- all in real time.

**[Live Demo](https://opus-nx.vercel.app)** | Built for the [Cerebral Valley "Built with Opus 4.6" Hackathon](https://cv.inc/e/claude-code-hackathon) (Feb 2026)

---

## Why Opus Nx?

Every AI system today treats reasoning as disposable. Extended thinking improves the output, but the thinking itself vanishes the moment the response arrives. You get the answer -- never the journey.

**The problem is trust.** When you cannot see *how* an AI reached its conclusion, you cannot verify it, steer it, or build on it. You are left with "the AI said X" instead of "we reasoned through A, B, and C to arrive at X."

Opus Nx makes the invisible visible:

| Status Quo | Opus Nx |
| --- | --- |
| Reasoning happens behind a wall | Reasoning becomes a **navigable graph** you can explore |
| Single path to an answer | **Four concurrent perspectives** you steer in real time |
| "Trust the final output" | **Step-by-step verification** with scored confidence |
| Conversations are stateless | Every reasoning chain is **persistent and searchable** |
| Fixed effort for every question | **Adaptive effort** -- simple questions get fast answers, complex ones get deep thinking |
| No self-awareness | **Metacognitive self-audit** detects the AI's own biases and blind spots |

---

## Core Features

### 1. ThinkGraph -- Navigate How Your AI Thinks

Extended thinking is parsed into a persistent graph of reasoning nodes, decision points, and directed edges. Each node carries content, confidence scores, and metadata. The graph renders as an interactive visualization powered by `@xyflow/react`, where you can click into any decision point to see what alternatives were considered and why the AI chose its path.

Graphs persist to Supabase (PostgreSQL + pgvector) and degrade gracefully to in-memory storage when the database is unavailable.

### 2. ThinkFork -- Steer Competing Perspectives

Complex decisions spawn up to four concurrent reasoning branches, each approaching the problem from a distinct angle:

- **Conservative** -- Risk-averse, precedent-focused analysis
- **Aggressive** -- Opportunity-seeking, growth-oriented analysis
- **Balanced** -- Weighted trade-off evaluation
- **Contrarian** -- Challenges assumptions and conventional wisdom

**Debate mode** makes the branches argue against each other. **Branch steering** lets you redirect any branch mid-stream. **Convergence analysis** quantifies where perspectives agree, where they diverge, and what that means for your decision. Inspired by [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023).

### 3. Metacognitive Self-Audit -- Understand Your AI's Patterns

Using Opus 4.6's full 50,000-token thinking budget, the system turns reasoning inward. It analyzes its own patterns across sessions, detects systematic biases, identifies recurring strategies, and generates self-improvement hypotheses -- all with scored confidence and actionable recommendations.

This is only possible with Opus 4.6. No other model provides the extended thinking depth required for meaningful self-reflection.

### 4. PRM Verifier -- Check Every Reasoning Step

Rather than trusting final answers, the Process Reward Model verifier inspects each individual step in a reasoning chain. Every step is rated as correct, incorrect, or neutral with a detailed justification. The chain's overall score uses geometric mean aggregation, which surfaces the weakest link rather than hiding it behind an average. Based on [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023).

### 5. Orchestrator -- Adaptive Effort Routing

Not every question deserves the same thinking budget. The orchestrator classifies incoming tasks as simple, standard, or complex using dynamic pattern matching, then routes them to the appropriate effort level (`low` / `medium` / `high` / `max`). It manages token budgets, triggers context compaction for long sessions, and injects relevant knowledge context before each reasoning step.

### 6. ThinkingEngine -- The Opus 4.6 Foundation

The core wrapper around Claude Opus 4.6 that makes everything else possible. Supports four effort levels with configurable thinking budgets, real-time SSE streaming of thinking deltas, and context compaction for sessions that exceed the context window. Every module in Opus Nx builds on this foundation.

---

## Architecture

```
+------------------------------------------------------------------+
|                       Next.js 16 Dashboard                       |
|  +------------+ +----------+ +-----------+ +--------+            |
|  | ThinkGraph | | ThinkFork| | Metacog   | | PRM    |            |
|  | Visualizer | | Panel    | | Insights  | | Verify |            |
|  +-----+------+ +----+-----+ +----+------+ +---+----+            |
|        |              |            |            |                 |
+--------+--------------+------------+------------+-----------------+
         |              |            |            |
         v              v            v            v
+------------------------------------------------------------------+
|                  @opus-nx/core  [Hackathon Core]                  |
|                                                                  |
|  +---------------+  +-------------+  +--------------+            |
|  | Thinking      |  | ThinkGraph  |  | Metacognition|            |
|  | Engine        |  |             |  | Engine       |            |
|  +---------------+  +-------------+  +--------------+            |
|                                                                  |
|  +---------------+  +--------------+  +--------------+           |
|  | ThinkFork     |  | Orchestrator |  | PRM Verifier |           |
|  | (4 branches)  |  | (routing)    |  | (step-level) |           |
|  +---------------+  +--------------+  +--------------+           |
|                                                                  |
|  - - - - - - - - - [Future Scope] - - - - - - - - - - - - - -   |
|  +-------------+  +------------------+  +------------------+     |
|  | GoT Engine  |  | Memory Hierarchy |  | Memory Manager   |     |
|  | (BFS/DFS)   |  | (3-tier paging)  |  | (Voyage AI)      |     |
|  +-------------+  +------------------+  +------------------+     |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|             Supabase (PostgreSQL + pgvector)                      |
|  thinking_nodes | reasoning_edges | decision_points | sessions   |
|  metacognitive_insights | knowledge_entries (future)             |
+------------------------------------------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|  Claude Opus 4.6   |   Voyage AI (future)   |   Tavily (future)  |
|  (50k thinking)    |   (voyage-3, 1024-dim) |   (web research)    |
+------------------------------------------------------------------+
```

### Monorepo Structure

```text
apps/web/              Next.js 16 dashboard (App Router, Turbopack)
packages/
  core/                ThinkingEngine, ThinkGraph, ThinkFork, Metacognition,
                       PRM, Orchestrator  [+ GoT, Memory (future scope)]
  db/                  Supabase client, query functions, types
  agents/              LangChain/LangGraph agent implementations (future scope)
  shared/              Shared types, utilities, config loaders
configs/
  agents.yaml          Agent definitions (future scope)
  categories.yaml      Knowledge taxonomy
  prompts/             System prompts (orchestrator, metacognition, thinkfork styles)
supabase/
  migrations/          Canonical SQL migrations (3 files)
```

---

## Quick Start

### Prerequisites

- **Node.js** 22+
- **pnpm** 9.15+
- **Supabase** account (PostgreSQL + pgvector)
- **API Keys**: Anthropic (Claude Opus 4.6); Voyage AI *(optional -- future scope)*

### Installation

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
pnpm install
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
ANTHROPIC_API_KEY=sk-ant-...       # Required -- Claude Opus 4.6
AUTH_SECRET=your-secret-here        # Required -- login password + HMAC signing
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
VOYAGE_API_KEY=pa-...               # Optional -- embeddings (future scope)
TAVILY_API_KEY=tvly-...             # Optional -- web search agent
```

Build and run:

```bash
pnpm db:migrate   # Run database migrations
pnpm build        # Build all packages
pnpm dev          # Start dev server at http://localhost:3000
```

---

## API Reference

### Core Reasoning

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/thinking` | POST | Extended thinking request with adaptive effort |
| `/api/thinking/stream` | POST | SSE streaming for real-time thinking deltas |
| `/api/fork` | POST | Spawn ThinkFork parallel reasoning branches |
| `/api/fork/steer` | POST | Redirect a branch mid-reasoning |
| `/api/verify` | POST | PRM step-by-step verification |
| `/api/got` | POST | Graph of Thoughts reasoning *(future scope)* |
| `/api/insights` | GET/POST | Metacognitive self-audit |

### Sessions and Data

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/sessions` | GET/POST | List or create sessions |
| `/api/sessions/[sessionId]` | GET/PATCH/DELETE | Session CRUD |
| `/api/sessions/[sessionId]/nodes` | GET | Thinking nodes for a session |
| `/api/reasoning/[id]` | GET | ThinkGraph node details |
| `/api/reasoning/[id]/checkpoint` | POST | Human-in-the-loop checkpoint |
| `/api/memory` | GET/POST | Hierarchical memory read/write *(future scope)* |

### System

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth` | POST | Authenticate with AUTH_SECRET |
| `/api/auth/logout` | POST | Clear auth cookie |
| `/api/health` | GET | Health check |

---

## Research Foundation

Opus Nx's core hackathon features are grounded in peer-reviewed research on LLM reasoning:

| Paper | Module | Key Idea |
| --- | --- | --- |
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023) | `thinkfork.ts` | BFS/DFS search over reasoning trees with state evaluation |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | `prm-verifier.ts` | Process supervision -- verify each reasoning step independently |

### Future Scope

Two additional papers inform modules that are implemented but scoped as post-hackathon work:

| Paper | Module | Direction |
| --- | --- | --- |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023) | `got-engine.ts` | Arbitrary thought graph topology with aggregation and refinement |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023) | `memory-hierarchy.ts` | 3-tier memory hierarchy (main context / recall / archival) with paging |

The GoT engine and MemGPT-inspired memory hierarchy are built and functional. Full integration into the dashboard workflow is planned for the next iteration.

---

## Why Opus 4.6?

Opus Nx requires Claude Opus 4.6 specifically. No other model provides the combination of capabilities this system needs:

| Capability | Why It Matters |
| --- | --- |
| **50k thinking tokens** | Metacognitive self-audit needs deep introspective reasoning |
| **Extended thinking streaming** | Real-time ThinkGraph construction from thinking deltas |
| **1M context window** | Infinite sessions with orchestrator-managed compaction |
| **128K output** | Long-form reasoning and multi-branch analysis generation |
| **Instruction fidelity** | Reliable execution of multi-layer meta-prompts |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **LLM** | Claude Opus 4.6 (extended thinking, up to 50k tokens) |
| **Framework** | Next.js 16 (App Router, Turbopack), React 19 |
| **Styling** | Tailwind CSS 4, shadcn/ui |
| **Visualization** | @xyflow/react (react-flow) |
| **Database** | Supabase (PostgreSQL + pgvector, HNSW indexes) |
| **Embeddings** | Voyage AI (voyage-3, 1024-dim) |
| **Agents** | LangChain + LangGraph |
| **Monorepo** | Turborepo + pnpm |
| **Language** | TypeScript 5.7+ (strict mode) |
| **Runtime** | Node.js 22+ |
| **Testing** | Vitest |

---

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (Turborepo)
pnpm dev              # Start all dev servers
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm test             # Run tests
pnpm db:migrate       # Run Supabase migrations
pnpm check:migrations # Verify migration sync
```

---

## Team

**Ozzy** -- AI Engineer & Full-Stack Developer

Built with Claude Code for the Cerebral Valley "Built with Opus 4.6" Hackathon

**Category**: Most Creative Opus 4.6 Exploration

---

## License

MIT
