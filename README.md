# Opus Nx

## AI reasoning you can see, steer, and verify

> What if you could watch an AI think — not just read its answer, but navigate the
> entire reasoning graph, deploy 6 competing agents, and verify every logical step?

Opus Nx transforms Claude Opus 4.6's extended thinking from an invisible black box into **persistent, navigable reasoning graphs**. Deploy a swarm of 6 specialized AI agents, fork reasoning into competing perspectives, verify every step, and watch metacognitive self-audits -- all in real time.

**[Live Demo](https://opus-nx.vercel.app)** | Research System for Persistent Reasoning Artifacts

**8 reasoning features** | **6 AI agents** | **4 research papers implemented** | **273 tests** | **2-service architecture**

---

## Why Opus Nx?

Every AI system today treats reasoning as disposable. Extended thinking improves the output, but the thinking itself vanishes the moment the response arrives. You get the answer -- never the journey.

**The problem is trust.** When you cannot see *how* an AI reached its conclusion, you cannot verify it, steer it, or build on it.

| Status Quo                      | Opus Nx                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| Reasoning happens behind a wall | Reasoning becomes a **navigable graph** you can explore                  |
| Single AI perspective           | **6 specialized agents** collaborate, debate, and synthesize             |
| "Trust the final output"        | **Step-by-step verification** with scored confidence                     |
| No competing viewpoints         | **4 concurrent reasoning styles** you steer in real time                 |
| Conversations are stateless     | Every reasoning chain is **persistent and searchable**                   |
| No self-awareness               | **Metacognitive self-audit** detects the AI's own biases and blind spots |

---

## Core Features

### 1. Agent Swarm -- 6 AI Specialists Collaborating in Real-Time

Deploy a swarm of 6 specialized AI agents that analyze problems from different angles:

- **Maestro** -- Orchestrates the swarm, decomposes queries, assigns subtasks
- **Deep Thinker** -- Multi-step extended reasoning with maximum thinking budget
- **Contrarian** -- Devil's advocate that challenges assumptions and finds blind spots
- **Verifier** -- Process Reward Model verification of every reasoning step
- **Synthesizer** -- Merges diverse agent outputs into a coherent conclusion
- **Metacognition** -- Audits the swarm's collective reasoning for biases and patterns

Agents execute in **phased parallel** with real-time WebSocket event streaming. Watch the shared reasoning graph build live as agents think, challenge, verify, and synthesize. Human-in-the-loop checkpoints let you steer the swarm mid-analysis.

### 2. ThinkGraph -- Navigate How Your AI Thinks

Extended thinking is parsed into a persistent graph of reasoning nodes, decision points, and directed edges. Each node carries content, confidence scores, and metadata. The graph renders as an interactive visualization powered by `@xyflow/react`, where you can click into any decision point to explore alternatives.

### 3. ThinkFork -- 4 Competing Perspectives

Complex decisions spawn four concurrent reasoning branches (conservative, aggressive, balanced, contrarian). **Debate mode** makes them argue. **Branch steering** redirects any branch mid-stream. **Convergence analysis** quantifies agreement and divergence. Based on [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023).

### 4. PRM Verifier -- Check Every Step

Process Reward Model inspects each individual step in a reasoning chain. Every step is rated correct, incorrect, or neutral with a detailed justification. The chain's overall score uses geometric mean aggregation, surfacing the weakest link. Based on [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023).

### 5. Graph of Thoughts -- Explore Arbitrary Reasoning Topologies

BFS, DFS, or best-first search over arbitrary thought graphs. Thoughts branch, merge, and get verified at each step. Based on [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023).

### 6. Memory Hierarchy -- 3-Tier Persistent Knowledge

MemGPT-inspired three-tier memory: working context, recall history, and archival storage with semantic search. Auto-eviction and promotion keep the most relevant knowledge accessible. Based on [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023).

### 7. Metacognitive Self-Audit

Using Opus 4.6's full 50,000-token thinking budget, the system turns reasoning inward -- analyzing its own patterns, detecting biases, identifying recurring strategies, and generating improvement hypotheses.

### 8. Orchestrator -- Adaptive Effort Routing

Not every question deserves the same thinking budget. The orchestrator classifies tasks and routes them to the appropriate effort level (`low` / `medium` / `high` / `max`), managing token budgets and context compaction.

---

## Grounded in Research

Every core feature implements a peer-reviewed technique — this is systems engineering on top of established reasoning frameworks.

| Paper                                                                                 | Module           | Key Idea                                                         |
| ------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023)               | ThinkFork        | BFS/DFS search over reasoning trees with state evaluation        |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | PRM Verifier     | Process supervision -- verify each reasoning step independently  |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023)            | GoT Engine       | Arbitrary thought graph topology with aggregation and refinement |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023)                      | Memory Hierarchy | 3-tier memory with paging and auto-eviction                      |

---

## Architecture

### Two-Service Deployment

```
Browser --> Vercel (Next.js 16)              Fly.io (Python FastAPI)
              |                                   |
              +-- /api/swarm (POST) -----------> /api/swarm (proxied)
              +-- /api/swarm/token (GET) ------> Returns HMAC token
              |                                   |
              +-- Browser opens WebSocket -----> wss://opus-nx-agents.fly.dev/ws/{sessionId}
              |
              +-- /api/thinking, /api/fork, /api/verify, /api/got, /api/memory
              +-- /api/sessions, /api/insights, /api/reasoning
              +-- Supabase (PostgreSQL + pgvector)
```

### Service 1: Next.js Dashboard (Vercel)

UI (React 19), API routes (serverless), Supabase DB layer, ThinkGraph visualization, ThinkFork, PRM Verifier, GoT Engine, Memory Hierarchy.

### Service 2: Python Agent Swarm (Fly.io)

FastAPI server, 6 specialized AI agents (Maestro, DeepThinker, Contrarian, Verifier, Synthesizer, Metacognition), WebSocket event streaming, SharedReasoningGraph.

### Monorepo Structure

```text
apps/web/              Next.js 16 dashboard (App Router, Turbopack)
agents/                Python FastAPI swarm backend (Fly.io)
packages/
  core/                ThinkingEngine, ThinkGraph, ThinkFork, Metacognition,
                       PRM, Orchestrator, GoT Engine, Memory Hierarchy
  db/                  Supabase client, query functions, types
  shared/              Shared types, utilities, config loaders
configs/
  agents.yaml          Agent definitions
  categories.yaml      Knowledge taxonomy
  prompts/             System prompts (orchestrator, metacognition, thinkfork styles)
supabase/
  migrations/          Canonical SQL migrations (3 files)
```

---

## Quick Start

### Prerequisites

- **Node.js** 22+ and **pnpm** 9.15+
- **Python** 3.12+ and **uv** (for the agent swarm)
- **Supabase** account (PostgreSQL + pgvector)
- **API Keys**: Anthropic (Claude Opus 4.6)

### Installation

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
pnpm install
cp .env.example .env
# Edit .env with your credentials
```

### Start the Dashboard

```bash
pnpm db:migrate   # Run database migrations
pnpm build        # Build all packages
pnpm dev          # Start dev server at http://localhost:3000
```

### Start the Agent Swarm (Optional)

```bash
cd agents
cp .env.example .env
# Edit .env with your credentials (AUTH_SECRET must match the dashboard)
uv run uvicorn src.main:app --reload --port 8000
```

Set `NEXT_PUBLIC_SWARM_URL=http://localhost:8000` in the dashboard's `.env` to connect.

---

## Dashboard Navigation

```
Header: [Logo] [Session Title] [Replay Tour] [Help]

Left Sidebar: Sessions list

Center Tabs:
  +-- ThinkGraph  (default -- reasoning graph explorer)
  +-- Swarm       (multi-agent orchestration view)
  +-- GoT         (Graph of Thoughts explorer)
  +-- Verify      (PRM step-by-step verification)

Right Sidebar:
  +-- Insights    (metacognitive audit results)
  +-- Fork        (ThinkFork parallel reasoning)
  +-- Memory      (3-tier memory hierarchy)

Bottom Panel: Thinking stream + query input
```

---

## API Reference

### Core Reasoning

| Route                  | Method   | Purpose                                        |
| ---------------------- | -------- | ---------------------------------------------- |
| `/api/thinking`        | POST     | Extended thinking request with adaptive effort |
| `/api/thinking/stream` | POST     | SSE streaming for real-time thinking deltas    |
| `/api/fork`            | POST     | Spawn ThinkFork parallel reasoning branches    |
| `/api/fork/steer`      | POST     | Redirect a branch mid-reasoning                |
| `/api/verify`          | POST     | PRM step-by-step verification                  |
| `/api/got`             | POST     | Graph of Thoughts reasoning                    |
| `/api/insights`        | GET/POST | Metacognitive self-audit                       |
| `/api/memory`          | GET/POST | Hierarchical memory operations                 |

### Agent Swarm

| Route                               | Method | Purpose                             |
| ----------------------------------- | ------ | ----------------------------------- |
| `/api/swarm`                        | POST   | Initiate multi-agent swarm analysis |
| `/api/swarm/token`                  | GET    | Generate WebSocket auth token       |
| `/api/swarm/[sessionId]/checkpoint` | POST   | Human-in-the-loop checkpoint        |

### Sessions and Data

| Route                             | Method           | Purpose                      |
| --------------------------------- | ---------------- | ---------------------------- |
| `/api/sessions`                   | GET/POST         | List or create sessions      |
| `/api/sessions/[sessionId]`       | GET/PATCH/DELETE | Session CRUD                 |
| `/api/sessions/[sessionId]/nodes` | GET              | Thinking nodes for a session |
| `/api/sessions/[sessionId]/share` | POST             | Generate share link          |
| `/api/reasoning/[id]`             | GET              | ThinkGraph node details      |
| `/api/reasoning/[id]/checkpoint`  | POST             | Human-in-the-loop checkpoint |

---

## Why Opus 4.6?

| Capability                      | Why It Matters                                          |
| ------------------------------- | ------------------------------------------------------- |
| **50k thinking tokens**         | Metacognitive self-audit and deep multi-agent reasoning |
| **Extended thinking streaming** | Real-time ThinkGraph construction from thinking deltas  |
| **1M context window**           | Long sessions with orchestrator-managed compaction      |
| **128K output**                 | Long-form multi-branch analysis generation              |
| **Instruction fidelity**        | Reliable execution of multi-layer meta-prompts          |

---

## Tech Stack

| Layer             | Technology                                      |
| ----------------- | ----------------------------------------------- |
| **LLM**           | Claude Opus 4.6 (extended thinking, 50k tokens) |
| **Dashboard**     | Next.js 16 (App Router, Turbopack), React 19    |
| **Agent Swarm**   | Python 3.12, FastAPI, Anthropic SDK             |
| **Styling**       | Tailwind CSS 4, shadcn/ui                       |
| **Visualization** | @xyflow/react (react-flow)                      |
| **Database**      | Supabase (PostgreSQL + pgvector, HNSW indexes)  |
| **Deployment**    | Vercel (dashboard) + Fly.io (agents)            |
| **Monorepo**      | Turborepo + pnpm                                |
| **Language**      | TypeScript 5.7+ (strict mode), Python 3.12      |
| **Testing**       | Vitest, pytest                                  |

---

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (Turborepo)
pnpm dev              # Start all dev servers
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm test             # Run tests (273 tests across 8 suites)
pnpm db:migrate       # Run Supabase migrations
pnpm check:migrations # Verify migration sync
```

---

## Team

**Ozzy** -- AI Engineer & Full-Stack Developer

Built with Claude Code

**Research Focus**: Persistent reasoning artifacts, hypothesis lifecycle management, and multi-perspective convergent debate

---

## License

MIT
