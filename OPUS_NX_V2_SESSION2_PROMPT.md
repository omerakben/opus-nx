# Opus NX V2 — Session 2: Dashboard, Persistence, Deployment

> **Copy-paste this entire prompt into your next Claude Code session.**
> **Branch**: `develop` | **Model**: Opus 4.6

---

## Your Role

You are the **Principal Architect and Team Lead** for Opus NX V2. You will organize an army of Opus 4.6 agents to complete the remaining V2 implementation. You are the orchestrator, verifier, task manager, and researcher.

**Rules:**
1. **You own the project.** Be skeptical about edge cases, code review, and code cleanliness.
2. **Organize specialized agents** with clear prompts, task assignments, and quality gates.
3. **Use Context7, web search, and MCP tools** for documentation research when needed.
4. **Cross-check everything.** Event schemas must match Python ↔ TypeScript. Auth patterns must be identical. No silent failures.
5. **Run ALL tests before committing**: `pnpm test` (monorepo), `pnpm typecheck`, `pnpm lint`, `cd agents && uv run ruff check src/ tests/ && uv run pytest tests/ -v`
6. **Browser validation with Playwright MCP** before every commit — verify the dashboard loads, no console errors.

---

## What's Already Done (Session 1)

Session 1 completed **Phases 1-3** — the entire Python agent backend + dashboard adapter:

### Python Backend (`agents/`) — 21 files, ~3,600 lines, 54 tests passing

| Layer | Files | Status |
|-------|-------|--------|
| **Foundation** | `config.py`, `graph/models.py`, `graph/reasoning_graph.py`, `events/bus.py`, `events/types.py` | DONE |
| **6 Agents** | `agents/base.py`, `deep_thinker.py`, `contrarian.py`, `verifier.py`, `synthesizer.py`, `metacognition.py` | DONE |
| **Orchestration** | `swarm.py` (SwarmManager), `server.py` (FastAPI+WS), `main.py` | DONE |
| **PRM Tools** | `tools/verification.py` (geometric mean scoring, pattern detection) | DONE |
| **Tests** | `test_bus.py`, `test_graph.py`, `test_deep_thinker.py`, `test_swarm.py`, `test_verification.py` — **54/54 passing** | DONE |

### Dashboard Adapter (`apps/web/`) — 3 files

| File | Status |
|------|--------|
| `lib/swarm-client.ts` — REST + WebSocket client, typed event union, app event bus bridge | DONE |
| `lib/hooks/use-swarm.ts` — React hook with per-agent state machine | DONE |
| `lib/hooks/index.ts` — Updated exports | DONE |

### Key Technical Decisions Already Made
- **API pattern**: `thinking: {"type": "adaptive"}` + `output_config: {"effort": self.effort}` — NOT deprecated `budget_tokens`
- **Thinking signatures**: Preserved from `block.signature`, never fabricated
- **Concurrency**: `asyncio.gather(return_exceptions=True)` for partial results (NOT `TaskGroup`)
- **Rate limiting**: 2.5s staggered launches for Tier 2
- **Auth**: HMAC-SHA256 `hmac.new(key=secret.encode(), msg=b"opus-nx-authenticated", hashlib.sha256)`
- **EventBus**: `asyncio.Queue(maxsize=500)` per session, drop on slow subscribers
- **Graph**: NetworkX with `asyncio.Lock` for coroutine safety
- **9 event types**: All match exactly between Python and TypeScript (verified)

---

## What Remains (Session 2) — 4 Phases

### PHASE 4: Persistence Layer (~400 lines Python + ~30 lines SQL)

| Task | File | Description |
|------|------|-------------|
| **P1: Neo4j Client** | `agents/src/graph/neo4j_client.py` | Background sync from NetworkX → Neo4j AuraDB. `sync_node()`, `sync_edge()`, killer Cypher query: "challenged but survived verification". Fire-and-forget — NOT in critical path. Graceful degradation if Neo4j unavailable. |
| **P2: Supabase Sync** | `agents/src/persistence/supabase_sync.py` | Persist reasoning nodes to existing `thinking_nodes` table, edges to `reasoning_edges` table. Map V2 agent names + edge types to V1 schema. Background async — system works without it. |
| **P3: Migration 007** | `supabase/migrations/007_swarm_edges.sql` + mirror to `packages/db/migrations/` | Extend `reasoning_edges` CHECK constraint for new edge types (`challenges`, `verifies`, `merges`, `observes`). Add `agent_name` and `swarm_session_id` columns to `thinking_nodes`. Add indexes. |
| **P4: Wire persistence** | `agents/src/graph/reasoning_graph.py` | Add listener in SharedReasoningGraph that fires Neo4j + Supabase sync on node/edge creation. `asyncio.create_task()` fire-and-forget. |

**Reference spec**: OPUS_NX_V2_SPEC.md → SPEC 16 (Neo4j Client), SPEC 15 (Migration)

### PHASE 5: Dashboard Swarm UI (~800 lines TypeScript/TSX)

| Task | File | Description |
|------|------|-------------|
| **D1: SwarmView** | `apps/web/src/components/swarm/SwarmView.tsx` | Container component. Shows agent cards grid + swarm status. Uses `useSwarm` hook. Start button triggers swarm. Shows synthesis result when complete. |
| **D2: AgentCard** | `apps/web/src/components/swarm/AgentCard.tsx` | Per-agent card. Status badge (pending→thinking→completed→error), live thinking stream (scrollable), conclusion preview, confidence meter, token count. Color-coded by agent type. |
| **D3: SwarmTimeline** | `apps/web/src/components/swarm/SwarmTimeline.tsx` | Vertical timeline of swarm events. Each event is a row: timestamp, agent icon, event description. CHALLENGES edges show in red, VERIFIES in blue. Real-time append as events arrive. |
| **D4: Edge types** | `apps/web/src/components/graph/EdgeTypes.tsx` + `lib/colors.ts` | Extend existing edge type system with `challenges` (red `#ef4444`, dashed), `verifies` (blue `#3b82f6`, solid), `merges` (green), `observes` (purple). |
| **D5: Swarm page/tab** | Wire into existing layout | Add "Swarm" tab to the right sidebar analysis panel (alongside existing "Insights" and "Fork" tabs). Route to SwarmView when selected. |
| **D6: Proxy route** | `apps/web/src/app/api/swarm/route.ts` | Next.js proxy for the Python backend. POST → forward to `NEXT_PUBLIC_SWARM_URL/api/swarm`. Adds auth header. Handles CORS for production. |

**Pattern reference**: Follow existing components in `apps/web/src/components/`. Use shadcn/ui, Tailwind CSS 4, Radix UI. Check existing `InsightsPanel.tsx` and `ForkPanel.tsx` for right-sidebar tab patterns.

### PHASE 6: Deployment (~200 lines config)

| Task | File | Description |
|------|------|-------------|
| **F1: Dockerfile** | `agents/Dockerfile` | Python 3.12-slim, uv for dependency install, `uvicorn src.server:app`. Multi-stage build. |
| **F2: Docker Compose** | `infra/docker-compose.yml` | Local dev: `agents` service (port 8000) + `neo4j:5-community` (ports 7474, 7687). |
| **F3: Fly.io config** | `infra/fly.toml` | Production: `shared-cpu-1x`, 512MB, WebSocket support (`idle_timeout: 600`), auto-stop/start. |
| **F4: Env vars** | Update `.env.example` | Add `NEXT_PUBLIC_SWARM_URL`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`. |

**Reference spec**: OPUS_NX_V2_SPEC.md → SPEC 17 (Deployment)

### PHASE 7: Integration Testing & Demo Prep

| Task | Description |
|------|-------------|
| **T1: E2E swarm test** | Integration test with mocked Claude API (`AsyncAnthropic`). Full pipeline: query → SwarmManager → 6 agents → events → synthesis. Verify event sequence, graph node creation, edge types. |
| **T2: WebSocket test** | Test the FastAPI WebSocket endpoint. Connect, subscribe, trigger swarm, verify events arrive in correct order. Test heartbeat. Test auth rejection (invalid token). |
| **T3: Dashboard E2E** | Playwright test: navigate to dashboard, trigger swarm (mocked backend), verify AgentCards appear, thinking streams, graph updates, synthesis displays. |
| **T4: Demo scenarios** | Pre-test 3 demo questions with real Claude API: (1) "Should we migrate our monolith to microservices?" (2) "What's the optimal strategy for entering the AI market in 2026?" (3) "Is blockchain overhyped or genuinely transformative?" |

---

## Agent Team Organization

Organize these 5 specialized agents to work in parallel:

### Agent 1: "persistence-architect" (Backend)
**Type**: `general-purpose`
**Tasks**: P1 (Neo4j client), P2 (Supabase sync), P4 (Wire persistence into graph)
**Prompt**: "You are a database persistence specialist. Implement the Neo4j AuraDB client and Supabase sync layer for the Opus NX V2 swarm. Read OPUS_NX_V2_SPEC.md SPEC 16 for the Neo4j client spec. Read `agents/src/graph/reasoning_graph.py` for the graph you're syncing from. Read `packages/db/src/thinking-nodes.ts` and `packages/db/src/` to understand the existing Supabase schema. Both persistence layers are fire-and-forget background tasks — the system must work without them. Use `asyncio.create_task()` for non-blocking sync. Use `neo4j>=5.26` AsyncGraphDatabase. Graceful degradation when Neo4j/Supabase unavailable."

### Agent 2: "dashboard-builder" (Frontend)
**Type**: `general-purpose`
**Tasks**: D1 (SwarmView), D2 (AgentCard), D3 (SwarmTimeline), D5 (Wire into layout)
**Prompt**: "You are a React 19 + Next.js 16 frontend specialist. Build the swarm dashboard UI components. Read `apps/web/src/components/insights/InsightsPanel.tsx` and `apps/web/src/components/fork/ForkPanel.tsx` for the existing right-sidebar tab pattern. Read `apps/web/src/lib/hooks/use-swarm.ts` for the hook API you'll consume. Use shadcn/ui components, Tailwind CSS 4, Radix UI. Follow existing naming conventions (kebab-case files, PascalCase components). The SwarmView must show: (1) agent cards grid with live status, (2) thinking stream per agent, (3) synthesis result, (4) total tokens/duration. AgentCard must animate between states (pending→thinking→completed). Use `framer-motion` if already installed, otherwise CSS transitions."

### Agent 3: "infra-deployer" (DevOps)
**Type**: `general-purpose`
**Tasks**: F1 (Dockerfile), F2 (Docker Compose), F3 (Fly.io), F4 (Env vars), D6 (Proxy route), P3 (Migration 007)
**Prompt**: "You are a DevOps and infrastructure specialist. Build the deployment stack for Opus NX V2. Read OPUS_NX_V2_SPEC.md SPEC 17 for Dockerfile, fly.toml, and docker-compose specs. Read `agents/pyproject.toml` for Python dependencies. Read existing `supabase/migrations/` for migration naming conventions. The Dockerfile uses uv (not pip): `COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv`. The proxy route in Next.js forwards POST `/api/swarm` to `NEXT_PUBLIC_SWARM_URL`. Migration 007 extends `reasoning_edges` constraint for new edge types and adds `agent_name` column to `thinking_nodes`. MUST mirror migration to `packages/db/migrations/` (run `pnpm check:migrations` to verify)."

### Agent 4: "edge-stylist" (Graph Visualization)
**Type**: `general-purpose`
**Tasks**: D4 (Edge types + colors)
**Prompt**: "You are a graph visualization specialist. Extend the existing react-flow edge type system to support swarm agent edges. Read `apps/web/src/components/graph/` for existing edge type patterns. Read `apps/web/src/lib/` for color constants. Add: `challenges` (red #ef4444, dashed line, animated pulse), `verifies` (blue #3b82f6, solid, checkmark icon), `merges` (green #22c55e, double line), `observes` (purple #a855f7, dotted). Each new edge type must integrate with the existing Legend component and graph filter system."

### Agent 5: "test-engineer" (Quality)
**Type**: `general-purpose`
**Tasks**: T1 (E2E swarm test), T2 (WebSocket test), T3 (Dashboard E2E)
**Prompt**: "You are a test automation engineer. Write comprehensive integration tests for the V2 swarm system. For Python tests: use pytest-asyncio, mock `AsyncAnthropic` with pre-recorded responses, test the full SwarmManager pipeline (query → agents → events → synthesis). For WebSocket tests: use httpx + websockets to test the FastAPI endpoint (auth, event streaming, heartbeat, idle timeout). For Dashboard E2E: use Playwright to test the swarm UI flow. Read existing tests at `agents/tests/` for patterns and `packages/core/src/*.test.ts` for Vitest patterns."

---

## Task Dependencies

```
P3 (Migration) ─────────────────────────────→ can start immediately
D4 (Edge types) ────────────────────────────→ can start immediately
F1 (Dockerfile) ────────────────────────────→ can start immediately
F4 (Env vars) ──────────────────────────────→ can start immediately

P1 (Neo4j client) ─→ P4 (Wire persistence) ─→ T1 (E2E test)
P2 (Supabase sync) ─┘

D1 (SwarmView) ──→ D5 (Wire into layout) ──→ T3 (Dashboard E2E)
D2 (AgentCard)  ──┘
D3 (SwarmTimeline)─┘

F1 (Dockerfile) ──→ F2 (Docker Compose) ──→ F3 (Fly.io)
D6 (Proxy route) ──→ F3 (Fly.io deploy)

T1 + T2 + T3 ──→ T4 (Demo scenarios — needs real Claude API)
```

## Parallel Execution Plan

**Wave 1** (start immediately, no dependencies):
- `persistence-architect`: P1 + P2
- `dashboard-builder`: D1 + D2 + D3
- `infra-deployer`: P3 + F1 + F4 + D6
- `edge-stylist`: D4

**Wave 2** (after Wave 1 delivers):
- `persistence-architect`: P4 (wire persistence into graph)
- `dashboard-builder`: D5 (wire SwarmView into layout)
- `infra-deployer`: F2 + F3
- `test-engineer`: T1 + T2

**Wave 3** (after Wave 2):
- `test-engineer`: T3 (Dashboard E2E)
- All: Bug fixes from testing

**Wave 4** (final):
- T4: Demo scenarios with real Claude API (manual with orchestrator oversight)

---

## Quality Gates (ENFORCE THESE)

### Before Every Commit
```bash
# Monorepo
pnpm test                    # 273+ core tests + migration drift
pnpm typecheck               # 0 errors across 5 packages
pnpm lint                    # 0 warnings

# Python
cd agents && uv run ruff check src/ tests/   # All checks passed
cd agents && uv run pytest tests/ -v         # 54+ tests passing

# Browser (Playwright MCP)
# Dashboard loads, no console errors, no console warnings
```

### Cross-Layer Verification
- Event schemas: Python `events/types.py` fields MUST match TypeScript `swarm-client.ts` interfaces
- Auth HMAC: Python `server.py` MUST use same pattern as TypeScript `auth.ts` and `swarm-client.ts`
- REST endpoints: Python paths MUST match TypeScript client URLs
- WebSocket path: Python `/ws/{session_id}?token=` MUST match TypeScript client
- Migration: MUST exist in BOTH `supabase/migrations/` AND `packages/db/migrations/` (identical)
- New edge types: Python `EdgeRelation` enum values MUST match dashboard edge type keys

### Code Standards
- Python: PEP 8, type hints everywhere, `datetime.now(timezone.utc)` (NOT deprecated `utcnow()`), pydantic models
- TypeScript: strict mode, functional components, `useCallback` for handlers, proper error boundaries
- No unused imports, no `any` types, no silent error swallowing
- Conventional commits: `feat(scope):`, `fix(scope):`, `test(scope):`

---

## Reference Files (Read These First)

| File | Why |
|------|-----|
| `OPUS_NX_V2.md` | Vision document — architecture, agent roles, demo flow |
| `OPUS_NX_V2_SPEC.md` | Implementation cookbook — every spec with code samples |
| `CLAUDE.md` | Project conventions, commands, architecture overview |
| `agents/src/graph/reasoning_graph.py` | Graph API that persistence syncs from |
| `agents/src/events/types.py` | Event schemas that dashboard consumes |
| `agents/src/server.py` | FastAPI server that proxy route forwards to |
| `apps/web/src/lib/hooks/use-swarm.ts` | React hook that dashboard components use |
| `apps/web/src/lib/swarm-client.ts` | Client that dashboard adapter uses |
| `apps/web/src/components/insights/InsightsPanel.tsx` | Pattern for right-sidebar tabs |
| `apps/web/src/components/fork/ForkPanel.tsx` | Pattern for right-sidebar tabs |
| `apps/web/src/components/graph/` | Existing graph/edge components |
| `packages/db/src/thinking-nodes.ts` | Supabase schema for persistence sync |
| `supabase/migrations/` | Existing migrations (001-006) for naming pattern |

---

## Existing Swarm Hook API (for dashboard components)

```typescript
// From use-swarm.ts
const { state, start, stop } = useSwarm(authSecret);

// state: SwarmState
interface SwarmState {
  phase: "idle" | "running" | "synthesis" | "complete" | "error";
  agents: Record<string, AgentStatus>;
  events: SwarmEventUnion[];
  synthesis: string | null;
  synthesisConfidence: number | null;
  insights: Array<{ type: string; description: string; agents: string[] }>;
  error: string | null;
}

interface AgentStatus {
  name: string;
  status: "pending" | "thinking" | "completed" | "error";
  effort: string;
  thinkingPreview: string;
  conclusion: string;
  confidence: number;
  tokensUsed: number;
}

// Start a swarm
await start(query, sessionId);

// Stop/cleanup
stop();
```

---

## Git Workflow

- Branch: `develop` (already pushed to remote)
- Feature branches off develop: `feature/v2-persistence`, `feature/v2-dashboard-swarm`, `feature/v2-deployment`
- Conventional commits: `feat(persistence):`, `feat(swarm-ui):`, `feat(deploy):`
- Merge feature branches back to `develop` when each phase completes
- `develop` → `main` only when V2 is fully demo-ready

---

## What Winning Looks Like

After this session, the demo flow works:
1. User types complex question on dashboard
2. Swarm tab shows 3-6 agent cards appearing
3. Each card streams live thinking from its agent
4. Graph grows in real-time with CHALLENGES (red) and VERIFIES (blue) edges
5. Metacognition insight cards appear
6. Synthesis merges everything into a final answer
7. All persisted to Neo4j + Supabase for cross-session queries
8. Deployed: Python on Fly.io, Next.js on Vercel

**Start by reading `OPUS_NX_V2.md` and `OPUS_NX_V2_SPEC.md`, then organize the agent team and begin Wave 1.**
