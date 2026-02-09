# Opus Nx

**AI reasoning you can see and steer.**

Built for the [Cerebral Valley "Built with Opus 4.6" Hackathon](https://cv.inc/e/claude-code-hackathon) (Feb 10-16, 2026)

---

## The Innovation

Every AI system today treats extended thinking as a black box: reasoning happens, a response comes out, and the thinking vanishes. Opus Nx transforms Claude Opus 4.6's extended thinking into **persistent reasoning graphs**. Navigate decision points, steer parallel branches, verify each step, and build on past thinking across sessions.

| What Others Do                       | What Opus Nx Does                                                |
| ------------------------------------ | ---------------------------------------------------------------- |
| Extended thinking improves responses | Extended thinking becomes **navigable and steerable**            |
| AI conversations are stateless       | Every reasoning chain is **persistent and traversable**          |
| "The AI said X"                      | "We reasoned A -> B -> C together to conclude X"                 |
| Black box decisions                  | **Transparent reasoning** you can explore and redirect           |
| Single reasoning path                | **Parallel branches** you steer with convergence analysis        |
| Trust the final answer               | **Step-by-step verification** -- check each reasoning step       |
| Fixed context window                 | **Hierarchical memory** -- sessions that never forget            |

---

## Core Features

### 1. ThinkGraph -- Navigate How Your AI Thinks

Every extended thinking session is parsed into a persistent graph of reasoning nodes, decision points, and edges. Explore reasoning chains visually with `@xyflow/react`, see which alternatives were considered at each decision point, and query past reasoning with natural language. The graph persists to Supabase with graceful degradation when the database is unavailable.

### 2. Metacognitive Self-Audit -- Understand Your AI's Patterns

Using Opus 4.6's full 50k thinking token budget, the system turns reasoning inward -- analyzing its own patterns, detecting systematic biases, identifying recurring strategies, and generating self-improvement hypotheses. Together, you and the AI identify thinking habits and calibrate reasoning quality.

### 3. ThinkFork -- Steer Multiple Perspectives

Complex decisions spawn up to four concurrent reasoning branches, each with a distinct perspective:

- **Conservative** -- Risk-averse, precedent-focused analysis
- **Aggressive** -- Opportunity-seeking, growth-oriented analysis
- **Balanced** -- Weighted trade-off evaluation
- **Contrarian** -- Challenges assumptions and conventional wisdom

You steer the reasoning: debate mode makes branches argue against each other, branch steering lets you redirect mid-stream, and convergence metrics quantify where perspectives agree or diverge.

### 4. Graph of Thoughts (GoT) -- Deep Dive Complex Problems

Goes beyond linear chains and trees to support arbitrary graph structures for reasoning. Implements BFS, DFS, and best-first search strategies over thought nodes, with aggregation operations that merge insights from multiple reasoning paths and refinement operations that improve existing thoughts.

### 5. Process Reward Model (PRM) -- Verify Before You Trust

Rather than trusting final answers blindly, the PRM verifier lets you inspect each individual reasoning step. Uses geometric mean scoring to identify the weakest links in a reasoning chain. Steps are rated as correct, incorrect, or neutral, with detailed justification for each judgment.

### 6. Hierarchical Memory -- Sessions That Never Forget

Implements a three-tier memory architecture inspired by the MemGPT paper:

- **Main Context** -- Active working memory within the LLM context window
- **Recall Storage** -- Recently accessed memories retrievable by semantic search
- **Archival Storage** -- Long-term knowledge base with Voyage AI embeddings

Build on past reasoning across sessions with automatic eviction paging that moves memories between tiers based on relevance and recency.

### 7. Orchestrator -- Adaptive Session Management

The central brain that routes tasks to the appropriate thinking effort level using dynamic classification (simple, standard, complex). Manages token budgets, triggers context compaction for infinite sessions, and injects relevant knowledge context before each reasoning step.

---

## Architecture

```
+------------------------------------------------------------------+
|                       Next.js 16 Dashboard                       |
|  +------------+ +----------+ +-----------+ +--------+ +--------+ |
|  | ThinkGraph | | ThinkFork| | Metacog   | | GoT    | | PRM    | |
|  | Visualizer | | Panel    | | Insights  | | Panel  | | Verify | |
|  +-----+------+ +----+-----+ +----+------+ +---+----+ +---+----+ |
|        |              |            |            |          |       |
+--------+--------------+------------+------------+----------+------+
         |              |            |            |          |
         v              v            v            v          v
+------------------------------------------------------------------+
|                        @opus-nx/core                             |
|                                                                  |
|  +---------------+  +-------------+  +--------------+            |
|  | Thinking      |  | ThinkGraph  |  | Metacognition|            |
|  | Engine        |  |             |  | Engine       |            |
|  +---------------+  +-------------+  +--------------+            |
|                                                                  |
|  +---------------+  +-------------+  +--------------+            |
|  | ThinkFork     |  | GoT Engine  |  | PRM Verifier |            |
|  | (4 branches)  |  | (BFS/DFS)   |  | (step-level) |            |
|  +---------------+  +-------------+  +--------------+            |
|                                                                  |
|  +---------------+  +-----------------------------------------+  |
|  | Orchestrator  |  | Memory Manager + Memory Hierarchy       |  |
|  | (routing)     |  | (Voyage AI embeddings, 3-tier paging)  |  |
|  +---------------+  +-----------------------------------------+  |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|             Supabase (PostgreSQL + pgvector)                      |
|  thinking_nodes | reasoning_edges | decision_points | sessions   |
|  knowledge_entries | metacognitive_insights | contradictions     |
+------------------------------------------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|  Claude Opus 4.6   |   Voyage AI Embeddings   |   Tavily Search  |
|  (50k thinking)    |   (voyage-3, 1024-dim)   |   (web research)  |
+------------------------------------------------------------------+
```

---

## Tech Stack

| Layer             | Technology                                            |
| ----------------- | ----------------------------------------------------- |
| **LLM**           | Claude Opus 4.6 (extended thinking, up to 50k tokens) |
| **Framework**     | Next.js 16 (App Router, Turbopack), React 19          |
| **Styling**       | Tailwind CSS 4, shadcn/ui                             |
| **Visualization** | @xyflow/react (react-flow)                            |
| **Database**      | Supabase (PostgreSQL + pgvector, HNSW indexes)        |
| **Embeddings**    | Voyage AI (voyage-3, 1024-dim)                        |
| **Agents**        | LangChain + LangGraph                                 |
| **Monorepo**      | Turborepo + pnpm 9.15                                 |
| **Language**      | TypeScript 5.7+ (strict mode)                         |
| **Runtime**       | Node.js 22+                                           |
| **Testing**       | Vitest                                                |

---

## Quick Start

### Prerequisites

- **Node.js** 22 or later
- **pnpm** 9.15 or later
- **Supabase** account (PostgreSQL + pgvector)
- **API Keys**: Anthropic (Claude Opus 4.6), Voyage AI, Tavily

### Installation

```bash
# Clone the repository
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Anthropic API (Required)
ANTHROPIC_API_KEY=sk-ant-...

# App Auth (Required -- used for HMAC-signed cookie authentication)
AUTH_SECRET=your-secret-here

# Supabase (Required)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...

# Voyage AI Embeddings (Required for knowledge storage)
VOYAGE_API_KEY=pa-...

# Tavily Search (Required for Research Agent)
TAVILY_API_KEY=tvly-...
```

Then build and run:

```bash
# Run database migrations
pnpm db:migrate

# Build all packages
pnpm build

# Start the development server
pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

### Running Just the Web Dashboard

```bash
pnpm --filter @opus-nx/web dev
```

---

## Project Structure

```
opus-nx/
├── apps/
│   └── web/                          # Next.js 16 dashboard
│       └── src/
│           ├── app/
│           │   └── api/              # 21 API routes
│           │       ├── auth/         # Authentication (login, logout)
│           │       ├── think/        # Extended thinking (alias)
│           │       ├── thinking/     # Extended thinking (canonical + SSE stream)
│           │       ├── fork/         # ThinkFork branches + steering
│           │       ├── got/          # Graph of Thoughts reasoning
│           │       ├── verify/       # PRM step-by-step verification
│           │       ├── memory/       # Hierarchical memory operations
│           │       ├── sessions/     # Session CRUD + node listing
│           │       ├── reasoning/    # ThinkGraph queries + checkpoints
│           │       ├── insights/     # Metacognitive insights
│           │       ├── stream/       # SSE streaming (compatibility)
│           │       ├── seed/         # Demo data seeding
│           │       ├── demo/         # Demo mode
│           │       └── health/       # Health check
│           └── components/           # 37 React components
│               ├── fork/             # BranchCard, Convergence, ForkPanel
│               ├── got/              # GoTPanel
│               ├── graph/            # ThinkingGraph, ThinkingNode, StreamingNode
│               ├── insights/         # InsightCard, InsightsPanel
│               ├── layout/           # Dashboard, Header, Panels, MobileNav
│               ├── memory/           # MemoryPanel
│               ├── sessions/         # SessionCard, SessionList, SessionStats
│               ├── thinking/         # ThinkingInput, ThinkingStream, TokenCounter
│               ├── tour/             # DemoTour
│               ├── verify/           # VerificationPanel
│               └── ui/               # shadcn/ui primitives
├── packages/
│   ├── core/                         # Core reasoning engine
│   │   └── src/
│   │       ├── thinking-engine.ts    # Claude Opus 4.6 wrapper (adaptive effort)
│   │       ├── think-graph.ts        # Reasoning graph parser and persistence
│   │       ├── orchestrator.ts       # Task routing and session management
│   │       ├── metacognition.ts      # Self-reflection engine (50k budget)
│   │       ├── thinkfork.ts          # 4-branch parallel reasoning
│   │       ├── got-engine.ts         # Graph of Thoughts (BFS/DFS/best-first)
│   │       ├── prm-verifier.ts       # Process Reward Model verification
│   │       ├── memory-hierarchy.ts   # 3-tier MemGPT-style memory
│   │       ├── memory-manager.ts     # Voyage AI embeddings and search
│   │       └── types/                # Shared type definitions
│   ├── agents/                       # LangChain/LangGraph agent implementations
│   ├── db/                           # Supabase client, queries, and types
│   │   └── migrations/               # Mirror of canonical migrations
│   └── shared/                       # Shared utilities and config loaders
├── configs/
│   ├── agents.yaml                   # 5 agent definitions (research, code, knowledge, planning, communication)
│   ├── categories.yaml               # Knowledge taxonomy (5 categories)
│   └── prompts/                      # System prompts
│       ├── orchestrator.md
│       ├── metacognition.md
│       ├── research.md
│       ├── code.md
│       ├── knowledge.md
│       ├── planning.md
│       ├── communication.md
│       └── thinkfork/                # Per-branch reasoning prompts
│           ├── conservative.md
│           ├── aggressive.md
│           ├── balanced.md
│           ├── contrarian.md
│           └── comparison.md
├── supabase/
│   └── migrations/                   # Canonical SQL migrations
│       ├── 001_initial_schema.sql    # Core tables + pgvector HNSW index
│       ├── 002_thinking_graph.sql    # ThinkGraph tables + RPC functions
│       └── 003_node_type.sql         # Node type column extension
├── CLAUDE.md                         # Claude Code project instructions
├── ARCHITECTURE.md                   # Technical architecture document
├── PRD.md                            # Product requirements document
└── ROADMAP.md                        # Development plan
```

---

## Why Opus 4.6?

Opus Nx is built exclusively for Claude Opus 4.6 because no other model provides the capabilities this system requires:

| Capability           | Requirement                                              | Opus 4.6                    |
| -------------------- | -------------------------------------------------------- | --------------------------- |
| Metacognition        | 50,000 thinking tokens to reason about its own reasoning | Only model with this budget |
| Infinite Sessions    | 1M token context window with compaction                  | Largest context available   |
| Complex Meta-Prompts | Reliable instruction following for multi-layer prompts   | Best in class               |
| Extended Thinking    | Native streaming with thinking deltas                    | Uniquely suited             |
| 128K Output          | Long-form reasoning and analysis generation              | Maximum output capacity     |

---

## Research Foundation

Opus Nx implements algorithms from four foundational papers in LLM reasoning:

| Paper                                                                           | Year | Module                          | Key Contribution                                                 |
| ------------------------------------------------------------------------------- | ---- | ------------------------------- | ---------------------------------------------------------------- |
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al.)               | 2023 | `thinkfork.ts`, `got-engine.ts` | BFS/DFS search over reasoning trees with state evaluation        |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al.)            | 2023 | `got-engine.ts`                 | Arbitrary thought graph topology with aggregation and refinement |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al.) | 2023 | `prm-verifier.ts`               | Process supervision -- verify each reasoning step independently  |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al.)                      | 2023 | `memory-hierarchy.ts`           | Three-tier memory hierarchy with automatic paging between tiers  |

---

## Development Commands

### Core Workflow

```bash
pnpm install                          # Install all dependencies
pnpm build                            # Build all packages (Turborepo)
pnpm dev                              # Start all dev servers
pnpm lint                             # Run linting across all packages
pnpm typecheck                        # Type-check all packages
pnpm test                             # Run tests (includes migration drift check)
```

### Database

```bash
pnpm db:migrate                       # Run Supabase migrations
pnpm db:generate                      # Regenerate TypeScript types from Supabase
pnpm check:migrations                 # Verify migration drift between supabase/ and packages/db/
```

### Package-Specific

```bash
pnpm --filter @opus-nx/web dev        # Start just the web dashboard
pnpm --filter @opus-nx/web typecheck  # Type-check web package only
pnpm --filter @opus-nx/core test      # Run core engine tests only
```

### Migration Workflow

Migrations must exist in both locations and be identical:

1. `supabase/migrations/` (canonical source)
2. `packages/db/migrations/` (mirror)

The `pnpm check:migrations` script enforces synchronization between these directories.

---

## API Reference

| Route                             | Method           | Purpose                               |
| --------------------------------- | ---------------- | ------------------------------------- |
| `/api/health`                     | GET              | Health check                          |
| `/api/auth`                       | POST             | Authenticate with AUTH_SECRET         |
| `/api/auth/logout`                | POST             | Clear auth cookie                     |
| `/api/thinking`                   | POST             | Extended thinking request (canonical) |
| `/api/thinking/stream`            | POST             | SSE streaming for thinking deltas     |
| `/api/think`                      | POST             | Extended thinking (alias)             |
| `/api/stream/[sessionId]`         | GET              | SSE stream (compatibility endpoint)   |
| `/api/fork`                       | POST             | Spawn ThinkFork parallel branches     |
| `/api/fork/steer`                 | POST             | Redirect a branch mid-reasoning       |
| `/api/got`                        | POST             | Graph of Thoughts reasoning           |
| `/api/verify`                     | POST             | PRM step-by-step verification         |
| `/api/memory`                     | GET/POST         | Hierarchical memory read/write        |
| `/api/sessions`                   | GET/POST         | List or create sessions               |
| `/api/sessions/[sessionId]`       | GET/PATCH/DELETE | Session CRUD                          |
| `/api/sessions/[sessionId]/nodes` | GET              | List thinking nodes for a session     |
| `/api/reasoning/[id]`             | GET              | Query ThinkGraph by ID                |
| `/api/reasoning/[id]/checkpoint`  | POST             | Create reasoning checkpoint           |
| `/api/insights`                   | GET/POST         | Metacognitive insights                |
| `/api/demo`                       | POST             | Generate demo data                    |
| `/api/seed`                       | POST             | Seed knowledge base                   |
| `/api/seed/business-strategy`     | POST             | Seed business strategy scenario       |

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) -- Technical architecture and system design
- [PRD.md](./PRD.md) -- Product requirements document
- [ROADMAP.md](./ROADMAP.md) -- Development plan and task breakdown
- [CLAUDE.md](./CLAUDE.md) -- Claude Code project instructions

---

## License

MIT

---

Built with Claude Code for the Cerebral Valley "Built with Opus 4.6" Hackathon

*Ozzy -- AI Engineer & Full-Stack Developer*
