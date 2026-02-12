# Opus NX V2 — Session 3: Production Hardening, Polish, and Demo Readiness

> **Copy-paste this entire prompt into your next Claude Code session.**
> **Branch**: `develop` | **Model**: Opus 4.6

---

## Your Role

You are the **Principal Architect and Team Lead** for Opus NX V2. Session 3 focuses on production hardening — turning a working demo into a reliable, polished product. You will identify fragile code paths, harden error handling, polish the UI, add missing test coverage, and prepare for live demo execution.

**Rules:**

1. **Session 2 lesson learned: Passing tests ≠ working software.** You MUST do end-to-end functional verification before every commit. Start the Python backend + Next.js dev server, execute the swarm through the real UI, and verify events stream correctly. Mocked tests alone are not sufficient.
2. **Be skeptical about edge cases.** Session 2 exposed 3 hidden bugs (browser crypto import, pydantic-settings env propagation, datetime JSON serialization) that only surfaced during real execution. Assume there are more.
3. **Organize specialized agents** with clear prompts, task assignments, and quality gates.
4. **Run ALL quality gates before committing** (see Quality Gates section).
5. **Browser validation with Playwright MCP** — verify the dashboard loads, swarm executes end-to-end, no console errors.

---

## What's Already Done (Sessions 1 + 2)

### Session 1: Python Agent Backend + Dashboard Adapter

| Layer             | Files                                                                | Status |
| ----------------- | -------------------------------------------------------------------- | ------ |
| **Foundation**    | `config.py`, `graph/models.py`, `reasoning_graph.py`, `bus.py`, `events/types.py` | DONE |
| **5 Agents**      | `base.py`, `deep_thinker.py`, `contrarian.py`, `verifier.py`, `synthesizer.py`, `metacognition.py` | DONE |
| **Orchestration** | `swarm.py` (SwarmManager), `server.py` (FastAPI+WS), `main.py`      | DONE |
| **PRM Tools**     | `tools/verification.py` (geometric mean scoring, pattern detection)  | DONE |
| **Adapter**       | `swarm-client.ts`, `use-swarm.ts`, `hooks/index.ts`                 | DONE |

### Session 2: Persistence, Dashboard UI, Deployment, Bug Fixes

| Layer              | Files                                                                               | Status |
| ------------------ | ----------------------------------------------------------------------------------- | ------ |
| **Persistence**    | `neo4j_client.py`, `supabase_sync.py`, migration 007 (x2), server.py wiring        | DONE |
| **Dashboard UI**   | `SwarmView.tsx`, `AgentCard.tsx`, `SwarmTimeline.tsx`, `index.ts`, `RightPanel.tsx`  | DONE |
| **Edge Types**     | `EdgeTypes.tsx`, `GraphLegend.tsx`, `colors.ts`, `thinking-nodes.ts`                | DONE |
| **Deployment**     | `Dockerfile`, `docker-compose.yml`, `fly.toml`, `.env.example`                     | DONE |
| **Auth Fix**       | `/api/swarm/route.ts` (proxy), `/api/swarm/token/route.ts` (server-side HMAC)      | DONE |
| **Tests**          | `test_swarm_e2e.py`, `test_websocket.py`, `swarm.spec.ts`, `conftest.py`           | DONE |

### Current Stats

- **Python backend**: 23 files, ~4,500 lines, 72 tests passing
- **Dashboard**: SwarmView + AgentCard + SwarmTimeline working end-to-end
- **Events**: 9 event types matched Python ↔ TypeScript
- **Auth**: HMAC token generated server-side, never exposed to client

### Session 2 Bug Fixes (already committed)

These were invisible to mocked tests — only discovered during functional verification:

1. **Browser crypto import**: `swarm-client.ts` imported Node.js `createHmac` — doesn't work in browser. Fixed by creating `/api/swarm/token` server-side endpoint.
2. **API key propagation**: `pydantic-settings` loads `.env` into `Settings` model, NOT `os.environ`. Anthropic SDK couldn't auto-detect keys. Fixed by passing `api_key` explicitly through all agent constructors.
3. **Datetime serialization**: `EventBus.publish()` used `model_dump()` which keeps Python `datetime` objects. `websocket.send_json()` can't serialize them. Fixed with `model_dump(mode="json")`.

### Key Technical Decisions (DO NOT CHANGE)

- **API pattern**: `thinking: {"type": "adaptive"}` + `output_config: {"effort": self.effort}`
- **Thinking signatures**: Preserved from `block.signature`, never fabricated
- **Concurrency**: `asyncio.gather(return_exceptions=True)` for partial results (NOT `TaskGroup`)
- **Rate limiting**: 2.5s staggered launches for Tier 2
- **Auth**: HMAC-SHA256 via server-side `/api/swarm/token` endpoint — never in browser
- **EventBus**: `asyncio.Queue(maxsize=500)` per session, `model_dump(mode="json")`, drop on slow subscribers
- **Graph**: NetworkX with `asyncio.Lock` for coroutine safety
- **9 event types**: Matched exactly between Python `events/types.py` and TypeScript `swarm-client.ts`

---

## What Remains (Session 3) — 5 Focus Areas

### FOCUS 1: Backend Hardening (~300 lines Python)

| Task | File(s) | Description |
|------|---------|-------------|
| **H1: Rate limit retry** | `agents/src/agents/base.py` | Catch `anthropic.RateLimitError` separately from generic exceptions in the API call. Implement exponential backoff with 3 retries (1s, 2s, 4s). Currently all exceptions are caught generically in `_run_with_timeout()`. |
| **H2: Session cleanup** | `agents/src/server.py`, `agents/src/events/bus.py` | Add session TTL. Currently `EventBus._subscribers` and graph nodes accumulate forever. Add `cleanup_session(session_id)` to EventBus and graph. Add a background task in server lifespan that prunes sessions older than 30 min. |
| **H3: Input validation** | `agents/src/server.py` | Add query length validation (max 2000 chars) and session_id format validation (UUID pattern) to the `SwarmRequest` model. Currently accepts any string. |
| **H4: Structured logging** | `agents/src/swarm.py`, `agents/src/agents/base.py` | Add trace IDs to all log calls. Generate a `trace_id` (UUID) per swarm run and bind it with `structlog.contextvars.bind_contextvars()`. All agent logs should include the trace_id for debugging. |
| **H5: Persistence retry** | `agents/src/persistence/neo4j_client.py`, `agents/src/persistence/supabase_sync.py` | Add retry decorator (3 attempts, exponential backoff) for transient errors. Currently both catch-and-warn on every error. Distinguish between transient (connection timeout, rate limit) and permanent (auth failure, constraint violation) errors. |

**Reference files**: Read `agents/src/agents/base.py:run_tool_loop()` for the API call pattern, `agents/src/server.py:lifespan()` for the startup context, `agents/src/events/bus.py` for the subscriber dict structure.

### FOCUS 2: WebSocket Resilience (~150 lines TypeScript)

| Task | File(s) | Description |
|------|---------|-------------|
| **W1: Auto-reconnect** | `apps/web/src/lib/swarm-client.ts` | Add exponential backoff reconnection (max 3 attempts: 1s, 2s, 4s) on WebSocket close/error. Currently, if the WebSocket drops mid-swarm, all updates are lost with no recovery. The `ws.onclose` handler at line 249 has a `// could implement reconnection here` comment. |
| **W2: Token expiration** | `apps/web/src/lib/swarm-client.ts`, `apps/web/src/app/api/swarm/token/route.ts` | Add 1-hour TTL to cached token. Currently `cachedToken` is cached forever — a long-lived page tab will use a stale token. Add timestamp check in `getSwarmToken()` and invalidate cache after 60 min. |
| **W3: Runtime event validation** | `apps/web/src/lib/swarm-client.ts` | Add minimal runtime validation of WebSocket messages before casting to `SwarmEventUnion`. Currently uses `as unknown as SwarmEventUnion` at line 232 which provides zero safety. Check that `event` field exists and is a known event type before dispatching. |
| **W4: Connection status indicator** | `apps/web/src/components/swarm/SwarmView.tsx` | Show WebSocket connection state in the SwarmView header. Add a small dot indicator: green = connected, yellow = reconnecting, red = disconnected. Use `subscription.readyState()` from the hook. |

**Reference files**: Read `apps/web/src/lib/swarm-client.ts` (full file — current WebSocket implementation), `apps/web/src/lib/hooks/use-swarm.ts` (the React hook that wraps the client).

### FOCUS 3: Dashboard UI Polish (~400 lines TSX)

| Task | File(s) | Description |
|------|---------|-------------|
| **U1: Accumulated thinking** | `apps/web/src/lib/hooks/use-swarm.ts`, `apps/web/src/components/swarm/AgentCard.tsx` | The `agent_thinking` event handler already accumulates text (line 125), but `AgentCard` truncates at 100 chars. Allow scrollable thinking preview with a max-height container. Show a "Show more" toggle for long thinking text. |
| **U2: Error state granularity** | `apps/web/src/components/swarm/SwarmView.tsx` | When one agent fails but others succeed, show partial results with the failed agent highlighted in red. Currently the error state is global — either everything shows or the error banner shows. Add per-agent error display. |
| **U3: Responsive agent grid** | `apps/web/src/components/swarm/SwarmView.tsx`, `AgentCard.tsx` | The agent grid uses `grid-cols-2` which may break on mobile. Add responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Collapse thinking preview on mobile (show only status + name). |
| **U4: Accessibility** | All swarm components | Add `aria-label` to agent cards, timeline events, and status indicators. Add `role="status"` to the phase indicator. Ensure all interactive elements are keyboard navigable. Add `aria-live="polite"` to the agent grid for screen reader updates. |
| **U5: Copy synthesis** | `apps/web/src/components/swarm/SwarmView.tsx` | Add a "Copy to clipboard" button next to the synthesis card. Use `navigator.clipboard.writeText()`. Show a brief "Copied!" toast/feedback. |
| **U6: Swarm duration + token totals** | `apps/web/src/components/swarm/SwarmView.tsx` | Show total duration and total tokens in the completion state. Calculate from `agent_completed` events (sum tokensUsed, track first/last timestamps). Display as "42s · 5,231 tokens" in the completion header. |

**Pattern reference**: Follow existing components in `apps/web/src/components/`. Use shadcn/ui, Tailwind CSS 4, Radix UI. Check `InsightsPanel.tsx` and `ForkPanel.tsx` for existing patterns.

### FOCUS 4: Test Coverage Expansion (~500 lines)

| Task | File(s) | Description |
|------|---------|-------------|
| **T1: Persistence tests** | `agents/tests/test_persistence.py` (NEW) | Test `Neo4jPersistence.save_node()`, `save_edge()`, `save()` with mocked Neo4j driver. Test `SupabasePersistence.sync_node()`, `sync_edge()`, `sync()` with mocked Supabase client. Test graceful degradation (connection error → warning logged, no crash). Test the `on_graph_change` callback wiring from `server.py`. |
| **T2: Concurrent session test** | `agents/tests/test_concurrent.py` (NEW) | Run 2 swarm sessions simultaneously on the same graph + bus. Verify: (1) sessions don't cross-pollinate events, (2) graph nodes have correct session_id, (3) EventBus subscribers only receive their session's events. Use `asyncio.gather()` to run both. |
| **T3: Rate limit retry test** | `agents/tests/test_retry.py` (NEW) | Mock `anthropic.AsyncAnthropic.messages.create()` to raise `RateLimitError` on first 2 calls, succeed on 3rd. Verify: (1) retries happen with correct delays, (2) final result is successful, (3) total retries logged with trace_id. |
| **T4: Component tests** | `apps/web/src/components/swarm/__tests__/` (NEW) | Vitest + React Testing Library for: (1) AgentCard renders all states (pending, thinking, completed, error), (2) SwarmView handles empty/loading/error states, (3) SwarmTimeline renders events correctly. |
| **T5: Real Claude API smoke test** | `agents/tests/test_smoke_real.py` (NEW) | Marked with `@pytest.mark.skipif(not os.environ.get("ANTHROPIC_API_KEY"))`. Run a minimal swarm with a simple query ("What is 2+2?"). Verify: (1) all agents return results, (2) graph has nodes, (3) synthesis is non-empty. Use low effort to minimize tokens. This test catches API contract changes. |

**Reference files**: Read `agents/tests/conftest.py` for existing fixtures (`SmartMockAsyncAnthropic`, `test_graph`, `test_bus`). Read `agents/tests/test_swarm_e2e.py` for the E2E test pattern.

### FOCUS 5: Demo Preparation (~100 lines + manual testing)

| Task | Description |
|------|-------------|
| **D1: Demo questions** | Pre-test 3 demo questions with real Claude API: (1) "Should we migrate our monolith to microservices?" (2) "What's the optimal strategy for entering the AI market in 2026?" (3) "Is blockchain overhyped or genuinely transformative?" Record: total duration, token usage, agent behavior, any errors. |
| **D2: Error recovery demo** | Verify the dashboard handles partial agent failure gracefully. Temporarily break one agent (e.g., give Verifier an invalid tool) and confirm: other agents still complete, partial synthesis shows, error highlighted. |
| **D3: Graph visualization** | After a swarm run, verify the reasoning graph shows V2 edges: CHALLENGES (amber), VERIFIES (cyan), MERGES (pink), OBSERVES (indigo). Verify the graph legend is correct. Verify clicking a node shows its content. |
| **D4: Production env check** | Verify `docker-compose up` starts both services and they communicate. Test the `/api/health` endpoint. Verify environment variables documented in `.env.example` are complete. |

---

## Architecture & File Map (for reference)

### Python Backend (`agents/src/`) — 23 files

```
agents/src/
├── __init__.py
├── config.py              # Pydantic Settings (env vars)
├── main.py                # uvicorn entrypoint
├── server.py              # FastAPI + WebSocket + lifespan
├── swarm.py               # SwarmManager (agent orchestration)
├── agents/
│   ├── __init__.py
│   ├── base.py            # BaseOpusAgent (tool loop, API calls)
│   ├── deep_thinker.py    # Primary reasoning agent
│   ├── contrarian.py      # Adversarial challenger
│   ├── verifier.py        # PRM step-by-step verification
│   ├── synthesizer.py     # Merges all conclusions
│   └── metacognition.py   # Swarm psychologist
├── events/
│   ├── __init__.py
│   ├── bus.py             # Per-session asyncio.Queue pub/sub
│   └── types.py           # 9 Pydantic event models
├── graph/
│   ├── __init__.py
│   ├── models.py          # ReasoningNode, ReasoningEdge, AgentResult
│   └── reasoning_graph.py # NetworkX graph with asyncio.Lock
├── persistence/
│   ├── __init__.py
│   ├── neo4j_client.py    # Fire-and-forget Neo4j sync
│   └── supabase_sync.py   # Fire-and-forget Supabase sync
└── tools/
    ├── __init__.py
    └── verification.py    # PRM scoring (geometric mean, pattern detect)
```

### Dashboard Swarm UI (`apps/web/src/`)

```
apps/web/src/
├── app/api/swarm/
│   ├── route.ts           # POST proxy → Python backend
│   └── token/route.ts     # GET server-side HMAC token
├── components/swarm/
│   ├── SwarmView.tsx       # Main swarm panel (right sidebar)
│   ├── AgentCard.tsx       # Per-agent status card
│   ├── SwarmTimeline.tsx   # Event timeline
│   └── index.ts            # Barrel exports
├── lib/
│   ├── swarm-client.ts    # REST + WebSocket client
│   └── hooks/use-swarm.ts # React hook with state machine
└── e2e/
    └── swarm.spec.ts       # Playwright E2E spec
```

### Tests (`agents/tests/`) — 72 tests

```
agents/tests/
├── conftest.py             # Shared fixtures, SmartMockAsyncAnthropic
├── test_bus.py             # EventBus pub/sub tests
├── test_graph.py           # SharedReasoningGraph tests
├── test_deep_thinker.py    # DeepThinker agent tests
├── test_swarm.py           # SwarmManager unit tests
├── test_swarm_e2e.py       # Full pipeline E2E (5 scenarios)
├── test_verification.py    # PRM scoring tests
└── test_websocket.py       # WebSocket auth + event delivery
```

---

## Existing APIs & Interfaces (for reference)

### SwarmManager Pipeline

```python
# agents/src/swarm.py
class SwarmManager:
    async def run(self, query: str, session_id: str) -> dict:
        # Phase 1: Primary agents (parallel, staggered 2.5s)
        #   DeepThinkerAgent (effort=max)
        #   ContrarianAgent (effort=classified)
        #   VerifierAgent (effort=classified)
        # Phase 2: SynthesizerAgent (sequential)
        # Phase 3: MetacognitionAgent (effort=max, sequential)
```

### EventBus

```python
# agents/src/events/bus.py
class EventBus:
    async def publish(session_id, event: SwarmEvent)  # model_dump(mode="json")
    def subscribe(session_id) -> asyncio.Queue
    def unsubscribe(session_id, queue)
    # MISSING: cleanup_session(session_id) — needs to be added (H2)
```

### 9 Event Types (Python ↔ TypeScript matched)

| Python Event | TypeScript Event | Trigger |
|-------------|------------------|---------|
| `SwarmStarted` | `swarm_started` | SwarmManager.run() begins |
| `AgentStarted` | `agent_started` | Each agent's run() begins |
| `AgentThinking` | `agent_thinking` | Thinking block deltas |
| `GraphNodeCreated` | `graph_node_created` | Node added to graph |
| `AgentChallenges` | `agent_challenges` | Contrarian challenges a node |
| `VerificationScore` | `verification_score` | Verifier scores a step |
| `AgentCompleted` | `agent_completed` | Agent finishes |
| `SynthesisReady` | `synthesis_ready` | Synthesis written to graph |
| `MetacognitionInsight` | `metacognition_insight` | Metacog writes insight |

### React Hook API

```typescript
// apps/web/src/lib/hooks/use-swarm.ts
const { state, start, stop } = useSwarm(authSecret);

interface SwarmState {
  phase: "idle" | "running" | "synthesis" | "complete" | "error";
  agents: Record<string, AgentStatus>;
  events: SwarmEventUnion[];
  synthesis: string | null;
  synthesisConfidence: number | null;
  insights: Array<{ type: string; description: string; agents: string[] }>;
  error: string | null;
}
```

### Auth Flow

```
Browser → GET /api/swarm/token → Next.js generates HMAC server-side → returns { token, wsUrl }
Browser → WebSocket wsUrl/ws/{sessionId}?token={token} → Python validates HMAC
Browser → POST /api/swarm → Next.js proxy → Python /api/swarm (token attached server-side)
```

---

## Agent Team Organization

### Agent 1: "backend-hardener" (Python)

**Type**: `general-purpose`
**Tasks**: H1 (Rate limit retry), H2 (Session cleanup), H3 (Input validation), H4 (Structured logging), H5 (Persistence retry)
**Prompt**: "You are a Python backend reliability specialist. Harden the Opus NX V2 agent swarm for production. Read `agents/src/agents/base.py` for the API call pattern — add retry logic for `anthropic.RateLimitError` with exponential backoff (3 retries). Read `agents/src/events/bus.py` and `agents/src/server.py` — add session cleanup (TTL-based pruning of stale subscribers/graph nodes). Add input validation to `SwarmRequest` (max 2000 char query, UUID session_id). Add trace_id (UUID) to all log calls via `structlog.contextvars`. Add retry decorators to both `neo4j_client.py` and `supabase_sync.py` for transient errors. Never break the existing API contract — all changes must be backward compatible."

### Agent 2: "websocket-engineer" (TypeScript)

**Type**: `general-purpose`
**Tasks**: W1 (Auto-reconnect), W2 (Token expiration), W3 (Event validation), W4 (Connection indicator)
**Prompt**: "You are a WebSocket reliability specialist. Harden the swarm WebSocket client in `apps/web/src/lib/swarm-client.ts`. Add auto-reconnect with exponential backoff (3 attempts: 1s, 2s, 4s) on `ws.onclose` — currently at line 249 with a placeholder comment. Add token TTL (1 hour) to the cached token in `getSwarmToken()`. Add runtime validation of WebSocket messages before casting to `SwarmEventUnion` — check that `event` field exists and is a known type. Update `SwarmView.tsx` to show a connection status dot (green/yellow/red). Read `apps/web/src/lib/hooks/use-swarm.ts` for the hook API that wraps your client."

### Agent 3: "ui-polisher" (Frontend)

**Type**: `general-purpose`
**Tasks**: U1-U6 (All UI polish tasks)
**Prompt**: "You are a React 19 + Next.js 16 frontend polish specialist. Improve the Opus NX swarm dashboard UI. Read `apps/web/src/components/swarm/SwarmView.tsx`, `AgentCard.tsx`, and `SwarmTimeline.tsx` for the existing implementation. Tasks: (1) Make thinking preview scrollable with max-height + 'Show more' toggle in AgentCard. (2) Show partial results when some agents fail — don't use a global error banner when individual agents error. (3) Add responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. (4) Add ARIA labels, keyboard navigation, `aria-live='polite'`. (5) Add copy-to-clipboard for synthesis card. (6) Show total duration + tokens in completion state. Use shadcn/ui, Tailwind CSS 4, follow existing patterns."

### Agent 4: "test-engineer" (Quality)

**Type**: `general-purpose`
**Tasks**: T1-T5 (All test tasks)
**Prompt**: "You are a test automation engineer. Expand test coverage for the Opus NX V2 swarm. Read `agents/tests/conftest.py` for existing fixtures (`SmartMockAsyncAnthropic`, `mock_settings`, `test_graph`, `test_bus`). Read `agents/tests/test_swarm_e2e.py` for the E2E test pattern. Write new tests: (1) Persistence tests — mock Neo4j driver and Supabase client, test save/sync/error handling. (2) Concurrent session tests — 2 swarms on same graph, verify session isolation. (3) Rate limit retry tests — mock API to raise RateLimitError, verify backoff. (4) Vitest component tests for AgentCard/SwarmView/SwarmTimeline (React Testing Library). (5) Real Claude API smoke test (skipif no API key). Use pytest-asyncio for async tests. All new tests must pass."

### Agent 5: "demo-tester" (Functional Verification)

**Type**: `general-purpose`
**Tasks**: D1-D4 (Demo preparation)
**Prompt**: "You are a QA engineer responsible for demo readiness. Your job is end-to-end functional verification — NOT mocked tests. Start the Python backend (`cd agents && uv run python -m src.main`), start the Next.js dev server (`pnpm --filter @opus-nx/web dev`), and use Playwright MCP to verify the swarm works end-to-end. Test 3 demo queries through the real UI. Verify: agent cards appear, thinking streams, events arrive in timeline, synthesis displays, graph shows V2 edges, no console errors. Also test error recovery (what happens when one agent fails?). Also test `docker-compose up` starts both services. Report all findings."

---

## Task Dependencies

```
H1 (Rate limit retry)  ─→ T3 (Retry tests)
H2 (Session cleanup)   ─→ T2 (Concurrent test)
H3 (Input validation)  ─→ can start immediately
H4 (Structured logging) ─→ can start immediately
H5 (Persistence retry) ─→ T1 (Persistence tests)

W1 (Auto-reconnect)   ─→ can start immediately
W2 (Token expiration)  ─→ can start immediately
W3 (Event validation)  ─→ can start immediately
W4 (Connection indicator) ─→ depends on W1

U1-U6 (UI polish)     ─→ can start immediately (parallel)

T1-T5 (Tests)         ─→ depend on their corresponding H/W tasks
D1-D4 (Demo)          ─→ ALL hardening + polish must be done first
```

## Parallel Execution Plan

**Wave 1** (start immediately, no dependencies):

- `backend-hardener`: H1 + H2 + H3 + H4 + H5
- `websocket-engineer`: W1 + W2 + W3 + W4
- `ui-polisher`: U1 + U2 + U3 + U4 + U5 + U6

**Wave 2** (after Wave 1 delivers):

- `test-engineer`: T1 + T2 + T3 + T4 + T5
- All: Bug fixes from Wave 1

**Wave 3** (after Wave 2):

- `demo-tester`: D1 + D2 + D3 + D4
- All: Final bug fixes

---

## Quality Gates (ENFORCE THESE)

### Before Every Commit

```bash
# Monorepo
pnpm test                    # 273+ core tests + migration drift
pnpm typecheck               # 0 errors across all packages
pnpm lint                    # 0 warnings

# Python
cd agents && uv run ruff check src/ tests/   # All checks passed
cd agents && uv run pytest tests/ -v         # 72+ tests passing (should grow to 90+)

# Functional verification (MANDATORY — Session 2 lesson learned)
# 1. Start Python backend: cd agents && uv run python -m src.main
# 2. Start Next.js: pnpm --filter @opus-nx/web dev
# 3. Open browser → Swarm tab → submit query → verify full pipeline
# 4. Check Python backend logs for errors
# 5. Check browser console for errors
```

### Cross-Layer Verification

- Event schemas: Python `events/types.py` fields MUST match TypeScript `swarm-client.ts` interfaces
- Auth HMAC: Server-side token generation only — never in browser code
- WebSocket path: Python `/ws/{session_id}?token=` MUST match TypeScript client
- Migration: MUST exist in BOTH `supabase/migrations/` AND `packages/db/migrations/` (identical)
- Edge types: Python `EdgeRelation` enum values MUST match dashboard edge type keys

### Code Standards

- Python: PEP 8, type hints everywhere, `datetime.now(timezone.utc)` (NOT deprecated `utcnow()`), pydantic models
- TypeScript: strict mode, functional components, `useCallback` for handlers
- No unused imports, no `any` types, no silent error swallowing
- Conventional commits: `feat(scope):`, `fix(scope):`, `test(scope):`

---

## Known Issues to Watch For

These are patterns from Session 2 that could cause similar bugs:

1. **pydantic-settings vs os.environ**: Remember that `Settings()` loads `.env` into Python object attributes, NOT into `os.environ`. Any library that reads env vars directly (like `anthropic`, `neo4j`, `supabase`) needs explicit parameter passing.

2. **model_dump() vs model_dump(mode="json")**: Any Pydantic model going to JSON (WebSocket, REST response, logs) MUST use `mode="json"` to convert datetime, UUID, Enum etc.

3. **Node.js crypto in browser**: Never import from `"crypto"` in client-side TypeScript. Use Web Crypto API or server-side endpoints.

4. **asyncio.create_task fire-and-forget**: Tasks created this way can silently fail. The persistence wiring uses this pattern. Ensure all fire-and-forget tasks have proper exception handlers.

5. **WebSocket lifecycle**: The WebSocket connection is async — `getSwarmToken()` returns a Promise. The subscription object must handle the case where `close()` is called before the WebSocket actually opens (the `closed` flag pattern).

---

## Reference Files (Read These First)

| File | Why |
|------|-----|
| `CLAUDE.md` | Project conventions, pre-commit functional verification requirement |
| `agents/src/agents/base.py` | Agent tool loop — where retry logic goes |
| `agents/src/server.py` | FastAPI lifespan, WebSocket handler, auth |
| `agents/src/swarm.py` | SwarmManager — orchestration pipeline |
| `agents/src/events/bus.py` | EventBus — where session cleanup goes |
| `agents/src/persistence/neo4j_client.py` | Neo4j sync — where retry goes |
| `agents/src/persistence/supabase_sync.py` | Supabase sync — where retry goes |
| `apps/web/src/lib/swarm-client.ts` | WebSocket client — reconnect + validation |
| `apps/web/src/lib/hooks/use-swarm.ts` | React hook — state machine |
| `apps/web/src/components/swarm/SwarmView.tsx` | Main UI — all polish tasks |
| `apps/web/src/components/swarm/AgentCard.tsx` | Per-agent card — thinking preview |
| `agents/tests/conftest.py` | Test fixtures — extend for new tests |

---

## Git Workflow

- Branch: `develop`
- Conventional commits: `fix(swarm):`, `feat(swarm-ui):`, `test(swarm):`
- `develop` → `main` only when V2 is fully demo-ready
- After this session, if all quality gates pass + demo runs clean → merge to `main`

---

## What Winning Looks Like

After this session:

1. **Swarm survives transient failures**: Rate limit errors retry automatically, WebSocket reconnects on drop, one agent failing doesn't crash the swarm
2. **Dashboard is polished**: Responsive layout, accessible, copy synthesis, show totals, per-agent error display
3. **Test coverage is comprehensive**: Persistence, concurrency, retry logic, component rendering all tested
4. **Demo runs flawlessly**: 3 pre-tested questions work end-to-end, graph shows V2 edges, no console errors
5. **Production ready**: `docker-compose up` works, logging has trace IDs, sessions clean up, inputs validated

**Start by reading the reference files, then organize the agent team and begin Wave 1.**
