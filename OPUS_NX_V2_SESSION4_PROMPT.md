# Opus NX V2 — Session 4: Maestro Agent, Live Graph, Human-in-the-Loop, and Demo Readiness

> **Copy-paste this entire prompt into your next Claude Code session.**
> **Branch**: `develop` | **Model**: Opus 4.6

---

## Your Role

You are the **Principal Architect and Team Lead** for Opus NX V2. Session 4 is the **final push** — turning a working swarm into the hackathon demo that wins. You will implement the Maestro orchestrator agent, wire live graph visualization into the dashboard, add human-in-the-loop steering for the swarm, deploy to production, and pre-test the 3 demo scenarios with real Claude API calls.

**Rules:**

1. **Session 2+3 lessons learned: Passing tests ≠ working software.** You MUST do end-to-end functional verification before every commit. Start the Python backend + Next.js dev server, execute the swarm through the real UI, and verify events stream correctly.
2. **Demo-first mindset.** Every decision should optimize for the 5-minute demo. If something looks impressive but takes 3 hours vs something functional in 30 minutes, choose the 30-minute option.
3. **The "money shot" is the live graph.** Judges need to SEE agents thinking simultaneously, the graph growing in real-time, CHALLENGES edges appearing in red, VERIFIES edges in cyan. This is what differentiates us.
4. **Organize specialized agents** with clear prompts, task assignments, and quality gates.
5. **Run ALL quality gates before committing** (see Quality Gates section).
6. **Browser validation with Playwright MCP** — verify the dashboard loads, swarm executes end-to-end, graph renders correctly.

---

## What's Already Done (Sessions 1 + 2 + 3)

### Session 1: Python Agent Backend + Dashboard Adapter

| Layer             | Files                                                                                              | Status |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------ |
| **Foundation**    | `config.py`, `graph/models.py`, `reasoning_graph.py`, `bus.py`, `events/types.py`                  | DONE   |
| **5 Agents**      | `base.py`, `deep_thinker.py`, `contrarian.py`, `verifier.py`, `synthesizer.py`, `metacognition.py` | DONE   |
| **Orchestration** | `swarm.py` (SwarmManager with Maestro-like effort routing), `server.py` (FastAPI+WS), `main.py`    | DONE   |
| **PRM Tools**     | `tools/verification.py` (geometric mean scoring, pattern detection)                                | DONE   |
| **Adapter**       | `swarm-client.ts`, `use-swarm.ts`, `hooks/index.ts`                                                | DONE   |

### Session 2: Persistence, Dashboard UI, Deployment, Bug Fixes

| Layer            | Files                                                                               | Status |
| ---------------- | ----------------------------------------------------------------------------------- | ------ |
| **Persistence**  | `neo4j_client.py`, `supabase_sync.py`, migration 007 (x2), server.py wiring         | DONE   |
| **Dashboard UI** | `SwarmView.tsx`, `AgentCard.tsx`, `SwarmTimeline.tsx`, `index.ts`, `RightPanel.tsx` | DONE   |
| **Edge Types**   | `EdgeTypes.tsx` (9 edge components), `GraphLegend.tsx`, `colors.ts`                 | DONE   |
| **Deployment**   | `Dockerfile`, `docker-compose.yml`, `fly.toml`, `.env.example`                      | DONE   |
| **Auth Fix**     | `/api/swarm/route.ts` (proxy), `/api/swarm/token/route.ts` (server-side HMAC)       | DONE   |
| **Tests**        | `test_swarm_e2e.py`, `test_websocket.py`, `swarm.spec.ts`, `conftest.py`            | DONE   |

### Session 3: Production Hardening, UI Polish, Test Expansion

| Layer                    | Files / Changes                                                                              | Status |
| ------------------------ | -------------------------------------------------------------------------------------------- | ------ |
| **Rate Limit Retry**     | `base.py` — exponential backoff (3 retries: 1s, 2s, 4s) on `RateLimitError`                  | DONE   |
| **Session Cleanup**      | `server.py` lifespan + `bus.py` stale detection (5min check, 30min max age)                  | DONE   |
| **Input Validation**     | `server.py` SwarmRequest (max 2000 chars, UUID session_id)                                   | DONE   |
| **Structured Logging**   | `swarm.py` trace_id via `structlog.contextvars`                                              | DONE   |
| **WebSocket Resilience** | `swarm-client.ts` auto-reconnect (3 attempts), token TTL (60min), event validation           | DONE   |
| **UI Polish**            | Responsive grid, accessibility (ARIA), copy synthesis, connection indicator, duration/tokens | DONE   |
| **Tests**                | `test_persistence.py`, `test_concurrent.py`, `test_retry.py`, `test_smoke_real.py`           | DONE   |

### Current Stats

- **Python backend**: 23 files, ~4,500 lines, 72+ tests
- **Dashboard**: SwarmView + AgentCard + SwarmTimeline working end-to-end
- **Events**: 9 event types matched Python ↔ TypeScript
- **Auth**: HMAC token generated server-side, never exposed to client
- **Infrastructure**: Dockerfile, docker-compose.yml, fly.toml ready

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

## What Remains (Session 4) — 6 Focus Areas

### FOCUS 1: Maestro Agent (~350 lines Python)

**WHY**: The V2 spec defines Maestro as the conductor — an actual Opus 4.6 agent that decomposes queries, selects which agents to deploy, and monitors the swarm. Currently, the SwarmManager has Maestro-like behavior (complexity classification, effort routing) but it's just regex + if-statements. Making Maestro a real Opus agent is far more impressive for the demo: "The swarm begins with Maestro analyzing your question and deciding which agents to deploy."

| Task                                   | File(s)                                                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1: MaestroAgent class**             | `agents/src/agents/maestro.py` (NEW)                             | Create a new agent class extending `BaseOpusAgent`. System prompt: "You are Maestro, the swarm conductor. Analyze the query, decompose it into sub-tasks, and decide which agents to deploy." Tools: `decompose_query` (break query into aspects), `select_agents` (choose which of Deep Thinker, Contrarian, Verifier to deploy based on query needs), `set_agent_effort` (assign effort levels per agent). Effort: `high`. |
| **M2: Wire Maestro into SwarmManager** | `agents/src/swarm.py`                                            | Add Phase 0 before the current Phase 1. Maestro runs first (~5-10s), returns a deployment plan (which agents, what effort each). SwarmManager then uses the plan instead of hard-coding all 3 primaries. Keep the existing regex classification as a fast fallback if Maestro times out or errors.                                                                                                                           |
| **M3: Maestro events**                 | `agents/src/events/types.py`, `apps/web/src/lib/swarm-client.ts` | Add `MaestroDecomposition` event: `{event: "maestro_decomposition", session_id, subtasks: string[], selected_agents: string[], reasoning_preview: string}`. Match in both Python and TypeScript.                                                                                                                                                                                                                             |
| **M4: Dashboard Maestro card**         | `apps/web/src/components/swarm/SwarmView.tsx`, `AgentCard.tsx`   | Show Maestro as the first agent card during Phase 0. Its thinking stream shows the decomposition reasoning. When complete, show the selected agents and deployment plan before Phase 1 begins.                                                                                                                                                                                                                               |

**Reference spec**: OPUS_NX_V2_SPEC.md → The 6 Opus Agents → Agent 1: Maestro. OPUS_NX_V2.md → "Maestro decomposes the query. Agent cards appear on dashboard."

**Design note**: Maestro should be **lightweight**. Use `effort: "high"` (not max), `max_tokens: 4096`. Its job is fast decomposition, not deep analysis. The whole Maestro phase should complete in 5-10 seconds. If Maestro takes longer than 15s, fall back to the current regex-based classification.

### FOCUS 2: Live Swarm Graph Visualization (~400 lines TSX)

**WHY**: This is the "money shot" from the demo flow. Judges need to see the reasoning graph growing in real-time — nodes appearing as agents write them, red CHALLENGES edges when the Contrarian pushes back, cyan VERIFIES edges when the Verifier scores a step. Currently the SwarmView shows agent cards and a timeline, but the actual graph visualization is missing. The V1 `ThinkingGraph` component reads from Supabase — it doesn't show the swarm's live graph.

| Task                              | File(s)                                              | Description                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1: SwarmGraph component**      | `apps/web/src/components/swarm/SwarmGraph.tsx` (NEW) | A new component that renders the swarm's reasoning graph using `@xyflow/react` (React Flow). Uses the existing `edgeTypes` from `EdgeTypes.tsx` and `ThinkingNode` from the graph components. Receives graph data from `useSwarm` hook's event stream. Nodes are positioned with a simple top-down layout algorithm (dagre or elk-style). New nodes animate in with a fade+scale transition. |
| **G2: Graph data from events**    | `apps/web/src/lib/hooks/use-swarm.ts`                | Extend `SwarmState` with `graphNodes` and `graphEdges` arrays. Build them from events: `graph_node_created` → add node, `agent_challenges` → add CHALLENGES edge, `verification_score` → update node color based on score. Return react-flow compatible `{id, data, position}` format.                                                                                                       |
| **G3: Graph layout engine**       | `apps/web/src/lib/swarm-graph-layout.ts` (NEW)       | Simple incremental layout for the swarm graph. New nodes appear below existing nodes from the same agent (columnar layout — one column per agent). Edges connect across columns. Use a simple force-directed or layered approach. Must handle incremental additions (don't re-layout everything when a new node appears).                                                                    |
| **G4: Graph/Cards toggle**        | `apps/web/src/components/swarm/SwarmView.tsx`        | Add a toggle in the SwarmView header: "Cards" vs "Graph" view. Cards is the current AgentCard grid. Graph shows the SwarmGraph component. Both receive the same data from `useSwarm`. Default to Graph during running phase (the money shot), Cards during complete phase (to see results).                                                                                                  |
| **G5: Graph node agent coloring** | `apps/web/src/components/swarm/SwarmGraph.tsx`       | Color-code nodes by agent: Deep Thinker (blue), Contrarian (red/amber), Verifier (orange), Synthesizer (green), Metacognition (violet). Use the same colors as the AgentCard status badges.                                                                                                                                                                                                  |

**Reference files**: `apps/web/src/components/graph/ThinkingGraph.tsx` for the existing react-flow setup, `EdgeTypes.tsx` for edge components, `ThinkingNode.tsx` for node rendering. The V1 graph already supports all edge types we need — the challenge is feeding it live swarm data instead of Supabase data.

**Key constraint**: The graph must render incrementally. Agents write nodes every few seconds during a swarm run. The graph can't freeze or re-layout entirely when a new node appears. Smooth animation is critical for the demo.

### FOCUS 3: Human-in-the-Loop Swarm Steering (~300 lines Python + ~200 lines TSX)

**WHY**: The demo flow at 4:00-4:30 shows the user adding a checkpoint: "I disagree with step 3. Consider serverless." and Maestro re-deploys with the new constraint. This is the most impressive interactive feature — proving the swarm is steerable, not just fire-and-forget.

| Task                                    | File(s)                                                          | Description                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1: Swarm checkpoint endpoint**       | `agents/src/server.py`                                           | Add `POST /api/swarm/{session_id}/checkpoint` endpoint. Accepts `{node_id: str, verdict: "verified" \| "questionable" \| "disagree", correction: str \| null}`. Writes a human annotation node to the graph. If verdict is "disagree" with a correction, triggers a targeted re-run: Maestro selects which agent(s) to re-deploy with the correction as additional context. |
| **L2: Targeted re-run in SwarmManager** | `agents/src/swarm.py`                                            | Add `async def rerun_with_correction(session_id, node_id, correction)` method. This creates a new iteration: Maestro reviews the correction, selects 1-2 agents to re-run with the correction injected into their system prompts. Results are added to the existing graph (not a new graph). Emits `swarm_rerun_started` event.                                             |
| **L3: Checkpoint event types**          | `agents/src/events/types.py`, `apps/web/src/lib/swarm-client.ts` | Add events: `HumanCheckpoint` (`{event: "human_checkpoint", node_id, verdict, correction}`), `SwarmRerunStarted` (`{event: "swarm_rerun_started", agents, correction_preview}`). Match in both Python and TypeScript.                                                                                                                                                       |
| **L4: SwarmControls component**         | `apps/web/src/components/swarm/SwarmControls.tsx` (NEW)          | Appears after swarm completes. Shows each reasoning node with Verify/Question/Disagree buttons (matching V1's checkpoint UI pattern from `/api/reasoning/[id]/checkpoint`). "Disagree" opens a text field for the correction. Submitting triggers the re-run via `POST /api/swarm/{session_id}/checkpoint`.                                                                 |
| **L5: Wire into SwarmView**             | `apps/web/src/components/swarm/SwarmView.tsx`                    | After swarm completes, show SwarmControls below the synthesis card. When a re-run is triggered, transition back to "running" phase to show the additional agents thinking.                                                                                                                                                                                                  |

**Reference**: The V1 checkpoint route at `apps/web/src/app/api/reasoning/[id]/checkpoint/route.ts` already has the verdict schema and re-reasoning logic. Port the pattern but wire it into the swarm flow instead of the V1 single-agent flow.

**Demo-first simplification**: For the hackathon, the re-run can be simple — just re-run the Contrarian and Deep Thinker with the correction appended to the user query. Full Maestro-driven re-orchestration is a stretch goal.

### FOCUS 4: Production Deployment (~100 lines config + manual steps)

**WHY**: "Demo from localhost" is the fallback, but deployed = more impressive. Python on Fly.io, Next.js on Vercel, Neo4j on AuraDB free tier.

| Task                                    | File(s)                                        | Description                                                                                                                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F1: Deploy Python backend to Fly.io** | `infra/fly.toml`, `agents/Dockerfile`          | Verify Dockerfile builds correctly. Deploy with `fly deploy`. Set secrets: `ANTHROPIC_API_KEY`, `AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Verify `/api/health` returns `{"status": "ok"}`. Verify WebSocket at `wss://opus-nx-agents.fly.dev/ws/test`. |
| **F2: Set up Neo4j AuraDB**             | Manual + `.env`                                | Create Neo4j AuraDB free-tier instance (50K nodes, 175K edges). Get `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`. Add as Fly.io secrets. Verify background sync works.                                                                                                    |
| **F3: Connect Vercel to Fly.io**        | `apps/web/.env.production`                     | Set `NEXT_PUBLIC_SWARM_URL` to the Fly.io URL. Set `AUTH_SECRET` in Vercel environment. Verify the proxy route forwards correctly to the deployed backend.                                                                                                               |
| **F4: CORS configuration**              | `agents/src/config.py`, `agents/src/server.py` | Add the Vercel production URL to `cors_origins`. Verify WebSocket connections work cross-origin from the Vercel frontend to Fly.io backend.                                                                                                                              |
| **F5: Smoke test deployed stack**       | Manual                                         | Hit the deployed `/api/health`. Connect WebSocket from browser to Fly.io. Trigger a swarm run from the deployed dashboard. Verify full pipeline works end-to-end in production.                                                                                          |

**Fallback**: If Fly.io deployment fails or has WebSocket issues, demo from localhost and record the video locally. The infra configs are already correct — deployment is configuration, not code.

### FOCUS 5: Demo Pre-testing & Recording (~manual)

**WHY**: Day 7 of the timeline. This is what wins the hackathon — the actual 5-minute demo.

| Task                                 | Description                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1: Pre-test 3 demo queries**      | Run each query through the full swarm with real Claude API. Record: total duration, token usage, agent behavior, interesting moments (good challenges, insightful metacognition), any errors. The 3 queries: (1) "Should we migrate our monolith to microservices?" (2) "What's the optimal strategy for entering the AI market in 2026?" (3) "Is blockchain technology overhyped or genuinely transformative?" |
| **D2: Time the demo flow**           | Practice the 5-minute demo script from the V2 spec. Verify timing: 0:00-0:30 intro, 0:30-1:00 Maestro decomposition, 1:00-2:30 agents thinking (the money shot), 2:30-3:30 metacognition insights, 3:30-4:00 synthesis, 4:00-4:30 human-in-the-loop checkpoint, 4:30-5:00 architecture slide. Adjust if needed.                                                                                                 |
| **D3: Record demo video**            | Screen record the best demo run. Include: browser dashboard, live graph growing, agent cards streaming, CHALLENGES edges appearing, synthesis card, checkpoint interaction. Narration explaining what's happening.                                                                                                                                                                                              |
| **D4: Write submission description** | Concise description for hackathon submission. Highlight: multiple parallel Opus 4.6 agents, shared reasoning graph, real-time WebSocket streaming, human-in-the-loop steering, PRM verification. Built in 7 days with Claude Code.                                                                                                                                                                              |
| **D5: Error recovery demo**          | Verify the dashboard handles partial agent failure gracefully during the demo. If one agent times out, the others still complete and synthesis still works. This must not crash the demo.                                                                                                                                                                                                                       |

**Demo tips**:

- Pre-warm the swarm (do a test run) before recording — first run is always slowest.
- Have a backup query ready in case one fails during recording.
- The live graph is the centerpiece. Make sure it's visible and agents are color-coded clearly.
- Keep the checkpoint interaction brief — just show "disagree, suggest serverless" and the re-run starting. Don't wait for it to complete.

### FOCUS 6: Component Tests & Final Cleanup (~400 lines)

| Task                               | File(s)                                                             | Description                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1: SwarmView component tests**  | `apps/web/src/components/swarm/__tests__/SwarmView.test.tsx` (NEW)  | Vitest + React Testing Library. Test: idle state renders empty state with example queries, running state shows agent grid, complete state shows synthesis card, error state shows error message with dismiss button. |
| **T2: AgentCard component tests**  | `apps/web/src/components/swarm/__tests__/AgentCard.test.tsx` (NEW)  | Test: renders all statuses (pending, thinking, completed, error), shows thinking preview when thinking, shows conclusion when completed, confidence color mapping works.                                             |
| **T3: SwarmGraph component tests** | `apps/web/src/components/swarm/__tests__/SwarmGraph.test.tsx` (NEW) | Test: renders empty graph, adds nodes on event, adds edges on challenge/verify events, nodes color-coded by agent.                                                                                                   |
| **T4: Maestro agent tests**        | `agents/tests/test_maestro.py` (NEW)                                | Test: Maestro returns deployment plan with selected agents, decomposition events are emitted, fallback to regex classification on timeout, effort routing matches plan.                                              |
| **T5: Checkpoint tests**           | `agents/tests/test_checkpoint.py` (NEW)                             | Test: POST /api/swarm/{session_id}/checkpoint creates annotation node, disagree with correction triggers re-run, human_checkpoint event emitted, graph has annotation edges.                                         |
| **T6: Remove dead code**           | Various                                                             | Clean up any unused imports, TODO comments, placeholder code. Verify `pnpm typecheck` and `pnpm lint` both pass with 0 errors/warnings.                                                                              |

---

## Architecture & File Map (for reference)

### Python Backend (`agents/src/`) — 24 files (23 existing + 1 new)

```
agents/src/
├── __init__.py
├── config.py              # Pydantic Settings (env vars)
├── main.py                # uvicorn entrypoint
├── server.py              # FastAPI + WebSocket + lifespan + checkpoint endpoint
├── swarm.py               # SwarmManager (Phase 0 Maestro + Phase 1-3 pipeline)
├── utils.py               # Shared utilities
├── agents/
│   ├── __init__.py
│   ├── base.py            # BaseOpusAgent (tool loop, API calls, retry)
│   ├── maestro.py         # NEW: Maestro orchestrator agent
│   ├── deep_thinker.py    # Primary reasoning agent
│   ├── contrarian.py      # Adversarial challenger
│   ├── verifier.py        # PRM step-by-step verification
│   ├── synthesizer.py     # Merges all conclusions
│   └── metacognition.py   # Swarm psychologist
├── events/
│   ├── __init__.py
│   ├── bus.py             # Per-session asyncio.Queue pub/sub
│   └── types.py           # 11 Pydantic event models (9 existing + 2 new)
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

### Dashboard Swarm UI (`apps/web/src/`) — New files

```
apps/web/src/
├── components/swarm/
│   ├── SwarmView.tsx       # MODIFY: add graph/cards toggle, checkpoint controls
│   ├── SwarmGraph.tsx      # NEW: live react-flow graph visualization
│   ├── SwarmControls.tsx   # NEW: human-in-the-loop checkpoint UI
│   ├── AgentCard.tsx       # Existing (minor updates for Maestro)
│   ├── SwarmTimeline.tsx   # Existing (add checkpoint events)
│   ├── index.ts            # MODIFY: export new components
│   └── __tests__/          # NEW: component test directory
│       ├── SwarmView.test.tsx
│       ├── AgentCard.test.tsx
│       └── SwarmGraph.test.tsx
├── lib/
│   ├── swarm-client.ts    # MODIFY: add new event types + checkpoint API
│   ├── swarm-graph-layout.ts  # NEW: incremental graph layout
│   └── hooks/use-swarm.ts # MODIFY: add graphNodes/graphEdges to state
```

### Tests — New files

```
agents/tests/
├── test_maestro.py         # NEW: Maestro agent tests
└── test_checkpoint.py      # NEW: Checkpoint/re-run tests
```

---

## Existing APIs & Interfaces (for reference)

### SwarmManager Pipeline (current — will be extended with Phase 0)

```python
# agents/src/swarm.py
class SwarmManager:
    async def run(self, query: str, session_id: str) -> dict:
        # Phase 0: Maestro decomposes query (NEW)
        #   MaestroAgent selects agents + effort levels
        #   Falls back to regex classification if Maestro times out
        # Phase 1: Primary agents (parallel, staggered 2.5s)
        #   Agents selected by Maestro (or all 3 as fallback)
        # Phase 2: SynthesizerAgent (sequential)
        # Phase 3: MetacognitionAgent (sequential)

    async def rerun_with_correction(self, session_id: str, node_id: str, correction: str) -> dict:
        # NEW: Re-run specific agents with human correction
```

### SwarmState (current — will be extended)

```typescript
interface SwarmState {
  phase: "idle" | "running" | "synthesis" | "complete" | "error";
  agents: Record<string, AgentStatus>;
  events: SwarmEventUnion[];
  synthesis: string | null;
  synthesisConfidence: number | null;
  insights: Array<{ type: string; description: string; agents: string[] }>;
  error: string | null;
  totalTokens: number;
  totalDuration: number | null;
  startTimestamp: string | null;
  connectionState: ConnectionState;
  // NEW additions:
  graphNodes: SwarmGraphNode[];   // For live graph visualization
  graphEdges: SwarmGraphEdge[];   // For live graph visualization
  maestroDecomposition: MaestroDecomposition | null;  // Maestro's plan
}
```

### 9+2 Event Types (Python ↔ TypeScript matched)

| Python Event           | TypeScript Event        | Trigger                      | Status   |
| ---------------------- | ----------------------- | ---------------------------- | -------- |
| `SwarmStarted`         | `swarm_started`         | SwarmManager.run() begins    | Existing |
| `AgentStarted`         | `agent_started`         | Each agent's run() begins    | Existing |
| `AgentThinking`        | `agent_thinking`        | Thinking block deltas        | Existing |
| `GraphNodeCreated`     | `graph_node_created`    | Node added to graph          | Existing |
| `AgentChallenges`      | `agent_challenges`      | Contrarian challenges a node | Existing |
| `VerificationScore`    | `verification_score`    | Verifier scores a step       | Existing |
| `AgentCompleted`       | `agent_completed`       | Agent finishes               | Existing |
| `SynthesisReady`       | `synthesis_ready`       | Synthesis written to graph   | Existing |
| `MetacognitionInsight` | `metacognition_insight` | Metacog writes insight       | Existing |
| `MaestroDecomposition` | `maestro_decomposition` | Maestro's deployment plan    | **NEW**  |
| `HumanCheckpoint`      | `human_checkpoint`      | User checkpoints a node      | **NEW**  |

### Auth Flow (unchanged)

```
Browser → GET /api/swarm/token → Next.js generates HMAC server-side → returns { token, wsUrl }
Browser → WebSocket wsUrl/ws/{sessionId}?token={token} → Python validates HMAC
Browser → POST /api/swarm → Next.js proxy → Python /api/swarm (token attached server-side)
Browser → POST /api/swarm/{sessionId}/checkpoint → Next.js proxy → Python (NEW)
```

---

## Agent Team Organization

### Agent 1: "maestro-builder" (Python Backend)

**Type**: `general-purpose`
**Tasks**: M1 (MaestroAgent class), M2 (Wire into SwarmManager), M3 (Maestro events), T4 (Maestro tests)
**Prompt**: "You are a Python agent architecture specialist. Implement the Maestro orchestrator agent for the Opus NX V2 swarm. Read `OPUS_NX_V2_SPEC.md` section 'The 6 Opus Agents → Agent 1: Maestro' for the full spec. Read `agents/src/agents/base.py` for the BaseOpusAgent class you'll extend. Read `agents/src/swarm.py` for the current SwarmManager pipeline where Maestro will be wired in as Phase 0. Create `agents/src/agents/maestro.py` with tools: `decompose_query` (break query into sub-tasks), `select_agents` (choose which agents to deploy), `set_agent_effort` (assign effort per agent). Wire Maestro into SwarmManager as Phase 0 with a 15-second timeout and regex-classification fallback. Add `MaestroDecomposition` event type to `events/types.py`. Write tests in `agents/tests/test_maestro.py`. Maestro must be FAST — use effort 'high' (not max), max_tokens 4096."

### Agent 2: "graph-visualizer" (Frontend)

**Type**: `general-purpose`
**Tasks**: G1 (SwarmGraph component), G2 (Graph data from events), G3 (Layout engine), G4 (Graph/Cards toggle), G5 (Node coloring)
**Prompt**: "You are a React 19 + react-flow visualization specialist. Build the live swarm graph visualization for the Opus NX V2 dashboard — this is the centerpiece of the hackathon demo. Read `apps/web/src/components/graph/ThinkingGraph.tsx` for the existing react-flow setup and patterns. Read `apps/web/src/components/graph/EdgeTypes.tsx` for the 9 edge type components. Read `apps/web/src/lib/hooks/use-swarm.ts` for the hook that provides event data. Create `SwarmGraph.tsx` that renders a live react-flow graph fed by swarm events. Create `swarm-graph-layout.ts` for incremental node positioning (columnar: one column per agent, nodes stack vertically). Extend `use-swarm.ts` SwarmState with `graphNodes` and `graphEdges` arrays built from events. Add a Cards/Graph toggle to `SwarmView.tsx`. Color-code nodes by agent: Deep Thinker (blue), Contrarian (amber), Verifier (orange), Synthesizer (green), Metacognition (violet). Nodes must animate in smoothly. Use existing `edgeTypes` for edges. The graph must render incrementally — no full re-layout on each new node."

### Agent 3: "checkpoint-builder" (Full Stack)

**Type**: `general-purpose`
**Tasks**: L1-L5 (Human-in-the-Loop), T5 (Checkpoint tests)
**Prompt**: "You are a full-stack engineer specializing in real-time interactive systems. Implement human-in-the-loop steering for the Opus NX V2 swarm. Read `apps/web/src/app/api/reasoning/[id]/checkpoint/route.ts` for the V1 checkpoint pattern (verdict schema, re-reasoning flow). Read `agents/src/server.py` for the FastAPI endpoints and auth pattern. Add `POST /api/swarm/{session_id}/checkpoint` endpoint to `server.py` that accepts `{node_id, verdict, correction}`, writes annotation to graph, and optionally triggers a targeted re-run. Add `rerun_with_correction()` to `agents/src/swarm.py` that re-deploys 1-2 agents with the correction. Create `SwarmControls.tsx` component with Verify/Question/Disagree buttons for reasoning nodes, appearing after swarm completes. Add `HumanCheckpoint` event type. Wire into `SwarmView.tsx` after synthesis. Write tests in `agents/tests/test_checkpoint.py`. Keep it simple for the demo — re-run just re-deploys Contrarian + Deep Thinker with correction appended to query."

### Agent 4: "deployer" (DevOps)

**Type**: `general-purpose`
**Tasks**: F1-F5 (Production Deployment)
**Prompt**: "You are a DevOps specialist. Deploy the Opus NX V2 swarm to production. The Python backend goes to Fly.io using the existing `infra/fly.toml` and `agents/Dockerfile`. The Next.js dashboard is already on Vercel. Steps: (1) Verify `agents/Dockerfile` builds correctly with `docker build`. (2) Deploy to Fly.io with `fly deploy` from the `agents/` directory. (3) Set Fly.io secrets: `ANTHROPIC_API_KEY`, `AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. (4) Verify `/api/health` returns ok. (5) Test WebSocket connectivity. (6) Set up Neo4j AuraDB free tier if time permits (optional — system works without it). (7) Update Vercel env vars: `NEXT_PUBLIC_SWARM_URL` pointing to Fly.io. (8) Verify cross-origin requests work. (9) Run a full swarm from the deployed dashboard. Report all findings and any issues."

### Agent 5: "test-polisher" (Quality + Demo)

**Type**: `general-purpose`
**Tasks**: T1-T3 (Component Tests), T6 (Cleanup), D5 (Error recovery)
**Prompt**: "You are a test automation and quality engineer. Write component tests and do final cleanup for the Opus NX V2 swarm dashboard. Read `apps/web/src/components/swarm/SwarmView.tsx`, `AgentCard.tsx`, and `SwarmTimeline.tsx`. Write Vitest + React Testing Library tests for: (1) SwarmView — idle/running/complete/error states, (2) AgentCard — all status types, (3) SwarmGraph — node/edge rendering from events. Put tests in `apps/web/src/components/swarm/__tests__/`. Also verify error recovery: mock one agent failing and confirm partial results display correctly. Clean up unused imports, verify `pnpm typecheck` and `pnpm lint` pass. Use existing patterns from `packages/core/src/*.test.ts` for Vitest conventions."

---

## Task Dependencies

```
M1 (MaestroAgent) ─→ M2 (Wire into SwarmManager) ─→ M4 (Dashboard card)
M3 (Events) ───────┘

G2 (Graph data) ─→ G1 (SwarmGraph) ─→ G4 (Toggle) ─→ G5 (Coloring)
G3 (Layout) ──────┘

L1 (Checkpoint endpoint) ─→ L2 (Re-run) ─→ L4 (SwarmControls) ─→ L5 (Wire SwarmView)
L3 (Events) ──────────────┘

F1-F5 (Deployment) ─→ can start immediately (independent)

T1-T3 (Component tests) ─→ after G1 and L4 are done
T4 (Maestro tests) ─→ after M1 is done
T5 (Checkpoint tests) ─→ after L1 is done

D1-D5 (Demo) ─→ ALL implementation must be done first
```

## Parallel Execution Plan

**Wave 1** (start immediately, no dependencies):

- `maestro-builder`: M1 + M3 (agent class + events)
- `graph-visualizer`: G2 + G3 (event data + layout engine)
- `checkpoint-builder`: L1 + L3 (endpoint + events)
- `deployer`: F1 + F2 + F3 + F4

**Wave 2** (after Wave 1 delivers):

- `maestro-builder`: M2 + M4 + T4 (wire into SwarmManager + dashboard + tests)
- `graph-visualizer`: G1 + G4 + G5 (SwarmGraph component + toggle + coloring)
- `checkpoint-builder`: L2 + L4 + L5 + T5 (re-run + SwarmControls + wire + tests)
- `deployer`: F5 (smoke test deployed stack)

**Wave 3** (after Wave 2):

- `test-polisher`: T1 + T2 + T3 + T6 (component tests + cleanup)
- All: Integration testing, bug fixes

**Wave 4** (final — requires everything else done):

- D1-D5: Demo pre-testing, recording, submission (manual with orchestrator oversight)

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
cd agents && uv run pytest tests/ -v         # 72+ tests passing (should grow to 85+)

# Functional verification (MANDATORY)
# 1. Start Python backend: cd agents && uv run python -m src.main
# 2. Start Next.js: pnpm --filter @opus-nx/web dev
# 3. Open browser → Swarm tab → submit query → verify:
#    a. Maestro card appears and decomposes query
#    b. Agent cards appear and stream thinking
#    c. Graph view shows nodes appearing + edges
#    d. Synthesis displays
#    e. Checkpoint controls appear
# 4. Check Python backend logs for errors
# 5. Check browser console for errors
```

### Cross-Layer Verification

- Event schemas: Python `events/types.py` fields MUST match TypeScript `swarm-client.ts` interfaces
- New events: `maestro_decomposition` and `human_checkpoint` must be in BOTH Python and TypeScript
- Auth HMAC: Server-side token generation only — never in browser code
- WebSocket path: Python `/ws/{session_id}?token=` MUST match TypeScript client
- Edge types: Python `EdgeRelation` enum values MUST match dashboard edge type keys
- Graph node format: Python graph nodes (from events) MUST be compatible with react-flow node format
- Checkpoint endpoint: Python `/api/swarm/{session_id}/checkpoint` must be accessible via Next.js proxy

### Code Standards

- Python: PEP 8, type hints everywhere, `datetime.now(timezone.utc)` (NOT deprecated `utcnow()`), pydantic models
- TypeScript: strict mode, functional components, `useCallback` for handlers
- No unused imports, no `any` types, no silent error swallowing
- Conventional commits: `feat(maestro):`, `feat(swarm-graph):`, `feat(checkpoint):`, `feat(deploy):`

---

## Known Patterns to Watch For

These caused bugs in previous sessions:

1. **pydantic-settings vs os.environ**: `Settings()` loads `.env` into Python object attributes, NOT into `os.environ`. Pass `api_key` explicitly to all new agents (including Maestro).

2. **model_dump() vs model_dump(mode="json")**: Any Pydantic model going to JSON (WebSocket, REST response, logs) MUST use `mode="json"` to convert datetime, UUID, Enum.

3. **Node.js crypto in browser**: Never import from `"crypto"` in client-side TypeScript.

4. **asyncio.create_task fire-and-forget**: Tasks created this way can silently fail. Ensure all fire-and-forget tasks have exception handlers.

5. **WebSocket lifecycle**: Token fetch is async. Subscription must handle `close()` before WebSocket opens (the `closed` flag pattern).

6. **React Flow node positions**: Nodes without explicit `position: {x, y}` won't render. The layout engine MUST assign positions before passing to React Flow.

7. **Event ordering**: Maestro events MUST arrive before agent_started events. The SwarmView should handle Maestro's decomposition display before showing agent cards.

---

## Reference Files (Read These First)

| File                                                      | Why                                                   |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `OPUS_NX_V2.md`                                           | Vision doc — Maestro role, demo flow, 5-minute script |
| `OPUS_NX_V2_SPEC.md`                                      | Implementation spec — Maestro tools, all agent specs  |
| `CLAUDE.md`                                               | Project conventions, pre-commit requirements          |
| `agents/src/agents/base.py`                               | BaseOpusAgent — Maestro extends this                  |
| `agents/src/swarm.py`                                     | SwarmManager — Maestro wires in here as Phase 0       |
| `agents/src/server.py`                                    | FastAPI — checkpoint endpoint goes here               |
| `agents/src/events/types.py`                              | Event models — add Maestro + checkpoint events        |
| `apps/web/src/lib/swarm-client.ts`                        | Client — add new event types                          |
| `apps/web/src/lib/hooks/use-swarm.ts`                     | Hook — add graph data to state                        |
| `apps/web/src/components/swarm/SwarmView.tsx`             | Main UI — graph toggle + checkpoint controls          |
| `apps/web/src/components/graph/ThinkingGraph.tsx`         | React Flow patterns — reference for SwarmGraph        |
| `apps/web/src/components/graph/EdgeTypes.tsx`             | Edge components — reuse in SwarmGraph                 |
| `apps/web/src/app/api/reasoning/[id]/checkpoint/route.ts` | V1 checkpoint — pattern reference                     |
| `agents/tests/conftest.py`                                | Test fixtures — extend for Maestro + checkpoint tests |

---

## Git Workflow

- Branch: `develop`
- Conventional commits: `feat(maestro):`, `feat(swarm-graph):`, `feat(checkpoint):`, `feat(deploy):`
- After all quality gates pass + demo runs clean → merge `develop` → `main`
- Tag: `v2.0.0` after merge to main

---

## Demo Script (5 minutes) — What We're Building Toward

```
0:00 - 0:30  "What you're about to see: 6 Opus 4.6 agents thinking simultaneously."
             Dashboard shows empty graph. User types:
             "Should we migrate our monolith to microservices?"

0:30 - 1:00  Maestro card appears. Its thinking stream shows query decomposition:
             "I'll deploy Deep Thinker for architectural analysis, Contrarian to
             challenge assumptions, and Verifier to score each step."
             ──→ THIS IS NEW: Maestro agent making decisions visible.

1:00 - 2:30  ALL AGENTS THINKING AT ONCE.
             ──→ Graph tab shows nodes appearing in real-time
             ──→ Deep Thinker's column grows with blue nodes
             ──→ Contrarian creates amber CHALLENGES edges — visible disagreement
             ──→ Verifier adds cyan VERIFIES edges — nodes turn green/yellow/red
             ──→ Cards tab shows thinking streams on each agent card
             THIS IS THE MONEY SHOT.

2:30 - 3:30  Metacognition agent analyzes the swarm.
             "I notice anchoring bias — Deep Thinker and Contrarian both
             assumed microservices means Kubernetes..."
             Insight card appears on dashboard.

3:30 - 4:00  Synthesizer produces final answer.
             Synthesis card appears with confidence score.
             User switches to Graph tab — sees the full reasoning graph
             with CHALLENGES and VERIFIES edges.

4:00 - 4:30  Human-in-the-loop: User clicks "Disagree" on a reasoning step.
             Types: "Consider serverless as an alternative to microservices."
             ──→ THIS IS NEW: Swarm re-engages with the correction.
             Contrarian and Deep Thinker re-run with the new constraint.

4:30 - 5:00  Architecture slide. "Multiple parallel Opus 4.6 agents.
             Shared reasoning graph. Real-time WebSocket streaming.
             Human-in-the-loop steering. Built in 7 days with Claude Code."
```

---

## Fallback Matrix

| Focus             | Risk                             | Fallback                                                                                                 | Impact                                        |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Maestro Agent     | Too slow or complex              | Keep existing regex classification. Just add a "Maestro" label to the SwarmManager's decomposition.      | Still works, less impressive                  |
| Live Graph        | React Flow performance issues    | Show graph as a static snapshot after swarm completes (like V1). Keep cards as the primary running view. | Loses the "money shot" but functional         |
| Human-in-the-Loop | Checkpoint re-run too complex    | Show checkpoint UI (verify/question/disagree) but don't implement re-run. Just persist the annotation.   | Still shows steering, no re-run               |
| Fly.io Deploy     | WebSocket CORS or timeout issues | Demo from localhost. Record video locally.                                                               | Not deployed but demo still works             |
| Neo4j AuraDB      | Setup fails or free tier issues  | Skip entirely. NetworkX + Supabase sync is enough.                                                       | No Cypher visualization but graph still works |

---

## What Winning Looks Like

After this session:

1. **Maestro agent decomposes queries** — visible in the dashboard as the first step
2. **Live graph grows in real-time** — the centerpiece of the demo, nodes appearing with colored edges
3. **Human-in-the-loop works** — users can checkpoint and correct the swarm's reasoning
4. **Deployed to production** — Fly.io + Vercel with WebSocket working cross-origin
5. **3 demo scenarios tested** — each completes in < 120 seconds with good agent behavior
6. **5-minute demo recorded** — compelling video showing the full swarm flow
7. **Component tests pass** — comprehensive coverage for swarm UI
8. **Ready to merge to main** — `develop` → `main` with `v2.0.0` tag

**Start by reading the reference files, then organize the agent team and begin Wave 1.**
