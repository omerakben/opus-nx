# Opus Nx

> **A persistent, peer-level AI orchestrator powered by Claude Opus 4.6**

Built for the [Cerebral Valley "Built with Opus 4.6" Hackathon](https://cerebralvalley.ai/e/claude-code-hackathon) (Feb 10-16, 2026)

## What is Opus Nx?

Opus Nx is a single Opus 4.6 brain that acts as your personal command center. It:

- **Decomposes complex goals** using extended thinking
- **Delegates to specialized sub-agents** (research, coding, scheduling, knowledge management)
- **Synthesizes everything** through one coherent interface
- **Remembers persistently** across sessions via a knowledge graph

## Why Opus 4.6?

The orchestrator leverages **deep reasoning and extended thinking** to plan before acting—analyzing task dependencies, selecting optimal agent strategies, and self-reflecting on execution quality. This is work only Opus can do.

## Architecture

```
You ←→ Opus Core (Opus 4.6) ←→ Sub-Agents ←→ Supabase + GitHub
              ↓
    [Extended Thinking Engine]
    [Memory Manager]
    [Agent Router (LangGraph Supervisor)]
```

### Sub-Agents

| Agent | Model | Specialization |
|-------|-------|----------------|
| **Research** | Sonnet 4.5 | Web search, paper analysis, fact verification |
| **Code** | Sonnet 4.5 | Code generation, debugging, repo management |
| **Knowledge** | Haiku 4.5 | Auto-categorization, cross-referencing, retrieval |
| **Planning** | Sonnet 4.5 | Task decomposition, scheduling, dependencies |
| **Communication** | Haiku 4.5 | Email drafting, message formatting, reports |

### Cost Strategy

- **Opus 4.6**: Orchestration + complex reasoning (~30% of budget)
- **Sonnet 4.5**: Execution-heavy agents (~50%)
- **Haiku 4.5**: High-volume, simple tasks (~20%)

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Core**: TypeScript, Anthropic SDK
- **Agents**: LangGraph, LangChain
- **Database**: Supabase (PostgreSQL + pgvector)
- **Embeddings**: Voyage AI (voyage-3)
- **Search**: Tavily
- **Dashboard**: Next.js 16

## Getting Started

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
cp .env.example .env.local
# Fill in your API keys

# Build all packages
pnpm build

# Run database migrations
pnpm db:migrate
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

## Project Structure

```
opus-nx/
├── apps/
│   └── dashboard/           # Next.js 16 dashboard (Day 5)
├── packages/
│   ├── core/                # Orchestrator, ThinkingEngine, MemoryManager
│   ├── agents/              # Specialized sub-agents
│   ├── db/                  # Supabase client and queries
│   └── shared/              # Shared utilities
├── configs/
│   ├── agents.yaml          # Agent definitions
│   ├── categories.yaml      # Knowledge taxonomy
│   └── prompts/             # System prompts for each agent
├── turbo.json
└── package.json
```

## Development Roadmap

- [x] **Day 1**: Foundation (monorepo, Supabase schema, ThinkingEngine)
- [ ] **Day 2**: Knowledge Layer (semantic search, auto-categorization)
- [ ] **Day 3**: Agent Framework (LangGraph, Research + Code agents)
- [ ] **Day 4**: Remaining Agents + Memory persistence
- [ ] **Day 5**: Dashboard (real-time visualization)
- [ ] **Day 6**: Integration + Demo flow
- [ ] **Day 7**: Polish + Submit

## Demo Scenario

**"Help me prepare for an Anthropic interview"**

This meta demo showcases Opus Nx orchestrating your own interview prep:

1. **Opus 4.6 thinks**: Decomposes the goal with visible extended thinking
2. **Research Agent**: Gathers info on Anthropic's mission, recent papers
3. **Knowledge Agent**: Categorizes and cross-references findings
4. **Planning Agent**: Creates a study timeline with milestones
5. **Code Agent**: Generates practice coding challenges
6. **Communication Agent**: Drafts thank-you email templates
7. **Dashboard**: Shows real-time progress, task pipeline, knowledge graph

## Contributing

This is a hackathon project, but contributions are welcome after the event!

## License

MIT

---

Built with Claude Code for the Cerebral Valley Hackathon
