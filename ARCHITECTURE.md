# Opus Nx: Technical Architecture

**Version**: 2.0
**Last Updated**: February 8, 2026

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Responsibilities](#component-responsibilities)
3. [Database Schema](#database-schema)
4. [Data Flows](#data-flows)
5. [Technology Stack](#technology-stack)
6. [API Contracts](#api-contracts)
7. [Security](#security)
8. [Performance](#performance)

---

## System Overview

Opus Nx is a human + AI co-thinking platform. It transforms Claude Opus 4.6's extended thinking into persistent, steerable reasoning graphs. Every time the AI thinks, that reasoning becomes a navigable data structure that humans can search, steer, verify, and build upon.

```
+-----------------------------------------------------------------------------+
|                           PRESENTATION LAYER                                 |
|  +-----------------------------------------------------------------------+  |
|  |                     Next.js 16 Dashboard (App Router)                  |  |
|  |                                                                       |  |
|  |  +-------------+ +-------------+ +------------+ +------------------+  |  |
|  |  | ThinkingGraph| | ForkPanel  | | GoTPanel   | | VerificationPanel|  |  |
|  |  | (react-flow)| | (3 views)  | |            | |                  |  |  |
|  |  +------+------+ +------+-----+ +-----+------+ +--------+---------+  |  |
|  |         |               |              |                 |            |  |
|  |  +------+------+ +-----+------+ +-----+------+ +--------+---------+  |  |
|  |  | InsightsPanel| | MemoryPanel| |SessionList | | ThinkingStream   |  |  |
|  |  | (metacog)   | | (3-tier)   | |            | | (real-time SSE)  |  |  |
|  |  +-------------+ +------------+ +------------+ +------------------+  |  |
|  +-----------------------------------------------------------------------+  |
+------+----------+----------+----------+----------+----------+---------------+
       |          |          |          |          |          |
       v          v          v          v          v          v
+-----------------------------------------------------------------------------+
|                              API LAYER (21 routes)                           |
|  +-----------------------------------------------------------------------+  |
|  |                    Next.js API Routes (App Router)                     |  |
|  |                                                                       |  |
|  |  POST /api/thinking       POST /api/fork          POST /api/got       |  |
|  |  POST /api/thinking/stream POST /api/fork/steer   POST /api/verify    |  |
|  |  POST /api/think (alias)  POST /api/insights      POST /api/memory    |  |
|  |  GET  /api/sessions       GET  /api/insights      GET  /api/health    |  |
|  |  POST /api/reasoning/:id/checkpoint               POST /api/auth      |  |
|  +----------------------------------+------------------------------------+  |
+-------------------------------------|---------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                          CORE LAYER (@opus-nx/core)                          |
|                                                                              |
|  +----------------------------------------------------------------------+   |
|  |                          Orchestrator                                 |   |
|  |  * Dynamic effort routing (simple/standard/complex)                   |   |
|  |  * Token budget enforcement with warning/exhaust callbacks            |   |
|  |  * Compaction boundary nodes when context is summarized               |   |
|  |  * Session lifecycle management                                       |   |
|  |  * Knowledge context injection via MemoryManager                      |   |
|  +---+----------------+-----------------+----------------+-----------+---+   |
|      |                |                 |                |           |        |
|  +---v---+   +--------v--------+   +---v---+   +-------v-------+   |        |
|  |Thinking|   |   ThinkGraph    |   |Metacog|   |   ThinkFork   |   |        |
|  | Engine |<--+ Parse reasoning |<--| Engine|   | 4-style fork  |   |        |
|  |        |   | Extract decisions|   |       |   | Debate mode   |   |        |
|  | Opus   |   | Build graph     |   | 50k   |   | Steering      |   |        |
|  | 4.6    |   | Persist nodes   |   | budget |   | Convergence   |   |        |
|  | Stream |   | Link edges      |   | Biases |   | analysis      |   |        |
|  +---+----+   +--------+--------+   +---+---+   +------+--------+   |        |
|      |                 |                 |              |             |        |
|  +---v--------+   +----v---------+   +--v-----------+  |             |        |
|  | GoT Engine  |   | PRM Verifier |   | Memory       |  |             |        |
|  |             |   |              |   | Hierarchy    |  |             |        |
|  | BFS/DFS/    |   | Step-by-step |   | (MemGPT)    |  |             |        |
|  | best-first  |   | verification |   | 3 tiers:    |  |             |        |
|  | Aggregation |   | Geometric    |   |  main ctx   |  |             |        |
|  | Pruning     |   | mean scoring |   |  recall     |  |             |        |
|  +-------------+   +--------------+   |  archival   |  |             |        |
|                                       +------+------+  |             |        |
|                                              |          |             |        |
|  +-------------------------------------------v----------v-------------v---+   |
|  |                      Memory Manager                                    |   |
|  |  Voyage AI embeddings (voyage-3, 1024-dim), semantic search,           |   |
|  |  knowledge storage, context string building, auto-categorization       |   |
|  +------------------------------------+----------------------------------+   |
+---------------------------------------|--------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------+
|                          DATA LAYER (@opus-nx/db)                            |
|  +-----------------------------------------------------------------------+  |
|  |                         Query Functions                                |  |
|  |  +----------+ +----------+ +----------+ +----------+ +-----------+    |  |
|  |  | sessions | |knowledge | | thinking | |decisions | |metacog    |    |  |
|  |  |          | |          | |  nodes   | |          | | insights  |    |  |
|  |  +----------+ +----------+ +----------+ +----------+ +-----------+    |  |
|  +----------------------------------+------------------------------------+  |
+-------------------------------------|---------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                       PERSISTENCE LAYER                                      |
|                  Supabase (PostgreSQL + pgvector)                             |
|  +-----------------------------------------------------------------------+  |
|  |  +----------+ +---------------+ +----------------+ +----------------+ |  |
|  |  | sessions | | knowledge_    | | thinking_nodes | | metacognitive_ | |  |
|  |  |          | | entries       | | reasoning_edges| | insights       | |  |
|  |  |          | | knowledge_    | | decision_points| |                | |  |
|  |  |          | | relations     | | contradictions | |                | |  |
|  |  +----------+ +---------------+ +----------------+ +----------------+ |  |
|  |                                                                       |  |
|  |  Extensions: pgvector (HNSW indexes)                                  |  |
|  |  RPC: match_knowledge, get_related_knowledge, traverse_reasoning_graph|  |
|  |       get_session_reasoning_context, search_reasoning_nodes,          |  |
|  |       get_reasoning_chain                                             |  |
|  +-----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                         EXTERNAL SERVICES                                    |
|  +------------------+ +------------------+ +-----------------------------+  |
|  |  Claude Opus 4.6 | |   Voyage AI      | |        Tavily               |  |
|  |                  | |   Embeddings     | |      Web Search             |  |
|  |  * Extended      | |  * voyage-3      | |  * Research queries         |  |
|  |    thinking      | |  * 1024-dim      | |  * Fact verification        |  |
|  |  * 1M context    | |  * Semantic      | |                             |  |
|  |  * 128K output   | |    similarity    | |                             |  |
|  |  * Streaming     | |                  | |                             |  |
|  |  * Compaction    | |                  | |                             |  |
|  +------------------+ +------------------+ +-----------------------------+  |
+-----------------------------------------------------------------------------+
```

---

## Component Responsibilities

### Core Layer -- All 9 Modules

#### 1. ThinkingEngine (`packages/core/src/thinking-engine.ts` -- 352 lines)

The wrapper around the Claude Opus 4.6 API. This is the "brain" that all other modules delegate to when they need LLM reasoning.

**Capabilities:**

| Feature              | Details                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| Adaptive thinking    | Claude decides when and how much to think (`type: "adaptive"`)            |
| Effort levels        | `low` (5k tokens), `medium` (10k), `high` (20k), `max` (50k)              |
| Context compaction   | Infinite sessions via automatic summarization (`compact_20260112`)        |
| Streaming            | Three callbacks: `onThinkingStream`, `onTextStream`, `onCompactionStream` |
| Data residency       | US-only inference via `inference_geo` parameter                           |
| Token limits         | 128K output tokens, 1M context window                                     |
| Interleaved thinking | Thinking between tool calls (automatic with adaptive mode)                |

**API shape:**

```typescript
class ThinkingEngine {
  think(systemPrompt: string, messages: MessageParam[], tools?: Tool[]): Promise<ThinkingResult>
  setCallbacks(callbacks: { onThinkingStream?, onTextStream?, onCompactionStream? }): void
  updateConfig(config: Partial<OrchestratorConfig>): void
}
```

**Response parsing:** Every response is decomposed into typed blocks -- `ThinkingBlock`, `RedactedThinkingBlock`, `TextBlock`, `ToolUseBlock`, `CompactionBlock` -- with full token usage tracking (including cache creation/read tokens).

---

#### 2. ThinkGraph (`packages/core/src/think-graph.ts` -- 935 lines)

The core innovation of Opus Nx. Transforms raw extended thinking text into a persistent, queryable graph. Every thinking session becomes a node with structured metadata.

**Key responsibilities:**

- **Parse reasoning into steps**: Splits thinking text into paragraphs, classifies each as `analysis`, `hypothesis`, `evaluation`, `conclusion`, or `consideration`.
- **Extract decision points**: Uses 12 regex patterns to detect where the AI considered alternatives (e.g., "I could either...", "Decided to...", "Selected approach A over B"). Extracts chosen path, rejected alternatives, and confidence per decision.
- **Calculate confidence scores**: Aggregates high/medium/low confidence indicators from the text, factors in reasoning depth (text length), decision density, and applies deterministic jitter for visual variety. Never returns exactly 0.5. Range: 0.15--0.95.
- **Persist to database**: Creates `thinking_nodes` records with structured reasoning JSONB, links to parent nodes via `influences` edges. Uses Zod validation before DB insertion.
- **Graceful degradation**: If decision point or edge creation fails, the node is still persisted and a `degraded: true` flag is returned with specific `persistenceIssues`.
- **Graph queries**: `getRelatedReasoning()` (recursive traversal), `getReasoningChain()` (root to node), `searchReasoning()` (full-text search), `getSessionContext()` (for metacognition).

**Decision Point Extraction Algorithm:**

```
1. Split reasoning into sentences on [.!?]
2. Test each sentence against 12 DECISION_PATTERNS
3. For matches:
   a. Extract chosen path via 8 choice patterns (e.g., "I'll go with X", "Decided to Y")
   b. Extract alternatives from surrounding context (2 sentences before, 3 after)
   c. Find rejected alternatives via 6 rejection patterns (e.g., "ruled out X because Y")
   d. Estimate per-decision confidence from language indicators
4. Cap at 5 alternatives per decision point
5. Truncate descriptions to 200 chars, reasoning excerpts to 500 chars
```

---

#### 3. Orchestrator (`packages/core/src/orchestrator.ts` -- 773 lines)

The central brain that coordinates all other modules. Handles the complete lifecycle from user message to persisted reasoning graph.

**Key mechanisms:**

| Mechanism                   | How It Works                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic effort routing      | Classifies messages as `simple`/`standard`/`complex` via regex patterns and message length heuristics. Maps to effort levels: simple=low, standard=medium, complex=high/max. Configurable via `effortRouting` config. |
| Token budget enforcement    | Tracks cumulative output tokens per session. Fires `onBudgetWarning` at configurable threshold (%). Returns budget-exhausted response when limit reached. Also enforces a max compaction count.                       |
| Compaction boundary nodes   | When context compaction occurs, creates a special `compaction` type node in the ThinkGraph with a `supersedes` edge from the previous node. Preserves reasoning chain continuity across compaction events.            |
| Knowledge context injection | Uses MemoryManager to embed the user query, retrieve top-5 similar knowledge entries with related entries, and prepend context to the routing prompt.                                                                 |
| Task plan extraction        | Parses `create_task_plan` and `route_to_agent` tool calls from the LLM response to decompose complex requests into agent-assignable tasks.                                                                            |
| Thinking history cap        | Keeps last 50 thinking blocks in session memory to prevent unbounded growth.                                                                                                                                          |

**Complexity Classification Patterns:**

```
simple: greetings, "what is", "define", "explain briefly"
complex: "debug", "architect", "design", "compare and contrast",
         "research", "step by step", "refactor", "optimize"
standard: everything else (default), plus messages 50-500 chars
```

---

#### 4. MetacognitionEngine (`packages/core/src/metacognition.ts` -- 619 lines)

Self-reflection engine. Uses the full 50k thinking budget to analyze the AI's own reasoning patterns across a session.

**Pipeline:**

```
1. Gather: Fetch 10-20 recent thinking nodes from DB
           via get_session_reasoning_context RPC
2. Format: Build analysis prompt with each node's
           reasoning (capped at 5k chars), confidence,
           decision count, input query, timestamp
           Total context: up to 100k chars
3. Analyze: Execute ThinkingEngine with effort=max
            System prompt from configs/prompts/metacognition.md
            Uses record_insight tool for structured extraction
4. Parse:   Validate tool outputs with Zod schema
            Filter evidence to only valid (known) node IDs
            Track invalid refs as possible hallucinations
5. Persist: Store to metacognitive_insights table with
            session_id, thinking_nodes_analyzed UUID[],
            insight_type, insight text, evidence JSONB
```

**Insight types:** `bias_detection`, `pattern`, `improvement_hypothesis`

**Detectable biases:** confirmation, anchoring, recency, availability, overconfidence

**Focus areas:** `decision_quality`, `reasoning_patterns`, `confidence_calibration`, `alternative_exploration`, `bias_detection`

---

#### 5. ThinkForkEngine (`packages/core/src/thinkfork.ts` -- 1164 lines)

Concurrent multi-perspective reasoning with 4 cognitive styles. The largest module, implementing fork, debate, steering, and convergence analysis.

**4 Reasoning Styles:**

| Style        | Mindset                           | Prompt Source                               |
| ------------ | --------------------------------- | ------------------------------------------- |
| Conservative | Risk-averse, proven approaches    | `configs/prompts/thinkfork/conservative.md` |
| Aggressive   | Optimistic, innovative approaches | `configs/prompts/thinkfork/aggressive.md`   |
| Balanced     | Weighted trade-offs               | `configs/prompts/thinkfork/balanced.md`     |
| Contrarian   | Challenge conventional wisdom     | `configs/prompts/thinkfork/contrarian.md`   |

**Three operating modes:**

1. **Fork** (`fork()`): Runs N branches concurrently via `Promise.allSettled`. Each branch gets a dedicated ThinkingEngine with its style-specific system prompt. Uses `record_conclusion` tool for structured output. Comparison analysis via `record_comparison` tool identifies convergence and divergence points.

2. **Debate** (`debate()`): Multi-round adversarial reasoning. Step 1: standard fork for initial positions. Step 2: N rounds where each branch sees all others' positions, can challenge/concede/refine via `record_debate_response` tool. Step 3: check for consensus (all stable + all above 0.7 confidence).

3. **Steering** (`steer()`): Post-analysis human actions. Four actions:
   - `expand`: Deeper analysis of one branch (max effort)
   - `merge`: Synthesize 2+ branches into a unified approach
   - `challenge`: Challenge a branch's conclusion with a counter-argument
   - `refork`: Re-run all branches with new context

**Human guidance:** Optional `branchGuidance` array lets users provide per-style directions before forking. Guidance is prepended to the user message.

**Partial failure handling:** Uses `Promise.allSettled` so successful branches are returned even if others fail. Failed branches get `confidence: 0` and an error message.

---

#### 6. GoTEngine (`packages/core/src/got-engine.ts` -- 871 lines)

Graph of Thoughts reasoning framework. Goes beyond Tree of Thoughts by supporting arbitrary graph topologies with thought aggregation.

**Three search strategies:**

```
BFS (Breadth-First)                    DFS (Depth-First)

  [Root]                                 [Root]
  / | \                                    |
[A][B][C]  <- evaluate, keep top-k       [A] <- best
/ | \                                      |
...   <- next level                      [D] <- recurse
                                           |
                                         [G] <- backtrack
                                              if bad

Best-First (Priority Queue)

  Open set: sorted by score (descending)
  Always expand highest-scored thought
  O(log n) insertion via binary search
```

**Thought lifecycle:** `generated` -> `evaluated` -> `verified` or `rejected` or `aggregated`

**Core operations:**

| Operation   | Description                                                                   |
| ----------- | ----------------------------------------------------------------------------- |
| Generation  | Create k diverse thoughts from a parent using `record_thoughts` tool          |
| Evaluation  | Score each thought (0-1) using `evaluate_thought` tool. Failed evals get 0.0. |
| Aggregation | Merge 2+ thoughts into a stronger synthesis using `aggregate_thoughts` tool   |
| Pruning     | Thoughts below `pruneThreshold` (default 0.3) are rejected                    |

**Key GoT innovation:** Thought recycling -- partial solutions from different branches can be combined via aggregation, which is impossible in a tree structure.

**Engine reuse:** Creates ThinkingEngine instances once per `reason()` call and reuses them across all thought generation/evaluation calls within that session.

---

#### 7. PRMVerifier (`packages/core/src/prm-verifier.ts` -- 478 lines)

Process Reward Model for step-by-step reasoning verification. Based on "Let's Verify Step by Step" (Lightman et al., 2023).

**Verification pipeline:**

```
For each step in the reasoning chain:
  1. Build prompt with all preceding steps as context
  2. Ask Claude to evaluate via verify_step tool
  3. Record verdict: correct | incorrect | neutral | uncertain
  4. Track issues: logical_error, factual_error, missing_context,
     unsupported_claim, circular_reasoning, non_sequitur,
     overgeneralization, false_dichotomy
  5. Severity: critical | major | minor
  6. Optional: suggest corrections
```

**Chain scoring (geometric mean):**

```
score = 1.0
for each step:
  correct:   score *= confidence
  incorrect: score *= (1 - confidence) * 0.3
  neutral:   score *= 0.9
  uncertain: score *= 0.7

overallScore = score ^ (1 / stepCount)   // geometric mean
isValid = overallScore >= correctnessThreshold (default 0.7)
```

**Pattern detection across steps:**

| Pattern                       | Trigger                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `declining_confidence`        | Confidence monotonically decreases with spread > 0.2           |
| `recurring_{issue_type}`      | Same issue type appears in 2+ steps                            |
| `overconfidence_before_error` | High-confidence correct step immediately followed by incorrect |

---

#### 8. MemoryHierarchy (`packages/core/src/memory-hierarchy.ts` -- 633 lines)

MemGPT-inspired 3-tier memory system with explicit memory management operations.

**Three tiers:**

```
+------------------------------------------------------------------+
|                    MAIN CONTEXT (L1 / Registers)                  |
|  Always visible to the LLM during inference.                     |
|                                                                  |
|  +-------------------+  +-------------------+  +---------------+ |
|  | System Prompt     |  | Core Memory       |  | Working Memory| |
|  | (immutable base)  |  | humanFacts: []    |  | [{id, content,| |
|  |                   |  | agentFacts: []    |  |   importance}]| |
|  +-------------------+  +-------------------+  +---------------+ |
|  Token budget: configurable (default 100k)                       |
+------------------------------------------------------------------+
         |  auto-evict (page out)            ^ promote (page in)
         v                                   |
+------------------------------------------------------------------+
|                  RECALL STORAGE (RAM)                             |
|  Recent session history. FIFO with importance-based archival.    |
|  Window size: 100 entries (configurable).                        |
|  Search: keyword matching, timestamp-sorted.                     |
+------------------------------------------------------------------+
         |  overflow (if importance > eviction threshold)
         v
+------------------------------------------------------------------+
|                ARCHIVAL STORAGE (Disk)                            |
|  Long-term knowledge. Persisted across sessions.                 |
|  Search: keyword matching (production: vector similarity).       |
|  Scored by: term match + importance + recency penalty.           |
+------------------------------------------------------------------+
```

**Memory operations (LLM function call handlers):**

| Operation             | Description                            |
| --------------------- | -------------------------------------- |
| `archival_insert`     | Store content with tags and importance |
| `archival_search`     | Keyword search over long-term storage  |
| `recall_search`       | Keyword search over recent history     |
| `core_memory_append`  | Add fact to human or agent section     |
| `core_memory_replace` | Update existing fact in core memory    |
| `evict_to_archival`   | Page out entries from working memory   |
| `promote_to_working`  | Page in entries from archival storage  |

**Auto-eviction:** When main context token count exceeds capacity, sorts working memory by importance (ascending) and evicts least-important entries until at 80% capacity.

---

#### 9. MemoryManager (`packages/core/src/memory-manager.ts` -- 253 lines)

Handles knowledge storage and semantic search using Voyage AI embeddings. The persistence layer for the knowledge base.

**Capabilities:**

| Method                            | Description                                   |
| --------------------------------- | --------------------------------------------- |
| `generateEmbedding(text)`         | Call Voyage AI API (voyage-3, 1024-dim)       |
| `store(input, options)`           | Create knowledge entry with auto-embedding    |
| `search(query, options)`          | Embed query, search via `match_knowledge` RPC |
| `getContext(query, options)`      | Search + fetch related entries in parallel    |
| `buildContextString(query)`       | Format context for prompt injection           |
| `categorize(content, categories)` | Auto-categorize via Claude Haiku 4.5          |

**Context building:** Retrieves top-N similar entries, fetches related knowledge for each via `get_related_knowledge` RPC (parallel), formats as markdown with similarity scores and category labels.

---

### Presentation Layer

#### UI Components (37 components in `apps/web/src/components/`)

| Directory   | Components                                                                                       | Purpose                                                            |
| ----------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `graph/`    | ThinkingGraph, ThinkingNode, StreamingNode, EdgeTypes, GraphControls, GraphLegend                | Interactive reasoning graph visualization via @xyflow/react        |
| `fork/`     | ForkPanel, BranchCard, Convergence                                                               | Side-by-side branch comparison with convergence/divergence display |
| `got/`      | GoTPanel                                                                                         | Graph of Thoughts reasoning interface                              |
| `verify/`   | VerificationPanel                                                                                | Step-by-step verification display with verdicts and patterns       |
| `insights/` | InsightsPanel, InsightCard                                                                       | Metacognitive insights with evidence links                         |
| `memory/`   | MemoryPanel                                                                                      | Hierarchical memory browser (3 tiers)                              |
| `thinking/` | ThinkingInput, ThinkingStream, TokenCounter                                                      | Real-time SSE stream display with token usage                      |
| `sessions/` | SessionList, SessionCard, SessionStats                                                           | Session management and statistics                                  |
| `layout/`   | Dashboard, Header, LeftPanel, RightPanel, BottomPanel, MobileNav                                 | Application layout with collapsible sidebars                       |
| `tour/`     | DemoTour                                                                                         | Guided tour for new users                                          |
| `ui/`       | badge, button, card, dropdown-menu, input, neural-submit-button, skeleton, sonner, tabs, tooltip | shadcn/ui primitives                                               |

---

### Data Layer

#### Query Functions (`packages/db/src/`)

| Module              | Key Functions                                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`         | Supabase client initialization                                                                                                                                                                                                                                         |
| `sessions.ts`       | `createSession`, `getSession`, `updateSessionPlan`, `listSessions`, `deleteSession`                                                                                                                                                                                    |
| `knowledge.ts`      | `createKnowledgeEntry`, `searchKnowledge`, `getRelatedKnowledge`                                                                                                                                                                                                       |
| `thinking-nodes.ts` | `createThinkingNode`, `getThinkingNode`, `getSessionThinkingNodes`, `getLatestThinkingNode`, `traverseReasoningGraph`, `getReasoningChain`, `searchReasoningNodes`, `getSessionReasoningContext`, `createReasoningEdge`, `createDecisionPoint`, `createDecisionPoints` |
| `decisions.ts`      | `logDecision`                                                                                                                                                                                                                                                          |
| `agent-runs.ts`     | `createAgentRun`, `updateAgentRun`                                                                                                                                                                                                                                     |
| `metacognition.ts`  | `createMetacognitiveInsight`, `getSessionInsights`                                                                                                                                                                                                                     |

---

## Database Schema

### Migrations

Three migrations define the complete schema:

| Migration                | Tables Created                                                                                     | Key Additions                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `001_initial_schema.sql` | `knowledge_entries`, `knowledge_relations`, `sessions`, `decision_log`, `agent_runs`               | pgvector HNSW index, `match_knowledge` RPC, `get_related_knowledge` RPC                                                      |
| `002_thinking_graph.sql` | `thinking_nodes`, `reasoning_edges`, `decision_points`, `contradictions`, `metacognitive_insights` | `traverse_reasoning_graph` RPC, `get_session_reasoning_context` RPC, `search_reasoning_nodes` RPC, `get_reasoning_chain` RPC |
| `003_node_type.sql`      | --                                                                                                 | Adds `node_type` column to `thinking_nodes`: `thinking`, `compaction`, `fork_branch`, `human_annotation`                     |

### Entity Relationship Diagram

```
+-------------------+          +------------------------+
|     sessions      |--------->|    thinking_nodes      |
|                   |  1 : N   |                        |
| id            (PK)|          | id                 (PK)|
| user_id       (FK)|          | session_id         (FK)|------+
| status            |          | parent_node_id     (FK)|<-----+ self-ref
| current_plan      |          | reasoning              |
| knowledge_context |          | structured_reasoning   |
| created_at        |          | confidence_score       |
| updated_at        |          | thinking_budget        |
+--------+----------+          | signature              |
         |                     | input_query            |
         |                     | token_usage            |
         |                     | node_type              |
         |                     | created_at             |
         |                     +---+--------+-----------+
         |                         |        |
         |                    1:N  |        |  N:N (via edges)
         |                         v        v
         |              +--------------+  +-----------------------+
         |              |decision_points|  |   reasoning_edges    |
         |              |              |  |                       |
         |              | id       (PK)|  | id                (PK)|
         |              | thinking_    |  | source_id    (FK->TN) |
         |              |  node_id (FK)|  | target_id    (FK->TN) |
         |              | step_number  |  | edge_type             |
         |              | description  |  |  CHECK IN:            |
         |              | chosen_path  |  |  'influences'         |
         |              | alternatives |  |  'contradicts'        |
         |              |       (JSONB)|  |  'supports'           |
         |              | confidence   |  |  'supersedes'         |
         |              | created_at   |  |  'refines'            |
         |              |              |  | weight (0.0-1.0)      |
         |              +--------------+  | metadata (JSONB)      |
         |                                | UNIQUE(src,tgt,type)  |
         |                                +-----------------------+
         |
    1:N  |
         v
+-------------------+       +-----------------------+
| knowledge_entries |       |  contradictions       |
|                   |       |                       |
| id            (PK)|       | id                (PK)|
| title             |       | knowledge_a_id   (FK)|----> knowledge_entries
| content           |       | knowledge_b_id   (FK)|----> knowledge_entries
| embedding         |       | thinking_node_id (FK)|----> thinking_nodes
|   vector(1024)    |       | contradiction_type   |
| category          |       |  CHECK IN: factual,  |
| subcategory       |       |  temporal, perspective|
| source            |       |  scope               |
| source_url        |       | resolution_summary   |
| metadata (JSONB)  |       | resolved_in_favor    |
| created_by    (FK)|       |  CHECK IN: a, b,     |
| created_at        |       |  synthesized,        |
| updated_at        |       |  unresolved          |
+--------+----------+       | created_at           |
         |                  +-----------------------+
    N:N  |                  NOTE: The contradictions
         v                  table exists in the DB
+-------------------+       schema but there is NO
| knowledge_        |       contradiction-resolver
| relations         |       module in the codebase.
|                   |
| id            (PK)|       +-----------------------+
| source_id     (FK)|       | metacognitive_        |
| target_id     (FK)|       | insights              |
| relation_type     |       |                       |
| weight            |       | id                (PK)|
| metadata (JSONB)  |       | session_id       (FK)|----> sessions
| UNIQUE(src,tgt,   |       | thinking_nodes_      |
|   relation_type)  |       |   analyzed (UUID[])  |
+-------------------+       | insight_type         |
                            |  CHECK IN:           |
+-------------------+       |  bias_detection,     |
| decision_log      |       |  pattern,            |
|                   |       |  improvement_        |
| id            (PK)|       |  hypothesis          |
| session_id    (FK)|       | insight              |
| task_plan_id      |       | evidence (JSONB)     |
| decision_type     |       | confidence (0.0-1.0) |
| input_context     |       | created_at           |
| thinking_summary  |       +-----------------------+
| thinking_signature|
| decision_output   |       +-------------------+
| tokens_used (JSON)|       | agent_runs        |
| latency_ms        |       |                   |
| created_at        |       | id            (PK)|
+-------------------+       | session_id    (FK)|
                            | task_id           |
                            | agent_name        |
                            | model             |
                            | status            |
                            | input_context     |
                            | output_result     |
                            | error_message     |
                            | tokens_used (JSON)|
                            | started_at        |
                            | completed_at      |
                            +-------------------+
```

### RPC Functions

| Function                        | Parameters                                                                                         | Returns                                                              | Purpose                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| `match_knowledge`               | `query_embedding vector(1024)`, `match_threshold float`, `match_count int`, `filter_category text` | `{id, title, content, category, similarity}`                         | Cosine similarity search over knowledge entries  |
| `get_related_knowledge`         | `entry_id uuid`, `depth int`                                                                       | `{id, title, relation_type, relation_weight, hop_distance}`          | Recursive graph traversal of knowledge relations |
| `traverse_reasoning_graph`      | `start_node_id uuid`, `max_depth int`                                                              | `{node_id, reasoning, edge_type, hop_distance}`                      | Recursive traversal of reasoning edges           |
| `get_session_reasoning_context` | `p_session_id uuid`, `node_limit int`                                                              | `{node_id, reasoning, confidence_score, decision_count, created_at}` | Recent reasoning nodes with decision counts      |
| `search_reasoning_nodes`        | `query text`, `session_id uuid`, `limit int`                                                       | `{node_id, reasoning, confidence_score, rank}`                       | Full-text search over thinking_nodes.reasoning   |
| `get_reasoning_chain`           | `target_node_id uuid`                                                                              | `{node_id, reasoning, confidence_score, chain_position}`             | Full chain from root to target node              |

---

## Data Flows

### Flow 1: Standard Thinking Request

```
User Query
    |
    v
+---------------------------------------------------------------+
|                  Orchestrator.process()                         |
|                                                                |
|  1. Check token budget (not exhausted?)                        |
|  2. Check compaction limit (not reached?)                      |
|  3. Classify complexity via regex patterns + length heuristic  |
|  4. Map complexity to effort level (dynamic routing)           |
|  5. Temporarily override ThinkingEngine effort                 |
|  6. Retrieve knowledge context                                 |
|     +---> MemoryManager.buildContextString()                   |
|           +---> Voyage AI: embed query                         |
|           +---> Supabase: match_knowledge RPC                  |
|           +---> Supabase: get_related_knowledge RPC (parallel) |
|  7. Build routing prompt with agent list + knowledge context   |
+----------------------------+----------------------------------+
                             |
                             v
+---------------------------------------------------------------+
|                  ThinkingEngine.think()                         |
|                                                                |
|  1. Build request params (adaptive thinking, effort, tools)    |
|  2. Configure compaction if enabled                            |
|  3. Call Claude Opus 4.6 API (streaming or non-streaming)      |
|  4. Stream thinking deltas to callback ----------------------> SSE to UI
|  5. Await final response                                       |
|  6. Parse into typed blocks (thinking, text, tool_use, etc.)   |
|  7. Extract token usage (input, output, cache tokens)          |
+----------------------------+----------------------------------+
                             |
                             v
+---------------------------------------------------------------+
|                ThinkGraph.persistThinkingNode()                 |
|                                                                |
|  1. Parse thinking text into structured reasoning              |
|     +---> Split into paragraphs, classify step types           |
|     +---> Extract decision points via 12 regex patterns        |
|     +---> Calculate confidence score (0.15-0.95)               |
|  2. Validate with Zod before DB insertion                      |
|  3. CREATE thinking_nodes record                               |
|  4. CREATE decision_points in batch                            |
|  5. CREATE 'influences' edge to parent node (if exists)        |
|  6. Return { node, decisionPoints, degraded, issues }          |
+----------------------------+----------------------------------+
                             |
                             v
+---------------------------------------------------------------+
|                    Handle Compaction (if occurred)              |
|                                                                |
|  If result.compacted:                                          |
|    1. Increment session compaction count                       |
|    2. CREATE compaction boundary node (node_type='compaction') |
|    3. CREATE 'supersedes' edge from last node to boundary      |
|    4. Log compaction metadata                                  |
+----------------------------+----------------------------------+
                             |
                             v
+---------------------------------------------------------------+
|                      Return OrchestratorResult                 |
|                                                                |
|  { response, plan?, thinkingBlocks, thinkingNode?,             |
|    graphPersistence, compacted, compactionSummary?,             |
|    effectiveEffort, taskComplexity, budgetStatus? }             |
+---------------------------------------------------------------+
```

### Flow 2: Metacognitive Self-Reflection

```
Trigger: POST /api/insights (manual) or auto after N sessions
    |
    v
+---------------------------------------------------------------+
|           MetacognitionEngine.analyze()                        |
|                                                                |
|  1. Gather reasoning context from DB                           |
|     +---> getSessionReasoningContext(sessionId, limit=15)      |
|     +---> Returns: nodeId, reasoning, confidence, decisions    |
|                                                                |
|  2. Format context (up to 100k chars)                          |
|     +---> For each node: UUID, query, confidence %,            |
|           decision count, timestamp, reasoning (max 5k chars)  |
|                                                                |
|  3. Build analysis prompt                                      |
|     +---> Inject formatted context into system prompt          |
|     +---> Add focus area instructions                          |
|                                                                |
|  4. Execute thinking with MAX effort (50k tokens)              |
|     +---> model: claude-opus-4-6                               |
|     +---> thinking: { type: "adaptive" }                       |
|     +---> output_config: { effort: "max" }                     |
|     +---> Tool: record_insight                                 |
+----------------------------+----------------------------------+
                             |
                             v
+---------------------------------------------------------------+
|           Parse and Persist Insights                           |
|                                                                |
|  For each record_insight tool call:                            |
|    1. Validate input with Zod schema                           |
|    2. Filter evidence to known node IDs (track hallucinations) |
|    3. Clamp confidence to [0, 1]                               |
|    4. INSERT INTO metacognitive_insights                       |
|    5. Fire onInsightExtracted callback                         |
|                                                                |
|  Track separately:                                             |
|    - persisted: successfully saved insights                    |
|    - failed: DB persistence errors                             |
|    - validationErrors: schema mismatches                       |
|    - invalidNodeRefs: evidence referencing unknown nodes        |
+----------------------------+----------------------------------+
                             |
                             v
              Return MetacognitionResult
              { insights[], nodesAnalyzed, summary?, errors? }
```

### Flow 3: ThinkFork with Debate and Steering

```
POST /api/fork { query, styles?, effort?, branchGuidance? }
    |
    v
+---------------------------------------------------------------+
|              ThinkForkEngine.fork()                             |
|                                                                |
|  1. Validate inputs with Zod                                   |
|  2. Load style prompts from configs/prompts/thinkfork/         |
|  3. Apply per-style human guidance (if provided)               |
|  4. Execute all branches concurrently:                         |
|                                                                |
|     Promise.allSettled([                                        |
|       executeBranch("conservative", query, effort, guidance),   |
|       executeBranch("aggressive",   query, effort, guidance),   |
|       executeBranch("balanced",     query, effort, guidance),   |
|       executeBranch("contrarian",   query, effort, guidance),   |
|     ])                                                         |
|                                                                |
|     Each branch:                                               |
|       a. Create dedicated ThinkingEngine instance              |
|       b. Think with style-specific system prompt               |
|       c. Extract conclusion via record_conclusion tool         |
|       d. Return { style, conclusion, confidence, keyInsights,  |
|              risks?, opportunities?, assumptions? }             |
|       e. On failure: return degraded result (confidence=0)     |
+----------------------------+----------------------------------+
                             |
                             v
+---------------------------------------------------------------+
|           Convergence/Divergence Analysis                      |
|                                                                |
|  If 2+ branches succeeded:                                     |
|    1. Build comparison prompt with all branch summaries         |
|    2. Execute analysis with record_comparison tool              |
|    3. Extract:                                                  |
|       - convergencePoints: [{topic, agreementLevel, styles}]   |
|       - divergencePoints: [{topic, positions, significance}]   |
|       - metaInsight: overall observation                       |
|       - recommendedApproach: {style, rationale, confidence}    |
+----------------------------+----------------------------------+
                             |
                             v
              Return ThinkForkResult

=========== DEBATE MODE =============

POST /api/fork { query, styles, debate: true, rounds: 3 }
    |
    v
+---------------------------------------------------------------+
|              ThinkForkEngine.debate()                           |
|                                                                |
|  Step 1: Run standard fork for initial positions               |
|                                                                |
|  Step 2: For each round (1..N):                                |
|    For each branch (concurrently):                             |
|      a. Build debate prompt showing all other branches' latest |
|         positions, confidences, and key insights               |
|      b. Execute with record_debate_response tool               |
|      c. Extract: response, updated confidence,                 |
|         positionChanged, keyCounterpoints, concessions         |
|      d. Update branch's current position                       |
|                                                                |
|  Step 3: Check for consensus:                                  |
|    - All stable in last round (no position changes)?           |
|    - All above 0.7 confidence?                                 |
|    - If yes: synthesize consensus                              |
+----------------------------+----------------------------------+
                             |
                             v
              Return DebateResult
              { initialFork, rounds[], finalPositions[],
                consensus?, consensusConfidence?,
                totalRounds, totalTokensUsed }

=========== STEERING =============

POST /api/fork/steer { originalResult, action }
    |
    +---> action: "expand"   --> Deep analysis of one branch (max effort)
    +---> action: "merge"    --> Synthesize 2+ branches
    +---> action: "challenge" --> Challenge with counter-argument
    +---> action: "refork"   --> Re-run all with new context
```

### Flow 4: Graph of Thoughts Reasoning

```
POST /api/got { problem, strategy, maxDepth, branchingFactor, ... }
    |
    v
+---------------------------------------------------------------+
|              GoTEngine.reason()                                 |
|                                                                |
|  1. Create root thought from problem (score=1.0, verified)     |
|  2. Create reusable ThinkingEngine instances                   |
|  3. Execute search strategy:                                   |
+---------------------------------------------------------------+
    |
    |  strategy == "bfs"
    v
+---------------------------------------------------------------+
|  BFS: Level-by-level exploration                               |
|                                                                |
|  for depth = 1..maxDepth:                                      |
|    for each frontier thought:                                  |
|      a. Generate k children (record_thoughts tool)             |
|      b. Evaluate each child (evaluate_thought tool)            |
|      c. Prune: score < pruneThreshold => rejected              |
|    Keep top-k thoughts in frontier                             |
|    If enableAggregation and 2+ thoughts:                       |
|      Try aggregation (aggregate_thoughts tool)                 |
+---------------------------------------------------------------+
    |
    |  strategy == "dfs"
    v
+---------------------------------------------------------------+
|  DFS: Depth-first with backtracking                            |
|                                                                |
|  Recurse into best child only at each level.                   |
|  Backtrack when no viable children (all pruned).               |
+---------------------------------------------------------------+
    |
    |  strategy == "best_first"
    v
+---------------------------------------------------------------+
|  Best-First: Priority queue exploration                        |
|                                                                |
|  Maintain sorted open set (descending by score).               |
|  Always expand highest-scored thought.                         |
|  O(log n) insertion via binary search.                         |
|  Try aggregation when 3+ high-score thoughts available.        |
+---------------------------------------------------------------+
    |
    v
+---------------------------------------------------------------+
|  Select best answer                                            |
|                                                                |
|  1. Filter: state == "verified" && score != null               |
|  2. Sort by score descending                                   |
|  3. Return top thought as answer                               |
|  4. Build reasoning summary with stats                         |
+---------------------------------------------------------------+
    |
    v
Return GoTResult
{ answer, confidence, graphState, reasoningSummary, stats }
```

### Flow 5: PRM Step-by-Step Verification

```
POST /api/verify { steps[], thinkingNodeId?, originalQuery?, effort }
    |
    v
+---------------------------------------------------------------+
|              PRMVerifier.verifyChain()                          |
|                                                                |
|  For i = 0..steps.length-1:                                    |
|    1. Build verification prompt:                               |
|       - All preceding steps as context                         |
|       - Original query (if provided)                           |
|       - Step content and type                                  |
|    2. Create fresh ThinkingEngine (per-step isolation)          |
|    3. Execute with verify_step tool                            |
|    4. Parse verdict + confidence + issues                      |
|    5. Track first error position                               |
|                                                                |
|  Compute chain score:                                          |
|    score = product of per-step factors                          |
|    overallScore = geometricMean(score, stepCount)              |
|                                                                |
|  Detect patterns:                                              |
|    - declining_confidence                                      |
|    - recurring_{issue_type}                                    |
|    - overconfidence_before_error                               |
|                                                                |
|  Build human-readable summary                                  |
+---------------------------------------------------------------+
    |
    v
Return ChainVerification
{ steps[], overallScore, isValid, firstErrorAt,
  summary, patterns[], metadata }
```

### Flow 6: Memory Hierarchy Operations

```
POST /api/memory { operation, sessionId, ... }
    |
    v
+---------------------------------------------------------------+
|  Get or create MemoryHierarchy instance for session            |
|  (LRU cache of up to 100 instances per serverless function)    |
+---------------------------------------------------------------+
    |
    +---> operation: "archival_insert"
    |       Store content with tags/importance
    |       in archival storage
    |
    +---> operation: "archival_search"
    |       Keyword search with term scoring
    |       + importance boost + recency penalty
    |
    +---> operation: "recall_search"
    |       Keyword search over recent history
    |       (timestamp-sorted)
    |
    +---> operation: "core_memory_append"
    |       Add fact to human or agent section
    |       of main context
    |
    +---> operation: "stats"
            Return memory utilization stats

Auto-eviction trigger:
  When mainContext.tokenCount > maxTokens:
    1. Sort working memory by importance (ascending)
    2. Evict least-important entries until at 80% capacity
    3. Evicted entries move to archival storage
    4. Fire onEviction callback
```

### Flow 7: Human-in-the-Loop Checkpoint

```
POST /api/reasoning/:id/checkpoint { verdict, correction? }
    |
    v
+---------------------------------------------------------------+
|  1. Validate node ID (UUID format check)                       |
|  2. Get target thinking node from DB                           |
|  3. Create human_annotation node:                              |
|     - parent: target node                                      |
|     - reasoning: "[CHECKPOINT: VERIFIED/QUESTIONABLE/DISAGREE]"|
|     - node_type: "human_annotation"                            |
|     - confidence: 1.0 (verified), 0.5 (questionable), 0.0     |
|  4. Create reasoning edge:                                     |
|     - verified  => "supports" edge                             |
|     - questionable => "refines" edge                           |
|     - disagree  => "contradicts" edge                          |
+---------------------------------------------------------------+
    |
    | verdict == "disagree" && correction provided?
    v
+---------------------------------------------------------------+
|  Generate Alternative Branch                                   |
|                                                                |
|  1. Get reasoning chain (last 3 nodes) for context             |
|  2. Build re-reasoning prompt with:                            |
|     - Original query                                           |
|     - Chain context                                            |
|     - Flagged reasoning step                                   |
|     - Operator correction                                      |
|  3. Execute with medium effort (balance cost/quality)          |
|  4. Persist new node with parent = target node                 |
|  5. Create "refines" edge from new node to target              |
|  6. Calculate confidence from thinking depth                   |
+---------------------------------------------------------------+
    |
    v
Return { annotation: { id, verdict, correction },
         alternativeBranch?: { nodeId, reasoning, confidence } }
```

---

## Technology Stack

### Core Technologies

| Layer           | Technology | Version | Rationale                                      |
| --------------- | ---------- | ------- | ---------------------------------------------- |
| Runtime         | Node.js    | 22+     | Native TypeScript, async/await, Web Crypto API |
| Language        | TypeScript | 5.7+    | Strict mode, ESM with `.js` extensions         |
| Monorepo        | Turborepo  | 2.3+    | Build caching, task pipelines                  |
| Package Manager | pnpm       | 9.15    | Fast, disk efficient, workspace support        |
| Testing         | Vitest     | 4.0+    | Fast, ESM-native, compatible with TypeScript   |

### AI / ML

| Component           | Technology       | Details                                                                                            |
| ------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| LLM                 | Claude Opus 4.6  | Extended thinking up to 50k tokens, 1M context, 128K output, adaptive thinking, context compaction |
| Embeddings          | Voyage AI        | voyage-3 model, 1024 dimensions                                                                    |
| Agent Framework     | LangChain        | `@langchain/anthropic`, `@langchain/core`                                                          |
| Agent Orchestration | LangGraph        | `@langchain/langgraph`                                                                             |
| Categorization      | Claude Haiku 4.5 | Fast, cheap auto-categorization of knowledge entries                                               |

### Database

| Component     | Technology            | Details                                                                    |
| ------------- | --------------------- | -------------------------------------------------------------------------- |
| Primary DB    | PostgreSQL            | Via Supabase managed hosting                                               |
| Vector Search | pgvector              | HNSW indexes with `vector_cosine_ops` (m=16, ef_construction=64)           |
| Client        | @supabase/supabase-js | TypeScript client with RPC support                                         |
| Migrations    | SQL files             | Canonical in `supabase/migrations/`, mirrored to `packages/db/migrations/` |

### Frontend

| Component           | Technology    | Details                                       |
| ------------------- | ------------- | --------------------------------------------- |
| Framework           | Next.js       | 16+ with App Router, Turbopack                |
| React               | React         | 19+ (Server Components by default)            |
| Styling             | Tailwind CSS  | 4.0+                                          |
| Components          | shadcn/ui     | Radix UI primitives                           |
| Graph Visualization | @xyflow/react | Interactive node graph (react-flow)           |
| Validation          | Zod           | Used in all API routes for request validation |

### Agents Configuration

5 agents defined in `configs/agents.yaml`, all using `claude-opus-4-6`:

| Agent         | Description                             | Prompt Source                      |
| ------------- | --------------------------------------- | ---------------------------------- |
| research      | Web research and fact-finding           | `configs/prompts/research.md`      |
| code          | Code generation and analysis            | `configs/prompts/code.md`          |
| knowledge     | Knowledge management and categorization | `configs/prompts/knowledge.md`     |
| planning      | Strategic planning and decomposition    | `configs/prompts/planning.md`      |
| communication | Clear communication and synthesis       | `configs/prompts/communication.md` |

---

## API Contracts

### POST /api/thinking

Execute a non-streaming thinking request with graph persistence.

**Request:**

```typescript
{
  query: string;           // Required, non-empty
  sessionId?: string;      // UUID; auto-created if omitted
  effort?: "low" | "medium" | "high" | "max";  // Default: "high"
}
```

**Response (200):**

```typescript
{
  success: true;
  data: {
    sessionId: string;
    nodeId: string;          // Persisted ThinkGraph node ID
    thinking: string;        // Combined thinking block text
    response: string;        // Combined text block output
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      thinkingTokens: number;
    };
    degraded: boolean;       // True if graph persistence had issues
    degradation?: {
      persistenceIssues: Array<{
        stage: "node" | "decision_point" | "reasoning_edge";
        message: string;
      }>;
    };
  };
}
```

### POST /api/thinking/stream

Stream extended thinking in real-time via Server-Sent Events.

**Request:**

```typescript
{
  query: string;
  sessionId?: string;
  effort?: "low" | "medium" | "high" | "max";
  compactionEnabled?: boolean;  // Default: false
}
```

**SSE Events:**

```typescript
// Thinking delta (real-time thinking chunks)
{ type: "thinking", chunk: string, tokenCount: number }

// Compaction event (when context is summarized)
{ type: "compaction", summary: string }

// Warning (non-fatal issue)
{ type: "warning", code: string, message: string, recoverable: true }

// Completion
{ type: "done", nodeId: string, totalTokens: number,
  compacted: boolean, degraded: boolean,
  degradation: { persistenceIssues, parentLinkStatus, compactionPersistStatus },
  warnings: string[], correlationId: string }

// Error
{ type: "error", code: string, message: string, recoverable: boolean }
```

### POST /api/fork

Run ThinkFork multi-perspective analysis.

**Request:**

```typescript
{
  query: string;
  sessionId?: string;
  styles?: ("conservative" | "aggressive" | "balanced" | "contrarian")[];
  effort?: "low" | "medium" | "high" | "max";  // Default: "high"
  branchGuidance?: Array<{
    style: ForkStyle;
    guidance: string;  // Max 2000 chars
  }>;
}
```

**Response (200):**

```typescript
{
  success: true;
  data: {
    branches: Array<{
      style: string;
      conclusion: string;
      confidence: number;
      keyInsights: string[];
      risks?: string[];
      opportunities?: string[];
      assumptions?: string[];
      outputTokensUsed: number;
      durationMs: number;
      error?: string;
    }>;
    convergencePoints: Array<{
      topic: string;
      agreementLevel: "full" | "partial" | "none";
      styles: string[];
      summary: string;
    }>;
    divergencePoints: Array<{
      topic: string;
      positions: Array<{ style: string; position: string; confidence: number }>;
      significance: "high" | "medium" | "low";
      recommendation?: string;
    }>;
    metaInsight: string;
    recommendedApproach?: { style: string; rationale: string; confidence: number };
    appliedGuidance?: Array<{ style: string; guidance: string }>;
  };
}
```

### POST /api/fork/steer

Steer a fork analysis with human feedback.

**Request:**

```typescript
// One of four action types:
{ action: "expand",    style: ForkStyle, direction?: string }
{ action: "merge",     styles: ForkStyle[], focusArea?: string }
{ action: "challenge", style: ForkStyle, challenge: string }
{ action: "refork",    newContext: string }
```

### POST /api/got

Run Graph of Thoughts reasoning.

**Request:**

```typescript
{
  problem: string;
  strategy?: "bfs" | "dfs" | "best_first";  // Default: "bfs"
  maxDepth?: number;          // 1-20, default: 5
  branchingFactor?: number;   // 1-10, default: 3
  maxThoughts?: number;       // 1-100, default: 50
  enableAggregation?: boolean; // Default: true
  effort?: "low" | "medium" | "high" | "max";  // Default: "high"
}
```

**Response (200):**

```typescript
{
  success: true;
  data: {
    answer: string;
    confidence: number;
    reasoningSummary: string;
    stats: {
      totalThoughts: number;
      thoughtsExplored: number;
      thoughtsPruned: number;
      aggregationsMade: number;
      maxDepthReached: number;
      totalTokens: number;
      totalDurationMs: number;
    };
    graphState: {
      thoughtCount: number;
      edgeCount: number;
      bestThoughts: string[];  // Top 3 thought IDs
    };
  };
}
```

### POST /api/verify

Verify a reasoning chain step by step using PRM.

**Request:**

```typescript
{
  steps: Array<{
    stepNumber: number;
    content: string;
    type?: "analysis" | "hypothesis" | "evaluation" | "conclusion" | "consideration";
  }>;  // 1-50 steps
  thinkingNodeId?: string;     // UUID of the source node
  originalQuery?: string;      // Original question for context
  effort?: "low" | "medium" | "high" | "max";  // Default: "high"
  correctnessThreshold?: number;  // 0-1, default: 0.7
}
```

**Response (200):**

```typescript
{
  success: true;
  data: {
    overallScore: number;      // Geometric mean (0-1)
    isValid: boolean;          // score >= threshold
    firstErrorAt: number;      // -1 if no errors
    summary: string;           // Human-readable summary
    steps: Array<{
      stepIndex: number;
      verdict: "correct" | "incorrect" | "neutral" | "uncertain";
      confidence: number;
      explanation: string;
      issues: Array<{
        type: string;          // e.g., "logical_error", "factual_error"
        description: string;
        severity: "critical" | "major" | "minor";
      }>;
      suggestedCorrection?: string;
    }>;
    patterns: Array<{
      name: string;
      description: string;
      affectedSteps: number[];
    }>;
    metadata: {
      verificationModel: string;
      durationMs: number;
      verifiedAt: string;
    };
  };
}
```

### POST /api/reasoning/:id/checkpoint

Human-in-the-loop checkpoint for reasoning nodes.

**Request:**

```typescript
{
  verdict: "verified" | "questionable" | "disagree";
  correction?: string;  // Max 5000 chars; triggers re-reasoning when verdict="disagree"
}
```

**Response (200):**

```typescript
{
  success: true;
  data: {
    annotation: {
      id: string;
      verdict: string;
      correction: string | null;
      createdAt: string;
    };
    alternativeBranch: {            // Only when verdict="disagree" + correction
      nodeId: string;
      reasoning: string;
      confidence: number;
    } | null;
  };
}
```

### POST /api/memory

Execute memory operations against the hierarchical memory system.

**Request (discriminated union on `operation`):**

```typescript
{ operation: "archival_insert", content: string, tags?: string[], importance?: number }
{ operation: "archival_search", query: string, limit?: number }
{ operation: "recall_search",  query: string, limit?: number }
{ operation: "core_memory_append", section: "human" | "agent", content: string }
{ operation: "stats" }
```

**Response (200):**

```typescript
{
  success: true;
  data: {
    success: boolean;
    results?: MemoryEntry[];
    message: string;
    stats: {
      mainContextEntries: number;
      recallStorageEntries: number;
      archivalStorageEntries: number;
      mainContextTokens: number;
      mainContextCapacity: number;
      mainContextUtilization: number;
      totalInserts: number;
      totalSearches: number;
      totalEvictions: number;
      totalPromotions: number;
    };
    sessionId: string;
  };
}
```

### GET /api/insights

Retrieve metacognitive insights.

**Response (200):**

```typescript
{
  success: true;
  data: {
    insights: Array<{
      id: string;
      insightType: "pattern" | "bias_detection" | "improvement_hypothesis";
      insight: string;
      confidence: number;
      evidence: Array<{
        nodeId: string;
        excerpt: string;
        relevance: number;
      }>;
      createdAt: string;
    }>;
  };
}
```

### Error Response Format (all endpoints)

```typescript
{
  success: false;
  error: {
    code: string;        // Machine-readable error code
    message: string;     // Human-readable description
    details?: unknown;   // Zod validation issues, etc.
    correlationId: string;
    recoverable?: boolean;
  };
}
```

---

## Security

### Authentication System

Opus Nx uses HMAC-signed cookies for authentication, implemented entirely with the Web Crypto API for Edge runtime compatibility.

```
Login Flow:

  POST /api/auth { password }
       |
       v
  Compare password === AUTH_SECRET
       |
       v
  HMAC-SHA256("opus-nx-authenticated", AUTH_SECRET)
       |
       v
  Set cookie: opus-nx-auth = hex(signature)
  HttpOnly, Secure, SameSite=Strict

Verification (middleware.ts):

  Every request except public routes
       |
       v
  Read opus-nx-auth cookie
       |
       v
  crypto.subtle.verify("HMAC", key, sig,
    encode("opus-nx-authenticated"))
       |
       +---> Valid:   NextResponse.next()
       +---> Invalid: Redirect to /login
```

**Public routes (no auth required):**

- `/login`
- `/api/auth`, `/api/auth/logout`
- `/api/demo`
- `/api/health`
- `/_next/*`, static assets (`.svg`, `.png`, `.ico`, `.jpg`, `.jpeg`)

**Security properties:**

- Timing-safe comparison via `crypto.subtle.verify()` (no string equality)
- `AUTH_SECRET` serves dual purpose: login password and HMAC signing key
- Cookie hex-encoded, validated for even length and valid hex digits before parsing
- Edge-compatible: no Node.js `crypto` module dependency

### Environment Variable Management

```
Required:
  ANTHROPIC_API_KEY        Claude Opus 4.6 API access
  AUTH_SECRET              Login password + HMAC signing key
  SUPABASE_URL             PostgreSQL connection
  SUPABASE_SERVICE_ROLE_KEY  Server-side DB access (bypasses RLS)
  SUPABASE_ANON_KEY        Client-side DB access (respects RLS)
  VOYAGE_API_KEY           Voyage AI embeddings (voyage-3, 1024-dim)

Optional:
  TAVILY_API_KEY           Web search for Research Agent
  DEMO_MODE="true"         Enables /api/demo data seeder (not in .env.example)
```

All secrets are excluded from version control via `.gitignore` and `.env.example` documents the required variables without values.

### Input Validation

Every API route uses Zod schemas for request validation:

- UUID format validation (`z.string().uuid()`)
- String length limits (e.g., guidance max 2000 chars, correction max 5000 chars)
- Enum validation for effort levels, fork styles, verdict types
- Number range clamping (confidence 0-1, depth 1-20, branching factor 1-10)
- Array length limits (steps 1-50, styles minimum 2)

### Regex Safety

All regex patterns in ThinkGraph use length-limited capture groups (`{1,300}`, `{1,500}`) to prevent ReDoS (Regular Expression Denial of Service) attacks on user-controlled reasoning text.

---

## Performance

### Database Indexes

| Table                    | Index                                 | Type                            | Purpose                  |
| ------------------------ | ------------------------------------- | ------------------------------- | ------------------------ |
| `knowledge_entries`      | `embedding`                           | HNSW (m=16, ef_construction=64) | Vector similarity search |
| `knowledge_entries`      | `category`                            | B-tree                          | Category filtering       |
| `knowledge_entries`      | `title \|\| content`                  | GIN (tsvector)                  | Full-text search         |
| `knowledge_relations`    | `source_id`, `target_id`              | B-tree                          | Graph traversal          |
| `thinking_nodes`         | `session_id`                          | B-tree                          | Session queries          |
| `thinking_nodes`         | `parent_node_id`                      | B-tree                          | Parent lookups           |
| `thinking_nodes`         | `reasoning`                           | GIN (tsvector)                  | Full-text search         |
| `thinking_nodes`         | `node_type`                           | B-tree                          | Type filtering           |
| `reasoning_edges`        | `source_id`, `target_id`, `edge_type` | B-tree                          | Graph traversal          |
| `metacognitive_insights` | `session_id`, `insight_type`          | B-tree                          | Session and type queries |
| `decision_points`        | `thinking_node_id`                    | B-tree                          | Node lookups             |
| `contradictions`         | `knowledge_a_id, knowledge_b_id`      | B-tree (composite)              | Conflict lookups         |
| `sessions`               | `user_id`, `status`                   | B-tree                          | User and status queries  |
| `decision_log`           | `session_id`, `decision_type`         | B-tree                          | Audit trail queries      |
| `agent_runs`             | `session_id`, `agent_name`, `status`  | B-tree                          | Observability queries    |

### Streaming Architecture

```
Client (Browser)                      Server (Next.js Edge)
     |                                      |
     | POST /api/thinking/stream            |
     |------------------------------------->|
     |                                      |
     |  SSE: data: {type:"thinking",...}    |
     |<-------------------------------------|  ThinkingEngine
     |  SSE: data: {type:"thinking",...}    |  streams deltas
     |<-------------------------------------|  as they arrive
     |  ...                                 |
     |                                      |
     |  SSE: data: {type:"compaction",...}  |  (if compaction
     |<-------------------------------------|   triggered)
     |                                      |
     |  (ThinkGraph persistence happens     |
     |   AFTER streaming completes)         |
     |                                      |
     |  SSE: data: {type:"done",...}        |
     |<-------------------------------------|
     |                                      |
     |  Connection closed                   |
```

**Client disconnect handling:** The stream route listens for `request.signal` abort events. If the client disconnects during thinking, processing stops cleanly without persisting to the graph.

### Concurrent Execution Patterns

| Module           | Pattern                                    | Mechanism                                                      |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------- |
| ThinkFork        | N branches execute concurrently            | `Promise.allSettled()` with per-branch error isolation         |
| ThinkFork debate | N branches per round, rounds sequential    | `Promise.allSettled()` within each round                       |
| MemoryManager    | Related knowledge fetched in parallel      | `Promise.all()` for N `getRelatedKnowledge` calls              |
| GoTEngine        | Thoughts generated sequentially per branch | Sequential within search strategy, engines reused across calls |

### Token Budget Management

The Orchestrator tracks cumulative output tokens per session:

```
Session start: cumulativeOutputTokens = 0
Each request:  cumulativeOutputTokens += result.usage.outputTokens
Warning at:    configurable % threshold (fires onBudgetWarning once)
Exhausted at:  maxSessionOutputTokens reached (returns budget message)
Compaction limit: maxCompactions reached (returns compaction message)
```

### ThinkGraph Performance Optimizations

- **Pre-built regex:** Confidence indicator patterns are compiled once at module load (not per invocation).
- **Batch decision points:** Decision points are inserted via a single batch `createDecisionPoints` call rather than N individual inserts.
- **Deterministic jitter:** Confidence score jitter is based on a text hash rather than `Math.random()`, ensuring consistent scores for the same reasoning text.
- **UUID validation:** Malformed parent node IDs are caught before database operations to avoid unnecessary round-trips.
- **Zod validation:** Structured reasoning and token usage are validated with Zod schemas before DB insertion to prevent malformed JSONB.

### GoTEngine Performance Optimizations

- **Engine reuse:** ThinkingEngine instances are created once per `reason()` call and reused across all thought generation and evaluation calls within that session, avoiding repeated Anthropic client instantiation.
- **Sorted insertion:** Best-first search maintains a sorted open set with O(log n) binary search insertion rather than re-sorting the entire array on each insert.
- **Indexed thought lookup:** `buildThoughtIndex()` creates a `Map<string, Thought>` for O(1) lookups, and `getAncestorChain()` uses it for O(d) ancestor traversal instead of O(n*d).

---

## Research Foundation

Opus Nx implements algorithms from four foundational papers:

| Paper                                                                                 | Module(s)                       | Key Algorithm                                                    |
| ------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023)               | `thinkfork.ts`, `got-engine.ts` | BFS/DFS search over reasoning trees with state evaluation        |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023)            | `got-engine.ts`                 | Arbitrary thought graph topology with aggregation and refinement |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | `prm-verifier.ts`               | Process supervision -- verify each reasoning step independently  |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023)                      | `memory-hierarchy.ts`           | 3-tier memory hierarchy with paging and auto-eviction            |

---

*Version 2.0 -- February 8, 2026*
