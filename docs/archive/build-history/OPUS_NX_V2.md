# Opus NX V2: The Swarm Architecture

> **Status**: Implementation-Ready Vision Document | **Last Verified**: February 2026
> **Model**: claude-opus-4-6 | **API Tier**: 2 (1000 req/min, 80K input/min)
> **Runtime**: Python 3.12 + AsyncAnthropic | **Dashboard**: Next.js 16 (existing)

---

## V1 Reality Check — What We Actually Built

Before defining V2, we must be honest about V1's strengths and limitations. The V1 codebase has **4,499 lines** of production-tested TypeScript across 6 core modules, 42 frontend components, 25 API routes, and Supabase persistence. Here is what V1 gets right and what it doesn't.

### What V1 Gets Right

**Adaptive Thinking (thinking-engine.ts, lines 179-184)**:
V1 already uses the correct, non-deprecated Opus 4.6 API pattern:

```typescript
// V1 ALREADY does this correctly:
if (this.config.thinking.type === "adaptive") {
  requestParams.thinking = { type: "adaptive" };
  requestParams.output_config = { effort: this.config.thinking.effort };
}
```

The default config at `types/orchestrator.ts` line 87 sets `type: "adaptive"`. The deprecated `thinking: {type: "enabled", budget_tokens: N}` exists only as a legacy fallback, never the default.

**ThinkFork Is NOT "Fire-and-Forget" (thinkfork.ts, 1,166 lines)**:
ThinkFork is the most sophisticated module in V1:

- Concurrent 4-style reasoning via `Promise.allSettled()` (line 183) with per-branch error recovery
- Full comparison analysis (lines 448-597): convergence points, divergence points, meta-insight, recommended approach
- Steering actions (lines 640-821): expand, merge, challenge, refork — human-in-the-loop control
- **Multi-round debate mode** (lines 884-1041): agents see each other's conclusions, respond with counterpoints and concessions, consensus detection via average confidence

**Metacognition Already Does Multi-Turn Tool Loops (metacognition.ts, lines 339-436)**:
V1's metacognition engine already implements the autonomous tool loop pattern:

1. Sends reasoning context with extraction tool → Claude calls tool
2. Checks which of 3 required insight types were produced
3. Constructs follow-up prompts for missing types with full conversation history
4. Iterates up to 3 times until all types covered
5. Validates evidence node references against actual analyzed nodes (hallucination detection)

**Additional V1 Strengths**:

- Context compaction support (`compact_20260112`) for long sessions (thinking-engine.ts, lines 198-215)
- Token budget enforcement with 80% warning threshold (orchestrator.ts)
- Compaction boundary nodes with `supersedes` edges (orchestrator.ts, lines 436-501)
- Dynamic effort routing via regex complexity classification (orchestrator.ts, lines 33-47)
- Data residency support (`inference_geo: "us"`) (thinking-engine.ts, lines 193-196)
- PRM step-by-step verification with geometric mean scoring (prm-verifier.ts, lines 326-356)

### What V1 Actually Lacks

Despite its sophistication, V1 has three structural limitations that no amount of refactoring can fix:

1. **No Inter-Agent Communication**: ThinkFork runs 4 branches concurrently, but no branch can read another's reasoning *during execution*. The Contrarian style can't see what the Conservative style concluded until the comparison phase. In a true swarm, the Contrarian reads Deep Thinker's graph nodes in real-time and responds.

2. **No Shared Reasoning Substrate**: V1 persists reasoning to Supabase after each turn, but there's no live, in-memory graph that multiple agents read and write simultaneously. Each module operates on its own data — ThinkFork doesn't write to ThinkGraph, Metacognition reads from ThinkGraph but can't see ThinkFork's branches, the Verifier processes one chain at a time.

3. **No Agent Autonomy**: The 5 agents defined in `configs/agents.yaml` are routing labels — the Orchestrator assigns task names but processes everything through a single ThinkingEngine instance. There are no autonomous agents with their own tool sets, state, and decision-making. The `packages/agents/` directory is empty.

**The Gap**: V1 has all the algorithms (PRM, debate, metacognition) but runs them as serial function calls through a single Claude instance. V2 runs them as N concurrent Opus 4.6 agents sharing a live reasoning graph.

---

## WHY V2: What Changes

| V1 Reality                                   | V2 Target                              | WHY It Matters                                                                                 |
| -------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Serial processing through one ThinkingEngine | N concurrent Opus 4.6 agents           | 3-5x faster for complex queries. Agents work in parallel, not sequence.                        |
| Reasoning persisted after-the-fact           | Live shared graph during execution     | Agents react to each other's reasoning in real-time. The graph IS the collaboration.           |
| Static "agents" = routing labels             | Autonomous agents with tools + state   | Each agent has its own system prompt, tools, and can make independent decisions.               |
| No cross-agent challenges                    | CHALLENGES/VERIFIES edges in real-time | Contrarian challenges Deep Thinker's reasoning while Verifier scores it. Visible in the graph. |
| Metacognition analyzes history               | Metacognition watches the live swarm   | Detects groupthink, anchoring bias, and productive tension across agents in real-time.         |
| SSE streaming (one source)                   | WebSocket (multi-agent concurrent)     | Multiple agents' thinking streams simultaneously to the dashboard.                             |

**SO WHAT**: Judges see 6 Opus agents thinking simultaneously, challenging each other, verifying reasoning, and producing collectively intelligent answers — all visible in real-time. No other hackathon project will demonstrate this.

---

## WHAT: The V2 Architecture

```
User submits complex question
         |
         v
+---------------------+
|   MAESTRO (Opus)     |  Decomposes query, selects agents, monitors swarm
|   effort: high       |
+----------+----------+
           | deploys (staggered 2.5s apart for Tier 2)
    +------+---------------+
    |      |               |
+---v--+ +-v--------+ +---v-----+
|DEEP  | |CONTRARI- | |VERIFIER |
|THINK | |AN        | |(PRM)    |
|max   | |high      | |high     |
|effort| |effort    | |effort   |
+--+---+ +--+------+ +--+------+
   |        |            |
+--v--------v------------v--------+
|   SHARED REASONING GRAPH         |
|   NetworkX (hot) -> Neo4j (warm) |
|   Nodes appear in real-time      |
|   Agents READ each other's work  |
|   CHALLENGES/VERIFIES edges      |
+--------------+------------------+
               |
        +------+------+
  +-----v--+ +v-------v---+
  |SYNTHES-| |METACOG      |
  |IZER    | |(Psychol.)   |
  |Merges  | |Watches      |
  |outputs | |swarm for    |
  |        | |biases       |
  +--------+ +------+------+
                     |
         +-----------v---------+
         |  EventBus            |
         |  asyncio.Queue       |
         |  -> WebSocket        |
         |  -> Dashboard        |
         +---------------------+
```

### Execution Phases

**Phase 1 — Decomposition** (~2s): Maestro classifies query complexity, selects agents, defines the swarm strategy.

**Phase 2 — Primary Agents** (~30-90s): Deep Thinker, Contrarian, and Verifier run concurrently. Staggered launches (2.5s apart) stay within Tier 2 rate limits. Each agent writes to the shared graph and publishes events.

**Phase 3 — Synthesis** (~15-30s): After primaries complete, the Synthesizer reads the full graph and produces a unified answer with convergence/divergence analysis.

**Phase 4 — Metacognition** (~15-30s): The Metacognition agent analyzes the swarm's collective reasoning for biases, groupthink, and productive tension.

**Total**: 60-150 seconds for a full swarm run. Individual agents can be skipped for simpler queries.

---

## HOW: Technology Stack

| Layer               | Technology                                     | WHY This, Not That                                                                                                           |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Agent Runtime**   | Python 3.12 + `anthropic` SDK (AsyncAnthropic) | asyncio for true concurrent agents. pydantic for validation. networkx for in-memory graph. The AI ecosystem lives in Python. |
| **API Framework**   | FastAPI + WebSocket                            | Native async, WebSocket for bidirectional real-time streaming, auto OpenAPI docs.                                            |
| **Hot Graph**       | NetworkX (in-memory)                           | Zero-latency reads/writes for agents. `asyncio.Lock` for coroutine safety. Python-native graph algorithms.                   |
| **Warm Graph**      | Neo4j AuraDB (free tier)                       | Cypher queries for inter-agent relationships. **50K nodes, 175K edges** free. Background sync, NOT in critical path.         |
| **Event Bus**       | asyncio.Queue (per session)                    | In-process pub/sub. Zero infra. Same semantics as Redis for a single-server hackathon demo.                                  |
| **Dashboard**       | Next.js 16 + React 19 (existing)               | 42 components already built. Swap REST for WebSocket. Add SwarmView + AgentCard.                                             |
| **Auth/Sessions**   | Supabase (existing)                            | Keep existing auth, session tables, thinking_nodes persistence.                                                              |
| **Deployment**      | Fly.io (Python) + Vercel (Next.js)             | WebSocket support on Fly.io. Existing Vercel setup for Next.js.                                                              |
| **Package Manager** | uv (Python)                                    | Rust-powered, orders of magnitude faster than pip. `uv.lock` for reproducibility. Standard for Python in 2026.               |

### Why `anthropic` SDK, Not Claude Agent SDK

The Claude Agent SDK (`claude-agent-sdk` on PyPI) wraps the Claude Code CLI, not the raw Messages API. It provides built-in tools (Read, Write, Bash, Grep) and a managed tool loop — great for coding agents, but wrong for our swarm because:

1. **We need custom tools**: `write_reasoning_node`, `create_challenge`, `score_reasoning_step` — these don't exist in the Agent SDK. We'd need MCP servers for each, adding complexity.
2. **We need to control the tool loop**: Between each tool call iteration, we persist to the graph and publish events. The Agent SDK's tool loop is opaque.
3. **We need concurrent streaming**: Multiple agents stream thinking tokens simultaneously to the EventBus. The Agent SDK doesn't expose streaming control at this level.

The raw `anthropic` SDK with `AsyncAnthropic` gives us full control over streaming, tool execution, and conversation management — exactly what V1's ThinkingEngine already does.

### Opus 4.6 API Pattern (Correct)

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from env

async with client.messages.stream(
    model="claude-opus-4-6",
    max_tokens=16384,
    thinking={"type": "adaptive"},         # Opus 4.6 recommended
    output_config={"effort": "max"},       # Controls thinking depth
    system=system_prompt,
    messages=messages,
    tools=tools,
) as stream:
    async for event in stream:
        if event.type == "content_block_delta":
            if event.delta.type == "thinking_delta":
                # Stream thinking to EventBus for dashboard
                await bus.publish(session_id, AgentThinking(
                    agent=agent_name, delta=event.delta.thinking
                ))
            elif event.delta.type == "text_delta":
                response_text += event.delta.text

    final = await stream.get_final_message()
```

**Key Opus 4.6 specs**:

- Model ID: `claude-opus-4-6` (no date suffix)
- Context window: 200K tokens (1M with `context-1m-2025-08-07` beta header)
- Max output: **128K tokens**
- Pricing: $5/MTok input, $25/MTok output
- Adaptive thinking: `thinking: {"type": "adaptive"}` (only model that supports it)
- Interleaved thinking: automatic with adaptive mode — no beta header needed
- Effort levels: `low`, `medium`, `high`, `max` (max = deepest reasoning, Opus 4.6 only)

**DEPRECATED on Opus 4.6**: `thinking: {"type": "enabled", "budget_tokens": N}` — still works but will be removed.

---

## The 6 Opus Agents

### 1. Maestro Agent

**Role**: The conductor. Receives user queries, selects agents, monitors the swarm, triggers synthesis.
**Effort**: `high` — needs good reasoning for task decomposition but not maximum depth.

**Tools**:

- `deploy_agents` — Select and configure which agents to launch
- `query_graph` — Read the shared reasoning graph
- `read_agent_output` — Check what an agent has produced
- `trigger_synthesis` — Signal the Synthesizer to begin

**Pipeline**: Classify complexity (regex patterns from V1 orchestrator.ts lines 33-47) → Select agents → Deploy via SwarmManager → Monitor events → Trigger synthesis when primaries complete.

**Ports from V1**: Orchestrator complexity classification (lines 33-47), effort routing (lines 404-420), task plan schema.

### 2. Deep Thinker Agent

**Role**: The philosopher. Uses maximum thinking depth for thorough analysis. Writes structured reasoning to the shared graph.
**Effort**: `max` — this IS the deep analysis agent. Opus 4.6's full adaptive thinking.

**Tools**:

- `write_reasoning_node` — Persist reasoning step to shared graph (triggers dashboard update)
- `mark_decision_point` — Flag key decisions with alternatives and rationale
- `read_graph_context` — See what other agents have written

**Pipeline**: Think deeply (50k+ tokens) → Extract structured reasoning → Write nodes to graph → Mark decision points.

**Ports from V1**: Decision point extraction regex (think-graph.ts, lines 160-178), structured reasoning parsing (think-graph.ts, lines 295-326), confidence scoring (think-graph.ts, lines 517-581).

### 3. Contrarian Agent

**Role**: The devil's advocate. Reads other agents' reasoning from the graph and creates explicit CHALLENGES edges.
**Effort**: `high` — needs sharp reasoning to find flaws.

**Tools**:

- `read_agent_reasoning` — Read specific agent's nodes from graph
- `create_challenge` — Create a CHALLENGES edge with counter-argument, severity, flaw type
- `concede_point` — Create a SUPPORTS edge when reasoning is genuinely sound

**Pipeline**: Read Deep Thinker's nodes → Find logical gaps, unsupported assumptions → Create CHALLENGES edges → Concede sound points.

**Ports from V1**: ThinkFork contrarian style prompt (`configs/prompts/thinkfork/contrarian.md`), flaw type taxonomy from PRM verifier (prm-verifier.ts, lines 48-57).

**Key difference from V1**: In V1, the contrarian branch runs independently and only sees other branches during comparison. In V2, the Contrarian agent reads the live graph and responds to Deep Thinker's actual reasoning in real-time.

### 4. Verifier Agent

**Role**: The auditor. Implements PRM (Process Reward Model) verification. Scores each reasoning step and creates VERIFIES edges.
**Effort**: `high` — needs careful step-by-step evaluation.

**Tools**:

- `read_reasoning_chain` — Get ordered chain of reasoning nodes
- `score_reasoning_step` — Score a step with verdict + confidence
- `emit_verification` — Create VERIFIES edge and publish score event

**Scoring formula** (ported from V1 prm-verifier.ts, lines 326-356):

```
Per-step: correct *= confidence, incorrect *= (1-confidence) * 0.3,
          neutral *= 0.9, uncertain *= 0.7
Chain score = geometric_mean(all step scores)
Valid if score >= 0.7
```

**Verdict types**: `correct`, `incorrect`, `neutral`, `uncertain`
**Issue types**: `logical_error`, `factual_error`, `missing_context`, `unsupported_claim`, `circular_reasoning`, `non_sequitur`, `overgeneralization`, `false_dichotomy`

**Pattern detection**: declining_confidence, recurring issues, overconfidence_before_error.

**Ports from V1**: Entire prm-verifier.ts (479 lines) → ~120 lines Python.

### 5. Synthesizer Agent

**Role**: The diplomat. Activated after primary agents complete. Reads the full graph, identifies convergence/divergence, and produces the final unified answer.
**Effort**: `high` — needs to weigh multiple perspectives carefully.

**Tools**:

- `read_full_graph` — Get all session nodes and edges
- `identify_convergence` — Where agents agree (full/partial/none)
- `identify_divergence` — Where agents disagree (high/medium/low significance)
- `produce_synthesis` — Final merged answer with confidence

**Ports from V1**: ThinkFork comparison analysis (thinkfork.ts, lines 448-597) — convergence points, divergence points, meta-insight, recommended approach.

### 6. Metacognition Agent

**Role**: The psychologist. Watches the ENTIRE swarm's reasoning patterns. Uses maximum thinking depth to analyze multi-agent dynamics.
**Effort**: `max` — analyzing swarm dynamics requires maximum reasoning depth.

**Tools**:

- `read_swarm_history` — All agents' reasoning nodes and edges
- `detect_bias_pattern` — Find systematic biases across agents
- `detect_groupthink` — Flag premature convergence without genuine challenge
- `record_insight` — Persist metacognitive insight with evidence

**Insight types** (expanded from V1):

| Type                     | Description                                               | Why New in V2                  |
| ------------------------ | --------------------------------------------------------- | ------------------------------ |
| `bias_detection`         | Individual agent biases (from V1)                         | Same as V1                     |
| `pattern`                | Recurring reasoning structures (from V1)                  | Same as V1                     |
| `improvement_hypothesis` | Concrete testable suggestions (from V1)                   | Same as V1                     |
| `swarm_bias`             | **Multiple agents reinforce each other's errors**         | Only possible with multi-agent |
| `groupthink`             | **Agents converge too quickly without genuine challenge** | Only possible with multi-agent |
| `productive_tension`     | **Disagreement that led to better answers**               | Only possible with multi-agent |
| `anchoring_bias`         | **Early reasoning unduly influences later agents**        | Only possible with multi-agent |

**Ports from V1**: Focus areas (metacognition.ts, lines 36-42), insight tool schema (lines 51-53), multi-turn tool loop pattern (lines 339-436 — now handled by our custom tool loop in BaseOpusAgent).

---

## The Shared Reasoning Graph

The graph is the shared workspace where agents collaborate. It has three tiers:

| Tier     | Technology           | Latency   | Durability   | Purpose                                     |
| -------- | -------------------- | --------- | ------------ | ------------------------------------------- |
| **Hot**  | NetworkX (in-memory) | < 1ms     | Session-only | All agent reads/writes during execution     |
| **Warm** | Neo4j AuraDB (free)  | 50-200ms  | Persistent   | Cross-session queries, Cypher visualization |
| **Cold** | Supabase (existing)  | 100-300ms | Persistent   | Dashboard compatibility, existing tables    |

**Concurrency model**: `asyncio.Lock` protects all NetworkX mutations. NetworkX is NOT thread-safe — any `await` between read and write creates a race condition without the lock.

**Persistence strategy**: Fire-and-forget async tasks sync nodes/edges to Neo4j and Supabase. If either is down, the system continues via NetworkX. The graph is always available.

### Neo4j: Why It Changes Everything

The killer Cypher query — "Show me all reasoning that was challenged but survived verification":

```cypher
MATCH (r:ReasoningNode)<-[:CHALLENGES]-(c:Challenge),
      (r)<-[:VERIFIES]-(v:Verification)
WHERE r.session_id = $sessionId
  AND v.score > 0.7
RETURN r, c, v
ORDER BY r.created_at
```

In PostgreSQL this would be 3 JOINs, a subquery, and application-level graph reconstruction. In Neo4j it's a single readable pattern match.

**Neo4j AuraDB free tier limits**: 50K nodes, 175K relationships. More than enough for a hackathon demo.

### Edge Types

| Edge         | Meaning                         | Created By    |
| ------------ | ------------------------------- | ------------- |
| `LEADS_TO`   | Sequential reasoning flow       | Deep Thinker  |
| `CHALLENGES` | Counter-argument against a node | Contrarian    |
| `VERIFIES`   | Verification score for a node   | Verifier      |
| `SUPPORTS`   | Concession — reasoning is sound | Contrarian    |
| `MERGES`     | Synthesis of multiple nodes     | Synthesizer   |
| `OBSERVES`   | Metacognitive observation       | Metacognition |

---

## Real-Time Dashboard — WebSocket Event Stream

V1 uses SSE (Server-Sent Events) for single-source streaming. V2 needs WebSocket because:

1. **Multiple concurrent sources**: 3-6 agents stream thinking simultaneously
2. **Bidirectional**: Dashboard can send steering commands back
3. **Persistent connection**: No reconnection overhead between events

### Event Types

| Event                   | Source               | Dashboard Action                            |
| ----------------------- | -------------------- | ------------------------------------------- |
| `swarm_started`         | SwarmManager         | Initialize agent cards                      |
| `agent_started`         | BaseOpusAgent        | Show agent card with effort badge           |
| `agent_thinking`        | BaseOpusAgent        | Stream thinking delta to agent card         |
| `graph_node_created`    | SharedReasoningGraph | Add node to graph visualization             |
| `agent_challenges`      | Contrarian           | Add red CHALLENGES edge to graph            |
| `verification_score`    | Verifier             | Color-code node by score (green/yellow/red) |
| `agent_completed`       | BaseOpusAgent        | Show conclusion + confidence on card        |
| `synthesis_ready`       | Synthesizer          | Display final merged answer                 |
| `metacognition_insight` | Metacognition        | Show insight card with affected agents      |

### WebSocket Reliability

- **Heartbeat**: Server sends ping every 30s to prevent idle disconnect
- **Reconnection**: Client auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s)
- **Auth**: Token validated before `websocket.accept()` — unauthenticated connections rejected with 4001

---

## The Demo Flow — What Wins the Hackathon

```
0:00 - 0:30  "What you're about to see: 6 Opus 4.6 agents thinking simultaneously."
             Dashboard shows empty graph. User types a complex question.

0:30 - 1:00  Maestro decomposes the query. Agent cards appear on dashboard.
             Deep Thinker, Contrarian, Verifier start thinking.

1:00 - 2:30  ALL AGENTS THINKING AT ONCE.
             - The graph GROWS IN REAL-TIME as agents write nodes
             - Deep Thinker's adaptive thinking streams on its card
             - Contrarian creates red CHALLENGES edges — visible disagreement
             - Verifier scores steps — nodes turn green/yellow/red

             THIS IS THE MONEY SHOT. No other hackathon project will show
             3+ Opus agents working simultaneously with visible reasoning.

2:30 - 3:30  Metacognition agent analyzes the swarm.
             "I notice anchoring bias — Deep Thinker and Contrarian both
             assumed microservices means Kubernetes..."
             Insight card appears on dashboard.

3:30 - 4:00  Synthesizer produces final answer. User clicks into graph —
             navigates every agent's reasoning. CHALLENGES edges show where
             Contrarian pushed back. Verification scores show which reasoning
             survived scrutiny.

4:00 - 4:30  Human-in-the-loop: User adds checkpoint.
             "I disagree with step 3. Consider serverless."
             Maestro re-deploys with the new constraint.

4:30 - 5:00  Architecture slide. "Multiple parallel Opus 4.6 agents.
             Shared reasoning graph. Real-time WebSocket streaming.
             Built in 7 days with Claude Code."
```

### Demo Scenarios (pre-test these)

1. **"Should we migrate our monolith to microservices?"** — Classic trade-off. Triggers debate between Deep Thinker (thorough analysis) and Contrarian (challenges assumptions). Verifier scores each step.

2. **"What's the optimal strategy for entering the AI market in 2026?"** — Broad question. Deep Thinker produces structured analysis. Metacognition detects anchoring on current market conditions.

3. **"Is blockchain technology overhyped or genuinely transformative?"** — Contrarian has a field day. Expect productive tension and multiple CHALLENGES edges.

---

## Why We Win

| Criterion                         | Why We Win                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Most Creative Opus 4.6 Use**    | Multiple simultaneous Opus agents is the most aggressive use of Opus 4.6 at the hackathon. No one else will run this many in parallel.               |
| **Technical Depth**               | Neo4j graph, Python asyncio swarm, event-driven architecture, WebSocket real-time. Not a wrapper around a single API call.                           |
| **Visual Impact**                 | Watching agents think simultaneously, with the graph growing live and agents challenging each other — this is cinema.                                |
| **Research Backing**              | Tree of Thoughts (Yao 2023) for parallel reasoning. PRM (Lightman 2023) for step verification. Both as autonomous agents, not static function calls. |
| **"Only Possible with Opus 4.6"** | Adaptive thinking with `max` effort, 128K max output, interleaved thinking for tool loops — this literally can't work with any other model.          |

---

## Migration Path: V1 to V2

| V1 Component                | Lines  | V2 Action                               | Rationale                                                                                |
| --------------------------- | ------ | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/web/` (42 components) | ~5,000 | **Keep + Adapt**                        | Swap REST for WebSocket. Add SwarmView + AgentCard. ~80% reusable.                       |
| `thinking-engine.ts`        | 352    | **Port to BaseOpusAgent**               | Same API pattern (adaptive thinking), now in Python with AsyncAnthropic.                 |
| `thinkfork.ts`              | 1,166  | **Split into agents**                   | Debate mode → Contrarian agent. Comparison → Synthesizer agent. Steering → SwarmManager. |
| `metacognition.ts`          | 789    | **Port to MetacognitionAgent**          | Same multi-turn tool loop, now watching the full swarm instead of individual reasoning.  |
| `prm-verifier.ts`           | 479    | **Port to VerifierAgent**               | Same geometric mean scoring, now continuous (watches graph for new nodes).               |
| `orchestrator.ts`           | 774    | **Replace with Maestro + SwarmManager** | Biggest change: from sequential class to distributed swarm coordination.                 |
| `think-graph.ts`            | 939    | **Port to SharedReasoningGraph**        | Decision extraction moves to DeepThinkerAgent. Graph becomes NetworkX + Neo4j.           |
| `packages/db/` (Supabase)   | -      | **Keep for auth + sessions**            | Neo4j for reasoning graph, Supabase for user management and cold persistence.            |
| `supabase/migrations/`      | 6      | **Keep + add 007**                      | Existing tables stay. New migration adds swarm edge types + agent_name column.           |

---

## Estimated Timeline (7 Days)

| Day | Focus                                                                       | Deliverable                                                       |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Python scaffold + BaseOpusAgent + SharedReasoningGraph + EventBus + FastAPI | Single agent thinks, graph has nodes, events stream via WebSocket |
| 2   | 3 agents (DeepThinker, Contrarian, Verifier) + SwarmManager                 | 3 agents running in parallel with CHALLENGES and VERIFIES edges   |
| 3   | MaestroAgent + full pipeline + SynthesizerAgent                             | End-to-end: query → Maestro → agents → synthesis, events stream   |
| 4   | Dashboard adaptation (SwarmView, AgentCard, WebSocket hook)                 | Dashboard shows live swarm with agent cards and growing graph     |
| 5   | MetacognitionAgent + Neo4j AuraDB + Supabase sync                           | Full swarm with Neo4j persistence and metacognition insights      |
| 6   | Deploy (Fly.io + Vercel) + harden (timeouts, rate limits, error handling)   | Production-ready, 3 tested demo scenarios                         |
| 7   | Demo recording + submission                                                 | 5-minute demo video                                               |

### Rate Limit Strategy (Tier 2)

Tier 2 limits: 1,000 req/min, 80K input tokens/min.

- Stagger agent launches by 2.5 seconds each
- Deep Thinker launches first (needs most time, uses most thinking tokens)
- Contrarian launches at +2.5s (reads graph, so benefits from Deep Thinker's head start)
- Verifier launches at +5.0s (reads reasoning chains, benefits from existing data)
- Total stagger: ~7.5s for 3 primary agents
- Synthesizer and Metacognition run AFTER primaries complete (sequential, no rate concern)
- 3 primary agents × ~20K input tokens = ~60K, well within 80K/min limit

---

## Fallback Positions

| Day | If Behind Schedule...     | Fallback                                                               | Impact                                    |
| --- | ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| 2   | 3 agents don't coordinate | Focus on 2 (DeepThinker + Contrarian). Verifier as post-processing.    | Still impressive.                         |
| 3   | Maestro is too complex    | Skip Maestro. Hard-code which agents to deploy per query.              | No orchestration, but swarm still runs.   |
| 4   | WebSocket CORS issues     | SSE proxy through Next.js API routes (reuse existing V1 pattern).      | Less real-time, but functional.           |
| 5   | Neo4j setup fails         | Skip entirely. NetworkX + Supabase sync is enough.                     | No Cypher queries, but graph still works. |
| 5   | Metacognition not ready   | Skip it. 3-4 agent swarm is still the most ambitious at the hackathon. | Add later if time.                        |
| 6   | Deployment issues         | Demo from localhost. Record video locally.                             | Not deployed, but demo still works.       |

---

## Python Dependencies

```toml
[project]
name = "opus-nx-agents"
version = "2.0.0"
requires-python = ">=3.12"
dependencies = [
    "anthropic>=0.78.0",             # Opus 4.6 + adaptive thinking support
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "websockets>=14.0",
    "pydantic>=2.10",
    "pydantic-settings>=2.7",
    "networkx>=3.4",
    "httpx>=0.28",
    "structlog>=24.4",
    "neo4j>=5.26",
    "supabase>=2.12",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.24", "ruff>=0.8"]
```

**Note**: No `redis` dependency. The EventBus uses `asyncio.Queue` for the hackathon demo (single-server). Redis can be added later for multi-instance scaling.

---

## Research Foundation

| Paper                                                                                 | V2 Module                 | Key Contribution                                                                                                               |
| ------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023)               | Deep Thinker + Contrarian | BFS/DFS search over reasoning trees with state evaluation. V2 makes branches autonomous agents.                                |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | Verifier Agent            | Process supervision — verify each reasoning step independently. V2 runs verification continuously as agents produce reasoning. |

---

*This document is the single source of truth for the Opus NX V2 vision. All code samples use the correct, verified Opus 4.6 API pattern (adaptive thinking + effort). All V1 line references have been verified against the actual codebase. All technology choices include concrete rationale.*
