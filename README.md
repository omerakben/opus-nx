# Opus Nx: Cognitive Architect

> **The first AI system where reasoning is persistent, queryable, and evolving**

Built for the [Cerebral Valley "Built with Opus 4.6" Hackathon](https://cv.inc/e/claude-code-hackathon) (Feb 10-16, 2026)

---

## The Innovation

While everyone else uses extended thinking as a black box to improve response quality, **Opus Nx transforms reasoning itself into a first-class, persistent, navigable data structure**.

| What Others Do | What Opus Nx Does |
|----------------|-------------------|
| Extended thinking improves responses | Extended thinking becomes **queryable history** |
| AI conversations are stateless | Every reasoning chain is **persistent** |
| "The AI said X" | "The AI reasoned A → B → C to conclude X" |
| Black box decisions | **Transparent decision archaeology** |

---

## Core Features

### ThinkGraph - Reasoning as Data Structure

Every extended thinking session creates a persistent graph node:
- Navigate reasoning chains visually
- See decision points with alternatives considered
- Query past reasoning with natural language
- Trace how conclusions were reached

### Metacognitive Self-Audit

Using Opus 4.6's 50k thinking token budget, the system **analyzes its own reasoning patterns**:
- Detect systematic biases
- Identify recurring strategies
- Generate self-improvement hypotheses
- *"Watch the AI think about how it thinks"*

### ThinkFork - Parallel Reasoning Branches

Complex decisions spawn 2-3 parallel reasoning branches:
```
Branch A (Conservative): 87% confidence
Branch B (Aggressive): 72% confidence
Branch C (Balanced): 81% confidence
[Compare reasoning paths side-by-side]
```

### Contradiction Resolution Engine

When new information conflicts with existing knowledge:
- Deep reasoning to analyze the contradiction
- Explicit resolution with full audit trail
- Knowledge graph updated with provenance

---

## Why Only Opus 4.6?

| Capability | Requirement | Opus 4.6 |
|------------|-------------|----------|
| Metacognition | 50k thinking tokens | Only model with this budget |
| Multi-session analysis | 200k context window | Largest context |
| Complex meta-prompts | Superior instruction following | Best in class |
| Deep reasoning | Extended thinking native | Uniquely suited |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Next.js Dashboard                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │  Reasoning  │ │  ThinkFork  │ │  Metacog    │ │  Thinking  │ │
│  │    Tree     │ │   Viewer    │ │  Insights   │ │   Stream   │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │
└─────────┼───────────────┼───────────────┼──────────────┼────────┘
          │               │               │              │
          ▼               ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         @opus-nx/core                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │
│  │  Thinking  │ │ ThinkGraph │ │ Metacog    │ │ Contradiction│  │
│  │  Engine    │ │            │ │ Engine     │ │  Resolver    │  │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │
│  ┌────────────┐ ┌────────────────────────────────────────────┐  │
│  │ ThinkFork  │ │           Memory Manager                   │  │
│  └────────────┘ └────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + pgvector)                    │
│  thinking_nodes │ reasoning_edges │ decision_points │ insights  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Claude Opus 4.6  │  Voyage AI Embeddings  │  Tavily Search     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **LLM** | Claude Opus 4.6 (extended thinking) |
| **Monorepo** | Turborepo + pnpm |
| **Core** | TypeScript 5.7+, Anthropic SDK |
| **Agents** | LangGraph, LangChain |
| **Database** | Supabase (PostgreSQL + pgvector) |
| **Embeddings** | Voyage AI (voyage-3, 1024-dim) |
| **Dashboard** | Next.js 16, React 19, Tailwind, shadcn/ui |
| **Visualization** | react-flow, D3.js |

---

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- Supabase account
- API keys: Anthropic, Voyage AI, Tavily

### Installation

```bash
# Clone the repo
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Fill in your API keys

# Run database migrations
pnpm db:migrate

# Build all packages
pnpm build

# Start the dashboard
pnpm --filter @opus-nx/web dev
```

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
VOYAGE_API_KEY=pa-...
TAVILY_API_KEY=tvly-...
```

---

## Project Structure

```
opus-nx/
├── apps/
│   └── web/                    # Next.js 16 dashboard
├── packages/
│   ├── core/                   # ThinkingEngine, ThinkGraph, Metacognition
│   │   └── src/
│   │       ├── thinking-engine.ts
│   │       ├── think-graph.ts
│   │       ├── metacognition.ts
│   │       ├── think-fork.ts
│   │       └── contradiction-resolver.ts
│   ├── agents/                 # Specialized sub-agents
│   ├── db/                     # Supabase client and queries
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql
│   │       └── 002_thinking_graph.sql
│   └── shared/                 # Shared utilities
├── configs/
│   ├── agents.yaml             # Agent definitions
│   ├── categories.yaml         # Knowledge taxonomy
│   └── prompts/                # System prompts
│       ├── orchestrator.md
│       └── metacognition.md
├── PRD.md                      # Product Requirements
├── ROADMAP.md                  # 5-Day Development Plan
├── ARCHITECTURE.md             # Technical Design
└── README.md
```

---

## Development Roadmap

| Day | Focus | Status |
|-----|-------|--------|
| 1 | ThinkGraph Foundation | Pending |
| 2 | Metacognition Engine | Pending |
| 3 | ThinkFork + Contradiction Resolution | Pending |
| 4 | Dashboard UI | Pending |
| 5 | Polish + Demo | Pending |

See [ROADMAP.md](./ROADMAP.md) for detailed task breakdown.

---

## Demo Flow

### Scene 1: Reasoning Archaeology (2 min)
*"Every time Opus thinks, we capture the reasoning as a navigable graph node..."*

### Scene 2: Metacognitive Self-Audit (2 min)
*"Using 50k thinking tokens, watch the AI analyze its own reasoning patterns..."*

### Scene 3: ThinkFork Branches (2 min)
*"Instead of one answer, see three parallel reasoning paths with different assumptions..."*

### Scene 4: Contradiction Resolution (1 min)
*"Watch it reason through conflicting information with full audit trail..."*

---

## Prize Target

**"Most Creative Opus 4.6 Exploration"**

No one else is treating extended thinking as a first-class, persistent, queryable artifact. This is genuine innovation that only Opus 4.6 can power.

---

## Documentation

- [PRD.md](./PRD.md) - Product Requirements Document
- [ROADMAP.md](./ROADMAP.md) - Detailed 5-Day Development Plan
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical Architecture

---

## License

MIT

---

Built with Claude Code for the Cerebral Valley Hackathon

*Ozzy - AI Engineer & Full-Stack Developer*
