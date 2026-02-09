# Opus Nx -- Single Source of Truth

> **AI reasoning you can see and steer** | Built with Claude Opus 4.6
>
> **Author**: Ozzy -- AI Engineer & Full-Stack Developer (Raleigh, NC)
> **GitHub**: [github.com/omerakben/opus-nx](https://github.com/omerakben/opus-nx)
> **Hackathon**: Cerebral Valley "Built with Opus 4.6" Claude Code Hackathon (February 10-16, 2026)
> **Category**: Most Creative Opus 4.6 Exploration

---

## 1. The Beginning -- Origin Story

### The Moment of Inspiration

It started with a frustration that every developer working with Claude Opus 4.6 has felt but few have articulated.

Ozzy -- an AI Engineer and Full-Stack Developer based in Raleigh, NC -- was deep in a complex debugging session with Claude's extended thinking enabled. The model was reasoning through a tangled dependency graph, methodically evaluating seven possible root causes, weighing each against the evidence, exploring dead ends, doubling back, and finally converging on the correct diagnosis. It was a masterclass in structured reasoning. And the moment Claude returned its response, every step of that beautiful chain of thought vanished. Gone. Like writing equations on a whiteboard and erasing them before anyone can photograph them.

This wasn't just an inconvenience. It was a fundamental waste. The reasoning that led to the answer was often more valuable than the answer itself. When a doctor explains their diagnostic process, you learn to recognize symptoms. When a lawyer walks through their argument structure, you learn to think about precedent. When an AI's reasoning chain is preserved, you can learn from it, challenge it, build on it, and trust it.

But every AI system in 2026 treats that reasoning as disposable scaffolding -- a means to an end that gets discarded the moment the end arrives.

### The Hackathon Context

Cerebral Valley's "Built with Opus 4.6" Claude Code Hackathon presented the perfect opportunity: $500 in API credits, 7 days, and a simple challenge -- build something that showcases what makes Opus 4.6 unique. Not just another chatbot or code generator. Something that couldn't exist without Opus 4.6's specific capabilities: its 50,000-token thinking budget, its 1-million-token context window, its 128K output limit, and its native streaming with thinking deltas.

### The Aha Moment

What if extended thinking wasn't just a means to better answers, but **the product itself**?

What if reasoning became a persistent, navigable data structure? Not just "the AI thought about this" but "here is the exact reasoning graph -- every step, every decision, every alternative considered, every fork in the road."

What if you could:

- **Search** past reasoning chains like you search code?
- **Fork** a reasoning path to explore "what if?" scenarios?
- **Verify** each step independently, catching errors that final-answer evaluation misses?
- **Reflect** on reasoning patterns across sessions, detecting systematic biases?
- **Remember** across sessions with a memory system that never loses context?

This wasn't just a feature request. It was a paradigm shift.

### The Name

**Opus Nx** -- "Opus" for Claude Opus 4.6, the only model powerful enough to make this work; "Nx" for "Opus Nexus|Opus Next|Opus N Times|Node Extend|Next-generation." The tagline: **"AI reasoning you can see and steer"** -- because reasoning should be visible, navigable, and under your control.

### Idea Validation

> "Turning reasoning into a structured, persistent artifact is both intriguing and challenging. It's an idea that can stand out if you present a clear and tangible user journey."

> "The real pain point we face is that we often lose the reasoning behind our decisions -- whether in coding, business, or daily life. By making reasoning traceable, reviewable, and branchable, we make insights as reusable as code."

> "You're not just using humans as rubber stamps; you're allowing them to become active co-thinkers who shape the reasoning landscape."

---

## 2. The Problem

### The Disappearing Reasoning Problem

Every AI system today treats extended thinking as a disposable side-effect. The reasoning happens in a black box, a response emerges, and the entire cognitive process that produced that response is thrown away. This creates a cascade of problems that compounds with every interaction:

| What Happens Today                   | The Cost                                  |
| ------------------------------------ | ----------------------------------------- |
| AI reasons deeply about your problem | The reasoning vanishes after the response |
| You get an answer without the "why"  | Black-box AI creates trust deficit        |
| Each conversation starts from zero   | No learning from past reasoning patterns  |
| One reasoning path is explored       | Alternatives are silently discarded       |
| Errors in reasoning go undetected    | No step-by-step verification exists       |
| Context is lost when windows fill up | Sessions have hard limits on memory       |

Consider the implications. A financial analyst asks Claude to evaluate a merger. The model thinks for 30 seconds -- weighing synergies against integration risks, modeling three scenarios, identifying a critical assumption about market timing. It returns a recommendation. But the analyst can't see which scenarios were modeled, what assumptions were critical, or where the confidence was lowest. If the recommendation is wrong, there's no audit trail to understand why.

### Who Feels This Pain

**1. AI Researchers & Engineers** -- They need audit trails, reproducible reasoning chains, and bias detection. When an AI system makes a critical recommendation, researchers need to trace the reasoning back to first principles. Currently, this is impossible once the response is returned.

**2. Knowledge Workers** (analysts, strategists, researchers) -- They need transparency in AI-assisted high-stakes decisions. A business strategist exploring market entry options needs to see what alternatives the AI considered and why they were rejected. They need "what-if" exploration and confidence levels, not just final answers.

**3. Enterprise Compliance** -- Regulated industries (healthcare, finance, legal) need decision provenance. When an AI assists in a medical diagnosis or a financial recommendation, auditors need to trace every reasoning step. Current AI systems provide no such trail.

### The Trust Gap

The fundamental issue is simple: **we trust AI answers but we can't verify AI reasoning.**

If a doctor can't explain why they prescribed a treatment, we don't trust them. If a financial advisor can't walk through their analysis, we switch advisors. If a lawyer can't articulate their argument structure, they lose the case.

Why do we accept less from AI?

The problem isn't that AI reasoning is bad. It's that AI reasoning is invisible. And invisible reasoning is untrustworthy reasoning, no matter how accurate the final answer happens to be.

---

## 3. The Idea

### Reasoning as a First-Class Data Structure

The core insight behind Opus Nx is deceptively simple: **Extended thinking should not be a means to an end -- it should be the product itself.**

Every time Claude Opus 4.6 thinks, that reasoning should become:

- **Persistent** -- Stored in a queryable database, not thrown away after the response
- **Navigable** -- A graph you can traverse, not a wall of text you have to read linearly
- **Branchable** -- Fork reasoning into parallel paths with different assumptions, like git branches for thought
- **Verifiable** -- Each step independently scored for correctness, not just the final answer
- **Self-improving** -- The AI analyzes its own reasoning patterns, detecting biases and suggesting improvements
- **Hierarchical** -- Three tiers of memory so sessions never lose context, no matter how long they run

This transforms the relationship between human and AI from **"Ask and receive"** to **"Reason together, explore together, decide together."**

### The Analogy

Think of Opus Nx as:

- **Git for reasoning** -- Branch, diff, and merge thought processes. Fork at any decision point to explore alternatives. Compare how different assumptions lead to different conclusions.
- **A debugger for thinking** -- Step through reasoning with breakpoints (checkpoints). Inspect the state of thought at any point. Set watchpoints on confidence levels.
- **A/B testing for decisions** -- Compare 4 different reasoning approaches simultaneously. See where they converge (agreement) and where they diverge (genuine uncertainty).
- **An MRI for AI cognition** -- See inside the black box in real-time. Watch reasoning form, branch, evaluate, and conclude. Detect pathologies (biases) before they affect outcomes.

---

## 4. The Hypothesis

### Primary Hypothesis

> If we transform Claude Opus 4.6's extended thinking from an ephemeral process into a persistent, queryable graph structure with branching, verification, and self-reflection capabilities, then users will be able to make better decisions because they can trace, verify, and explore the reasoning behind AI recommendations -- rather than blindly trusting final answers.

### Sub-Hypotheses

**1. Persistence Hypothesis**: Making reasoning persistent enables pattern detection and learning across sessions that ephemeral reasoning cannot. When reasoning chains are stored, users can search for past analyses of similar problems, detect recurring strategies, and build institutional knowledge from AI reasoning.

**2. Branching Hypothesis**: Exploring 4 concurrent reasoning perspectives (conservative/aggressive/balanced/contrarian) produces higher-quality decisions than single-path reasoning. The contrarian perspective specifically catches groupthink that the other three miss.

**3. Verification Hypothesis**: Scoring each reasoning step independently (Process Reward Model) catches errors that outcome-based evaluation misses. A chain of 10 steps might produce a correct final answer despite having a flawed step 4 -- PRM catches this.

**4. Metacognition Hypothesis**: Using the maximum 50,000 thinking token budget for self-reflection reveals systematic biases and recurring patterns that improve future reasoning. The AI analyzing its own reasoning is different from -- and more valuable than -- the AI reasoning about external problems.

**5. Memory Hypothesis**: A three-tier memory hierarchy (MemGPT-inspired) enables coherent sessions that far exceed the model's context window. By paging memories between main context, recall storage, and archival storage, sessions feel infinite while staying within token budgets.

**6. Trust Hypothesis**: Transparency into the reasoning process increases user trust compared to black-box AI answers. When users can see why the AI reached its conclusion, they trust the conclusion more -- and appropriately distrust it when the reasoning is weak.

---

## 5. The Solution -- Opus Nx

This is the heart of the system. Nine core modules, each implementing a distinct capability, all orchestrated by a central brain that adapts to the complexity of each task.

### 5.1 ThinkGraph -- Reasoning as Data Structure

**Module**: `packages/core/src/think-graph.ts` (935 lines)
**Database**: `thinking_nodes`, `reasoning_edges`, `decision_points` tables

Every extended thinking session is parsed into a persistent graph. Here's how it works:

Raw thinking text is split into paragraphs and classified into step types: `analysis`, `hypothesis`, `evaluation`, `conclusion`, `consideration`. The classification uses a combination of keyword detection and structural analysis to determine the role each paragraph plays in the reasoning chain.

Decision point extraction is where ThinkGraph becomes truly valuable:

- **12 regex patterns** detect decision points where alternatives were considered (e.g., "I could either...", "The options are...", "On one hand... on the other hand...")
- **8 choice extraction patterns** identify which path was chosen (e.g., "I'll go with...", "The best approach is...", "Choosing...")
- **6 rejection patterns** capture why alternatives were dismissed (e.g., "However, this fails because...", "This won't work due to...", "Rejecting this because...")

Confidence scores are calculated from language indicators on a scale of 0.15 to 0.95:

- High-confidence words ("clearly", "definitely", "certainly") push toward 0.9+
- Medium-confidence words ("likely", "probably", "suggests") center around 0.6-0.7
- Low-confidence words ("possibly", "might", "uncertain") pull toward 0.3-0.4

The graph supports 4 node types:

- `thinking` -- Standard reasoning nodes from extended thinking
- `compaction` -- Summary nodes created when context is compacted
- `fork_branch` -- Nodes from ThinkFork parallel reasoning
- `human_annotation` -- Nodes from human-in-the-loop checkpoints

And 5 edge types:

- `influences` -- One reasoning step informed another
- `contradicts` -- Two steps reach conflicting conclusions
- `supports` -- One step provides evidence for another
- `supersedes` -- A newer step replaces an older one (e.g., after correction)
- `refines` -- A step improves on a previous step without replacing it

Everything persists to Supabase PostgreSQL with graceful degradation -- if any persistence step fails (decision points, edges), the node itself still persists. A `degraded: true` flag and `persistenceIssues` array let the UI show what's partial.

6 RPC functions enable graph operations: `match_knowledge`, `get_related_knowledge`, `traverse_reasoning_graph`, `get_session_reasoning_context`, `search_reasoning_nodes`, `get_reasoning_chain`.

### 5.2 Metacognitive Self-Audit

**Module**: `packages/core/src/metacognition.ts` (619 lines)
**Prompt**: `configs/prompts/metacognition.md` (103 lines)

This is where Opus Nx does something no other AI system attempts: it turns Claude's reasoning inward, analyzing its own thinking patterns.

Using Opus 4.6's full 50,000 thinking token budget, the metacognition engine:

1. Gathers 10-20 recent thinking nodes from the active session
2. Formats each node's reasoning (capped at 5,000 characters), confidence score, decision count, and timestamp
3. Analyzes with maximum effort for patterns, biases, and improvement opportunities
4. Uses a `record_insight` tool for structured extraction with Zod validation

Three insight types are generated:

- **`bias_detection`** -- Identifies systematic biases: confirmation bias, anchoring, recency bias, availability bias, overconfidence, premature closure, sunk cost fallacy
- **`pattern`** -- Detects recurring reasoning strategies, favored approaches, and structural tendencies
- **`improvement_hypothesis`** -- Suggests specific improvements to future reasoning based on detected patterns

Evidence is linked to specific node IDs with excerpts and relevance scores (0-1). Confidence levels are calibrated:

- **High** (0.8-1.0): Pattern observed across 3+ nodes
- **Medium** (0.5-0.8): Pattern observed in 2 nodes
- **Low** (0.3-0.5): Single occurrence, flagged for monitoring

### 5.3 ThinkFork -- Parallel Reasoning Branches

**Module**: `packages/core/src/thinkfork.ts` (1,164 lines -- largest module)
**Prompts**: `configs/prompts/thinkfork/` (5 style-specific prompts)

Complex decisions rarely have a single correct perspective. ThinkFork addresses this by spawning 4 concurrent reasoning branches, each with a distinct cognitive style:

| Style        | Mindset                                               | Prompt            |
| ------------ | ----------------------------------------------------- | ----------------- |
| Conservative | Risk-averse, precedent-focused, proven approaches     | `conservative.md` |
| Aggressive   | Opportunity-seeking, innovative, growth-oriented      | `aggressive.md`   |
| Balanced     | Weighted trade-off evaluation, considers all sides    | `balanced.md`     |
| Contrarian   | Challenges assumptions, questions conventional wisdom | `contrarian.md`   |

All 4 branches execute concurrently via `Promise.allSettled`, each with a dedicated ThinkingEngine instance. After all branches complete, a comparison analysis identifies convergence points (where styles agree) and divergence points (where they disagree).

**Three operating modes:**

1. **Fork**: N branches execute concurrently. Each receives the user's query plus its style-specific system prompt. The comparison analysis (using `comparison.md`) identifies where and why the branches agree or disagree.

2. **Debate**: Multi-round adversarial reasoning. The process:
   - Initial fork generates 4 independent positions
   - N rounds where each branch sees all others' positions and can challenge, concede, or refine
   - Consensus check: all positions stable AND all confidence scores > 0.7
   - Result includes convergence/divergence analysis and a debate summary

3. **Steering**: Post-analysis human actions that redirect active reasoning:
   - `expand` -- Request deeper analysis on a specific branch
   - `merge` -- Synthesize insights from multiple branches
   - `challenge` -- Inject a counter-argument into a branch
   - `refork` -- Re-run the fork with new context or constraints

Optional `branchGuidance` lets users provide per-style directions before forking, so you can say "Conservative: focus on regulatory risk" or "Contrarian: challenge the market timing assumption."

### 5.4 Graph of Thoughts (GoT) -- Arbitrary Reasoning Topologies

**Module**: `packages/core/src/got-engine.ts` (871 lines)
**Research**: [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023)

While ThinkFork branches reasoning into parallel paths, Graph of Thoughts goes further -- supporting arbitrary graph structures where thoughts can be combined, refined, and recycled.

**Three search strategies:**

- **BFS** (breadth-first): Explores all possibilities at each depth level before going deeper. Best for divergent problems where the solution space is wide.
- **DFS** (depth-first with backtracking): Explores one path deeply before backtracking. Best for problems where deep analysis of specific paths matters.
- **Best-first** (priority queue): Evaluates all candidate thoughts and always expands the most promising one next. Uses sorted insertion for O(log n) performance.

**Three core operations:**

- **Generate**: Create diverse thoughts for a given reasoning step. Multiple thoughts are generated to ensure variety.
- **Aggregate**: Merge insights from multiple paths. This is the key innovation -- partial solutions from different branches can be combined via aggregation, which is impossible in tree structures.
- **Refine**: Iteratively improve a thought based on evaluation feedback. Low-scoring thoughts get a second chance with specific guidance on what to improve.

Thought lifecycle: `generated` -> `evaluated` -> `verified` | `rejected` | `aggregated`

A pruning threshold (default 0.3) rejects low-quality thoughts to keep the graph manageable. ThinkingEngine instances are created once per `reason()` call and reused across all operations for efficiency.

### 5.5 Process Reward Model (PRM) -- Step-by-Step Verification

**Module**: `packages/core/src/prm-verifier.ts` (478 lines)
**Research**: [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023)

Rather than evaluating only final answers (outcome-based evaluation), the PRM verifier scores each individual reasoning step independently. This catches errors that hide behind correct conclusions.

Each step is verified in isolation with all preceding steps as context. The verifier produces:

- **Verdict**: `correct` | `incorrect` | `neutral` | `uncertain`
- **Issue type** (if applicable): `logical_error`, `factual_error`, `missing_context`, `unsupported_claim`, `circular_reasoning`, `non_sequitur`, `overgeneralization`, `false_dichotomy`
- **Severity**: `critical` | `major` | `minor`

Chain scoring uses geometric mean, which was chosen after careful analysis:

```
For each step:
  correct:   score *= confidence
  incorrect: score *= (1 - confidence) * 0.3  (heavy penalty)
  neutral:   score *= 0.9
  uncertain: score *= 0.7

overallScore = score ^ (1 / stepCount)  (geometric mean normalizes for chain length)
```

**Why geometric mean?** Product of step confidences is too harsh -- long chains always approach zero regardless of quality. Arithmetic mean is misleading -- it hides weak steps behind strong ones. Geometric mean balances: it penalizes weak steps proportionally while normalizing for chain length, so a 3-step chain and a 30-step chain are scored on a comparable scale.

Pattern detection identifies:

- `declining_confidence` -- Confidence dropping over time suggests the reasoning is losing coherence
- `recurring_{issue_type}` -- Same type of error appearing multiple times
- `overconfidence_before_error` -- High confidence immediately followed by an error

### 5.6 Hierarchical Memory -- MemGPT-Inspired Three-Tier System

**Module**: `packages/core/src/memory-hierarchy.ts` (633 lines)
**Research**: [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023)

Sessions with AI have a fundamental constraint: the context window. No matter how large it is, eventually you run out of space. The hierarchical memory system solves this with a three-tier architecture inspired by the MemGPT paper:

| Tier | Name             | Capacity                                                 | Purpose                                                     |
| ---- | ---------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| L1   | Main Context     | Model context window (configurable, default 100k tokens) | Active working memory -- always visible to the LLM          |
| L2   | Recall Storage   | Bounded buffer (100 entries)                             | Recent session history, FIFO with importance-based archival |
| L3   | Archival Storage | Unbounded (Supabase + pgvector)                          | Long-term knowledge, semantic search via Voyage AI          |

**Memory operations** (LLM function call handlers):

- `archival_insert` -- Store knowledge in long-term archival storage
- `archival_search` -- Semantic search over archival storage
- `recall_search` -- Search recent session history
- `core_memory_append` -- Add to active working memory
- `core_memory_replace` -- Update existing working memory
- `evict_to_archival` -- Move entries from main context to archival
- `promote_to_working` -- Bring archival entries back into active context

**Auto-eviction**: When main context exceeds capacity, the system sorts entries by importance (ascending) and evicts the least-important entries until at 80% capacity. Evicted entries move to archival storage automatically, so nothing is ever truly lost -- just paged out to a tier that requires explicit retrieval.

### 5.7 Orchestrator -- Adaptive Session Management

**Module**: `packages/core/src/orchestrator.ts` (773 lines)

The Orchestrator is the central brain of Opus Nx. It manages the full lifecycle of each session:

**Dynamic effort routing** classifies incoming messages and routes them to the appropriate thinking effort level:

- Simple patterns (greetings, "what is", "define", "explain briefly") -> `low` effort (5k thinking tokens)
- Standard patterns (general questions, explanations) -> `medium` effort (10k tokens)
- Complex patterns ("debug", "architect", "design", "compare and contrast", "research", "step by step", "refactor", "optimize") -> `high`/`max` effort (20k-50k tokens)

Classification uses regex patterns and length heuristics, erring on the side of higher effort for ambiguous cases.

**Token budget enforcement** tracks cumulative output tokens per session and fires `onBudgetWarning` at a configurable threshold, giving users visibility into their API credit usage.

**Compaction boundary nodes**: When context compaction occurs (the ThinkingEngine summarizing older context to make room for new reasoning), the Orchestrator creates a `compaction` type node with a `supersedes` edge pointing to the summarized content. This preserves chain continuity in the reasoning graph -- you can always trace back through compaction boundaries to understand the full history.

**Knowledge context injection**: Before each reasoning step, the Orchestrator embeds the user's query via Voyage AI, retrieves the top-5 most similar knowledge entries from archival storage, and prepends them as context to the routing prompt. This means the AI always has relevant background knowledge available, even for the first message in a new session.

### 5.8 Thinking Engine -- Claude Opus 4.6 Wrapper

**Module**: `packages/core/src/thinking-engine.ts` (352 lines)

The Thinking Engine is the direct interface to the Anthropic API, wrapping Claude Opus 4.6's extended thinking capabilities:

- **Adaptive thinking**: Claude decides when and how much to think, guided by budget constraints
- **Effort levels**: `low` (5,000 tokens), `medium` (10,000), `high` (20,000), `max` (50,000)
- **Context compaction**: Enables infinite sessions via automatic summarization using the `compact_20260112` model feature
- **Streaming**: Three callbacks -- `onThinkingStream` (real-time thinking deltas), `onTextStream` (response text), `onCompactionStream` (compaction progress)
- **Token limits**: 128K output tokens, 1M context window
- **Response parsing**: Typed blocks -- `ThinkingBlock`, `RedactedThinkingBlock`, `TextBlock`, `ToolUseBlock`, `CompactionBlock`

### 5.9 Memory Manager -- Knowledge Persistence

**Module**: `packages/core/src/memory-manager.ts` (253 lines)

The Memory Manager handles knowledge storage and semantic search independently of the hierarchical memory system:

- `generateEmbedding(text)` -- Voyage AI API (voyage-3, 1024 dimensions)
- `store(input, options)` -- Create knowledge entry with auto-embedding
- `search(query, options)` -- Embed query, search via `match_knowledge` RPC (pgvector cosine distance)
- `getContext(query, options)` -- Search + fetch related entries in parallel
- `categorize(content, categories)` -- Auto-categorize via Claude Haiku 4.5

### 5.10 Checkpoint System -- Human-in-the-Loop

**Route**: `/api/reasoning/[id]/checkpoint`

Opus Nx's checkpoint system makes humans active participants in reasoning, not passive consumers.

At any reasoning node, a user can create a checkpoint with one of three verdicts:

- **`verified`** -- Creates a `supports` edge. The human confirms the reasoning step is sound.
- **`questionable`** -- Creates a `refines` edge. The human flags potential concerns without fully disagreeing.
- **`disagree`** -- Creates a `contradicts` edge. The human provides a correction.

When a user selects `disagree` and provides a correction, the system generates an alternative reasoning branch with the correction as context. This creates a fork in the reasoning graph where the human's domain knowledge directly shapes the AI's analysis.

Checkpoint nodes are `human_annotation` type, preserving the human's input permanently in the reasoning audit trail. This is what makes humans "active co-thinkers who shape the reasoning landscape" rather than passive consumers of AI output.

---

## 6. Architecture

### 6.1 Monorepo Structure (Turborepo + pnpm workspaces)

```
opus-nx/
├── apps/
│   └── web/                          # Next.js 16 dashboard (App Router, Turbopack)
│       └── src/
│           ├── app/
│           │   └── api/              # 21 API routes
│           └── components/           # 37 React components (11 directories)
├── packages/
│   ├── core/                         # 9 reasoning modules (6,078 lines total)
│   │   └── src/                      # ThinkGraph, Metacognition, ThinkFork, GoT,
│   │                                 # PRM, Memory, Orchestrator, ThinkingEngine, MemoryManager
│   ├── db/                           # Supabase client, 7 query modules (1,880 lines), migration mirror
│   ├── agents/                       # LangChain/LangGraph agent implementations
│   │                                 # (5 agents: Research, Code, Knowledge, Planning, Communication)
│   └── shared/                       # Config loader (YAML+Zod), structured logger
├── configs/
│   ├── agents.yaml                   # 5 agent definitions (model, tools, prompts)
│   ├── categories.yaml               # 5 knowledge taxonomy categories
│   └── prompts/                      # 7 system prompts + 5 ThinkFork style prompts
│       ├── orchestrator.md, metacognition.md, research.md, code.md
│       ├── knowledge.md, planning.md, communication.md
│       └── thinkfork/                # conservative.md, aggressive.md, balanced.md,
│                                     # contrarian.md, comparison.md
├── supabase/
│   └── migrations/                   # 3 canonical SQL migrations
│       ├── 001_initial_schema.sql    # Knowledge, sessions, decision log, agent runs
│       ├── 002_thinking_graph.sql    # Thinking nodes, edges, decisions, contradictions, insights
│       └── 003_node_type.sql         # Node type column for thinking_nodes
└── [docs: CLAUDE.md, ARCHITECTURE.md, PRD.md, ROADMAP.md]
```

### 6.2 System Architecture Diagram

```
+------------------------------------------------------------------+
|                       Next.js 16 Dashboard                       |
|  +------------+ +----------+ +-----------+ +--------+ +--------+ |
|  | ThinkGraph | | ThinkFork| | Metacog   | | GoT    | | PRM    | |
|  | Visualizer | | Panel    | | Insights  | | Panel  | | Verify | |
|  +-----+------+ +----+-----+ +----+------+ +---+----+ +---+----+ |
+--------+--------------+------------+------------+----------+------+
         |              |            |            |          |
+------------------------------------------------------------------+
|                    @opus-nx/core (9 modules)                     |
|  ThinkingEngine | ThinkGraph | Metacognition | ThinkFork         |
|  GoT Engine | PRM Verifier | MemoryHierarchy | Orchestrator      |
|  MemoryManager                                                    |
+------------------------------------------------------------------+
         |
+------------------------------------------------------------------+
|          @opus-nx/db (Supabase PostgreSQL + pgvector)            |
|  10 tables, 6 RPC functions, HNSW indexes                       |
+------------------------------------------------------------------+
         |
+------------------------------------------------------------------+
|  Claude Opus 4.6   |   Voyage AI (1024-dim)  |   Tavily Search  |
|  (50k thinking)    |   (voyage-3)            |   (web research)  |
+------------------------------------------------------------------+
```

### 6.3 Data Layer

**10 database tables** across 3 migrations:

| Table                    | Purpose                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `sessions`               | Session management (soft delete via `archived` status)                                        |
| `thinking_nodes`         | Persistent reasoning nodes (4 types: thinking, compaction, fork_branch, human_annotation)     |
| `reasoning_edges`        | Relationships between nodes (5 types: influences, contradicts, supports, supersedes, refines) |
| `decision_points`        | Decision audit trail with alternatives and confidence scores                                  |
| `knowledge_entries`      | Embedded knowledge base (pgvector 1024-dim, HNSW indexed)                                     |
| `knowledge_relations`    | Knowledge graph edges (related_to, derived_from, contradicts, updates, part_of)               |
| `metacognitive_insights` | Self-reflection outputs (bias_detection, pattern, improvement_hypothesis)                     |
| `decision_log`           | Decision tracking with latency metrics and token usage                                        |
| `agent_runs`             | Agent execution history (status, tokens, timing)                                              |
| `contradictions`         | Knowledge conflicts (schema only, resolver descoped)                                          |

**6 RPC functions:**

| Function                        | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `match_knowledge`               | Semantic search via pgvector cosine distance             |
| `get_related_knowledge`         | Recursive graph traversal for related knowledge entries  |
| `traverse_reasoning_graph`      | Recursive reasoning graph traversal with cycle detection |
| `get_session_reasoning_context` | Recent reasoning nodes with decision counts              |
| `search_reasoning_nodes`        | Full-text search over reasoning content                  |
| `get_reasoning_chain`           | Walk parent links from node to root                      |

**7 query modules** in `packages/db/src/`:

| Module              | Lines | Purpose                                            |
| ------------------- | ----- | -------------------------------------------------- |
| `thinking-nodes.ts` | 628   | ThinkGraph CRUD, decision points, edges, traversal |
| `metacognition.ts`  | 441   | Insight creation, retrieval, session analysis      |
| `sessions.ts`       | 234   | Session lifecycle, archival, stats                 |
| `knowledge.ts`      | 216   | Knowledge storage, search, relations               |
| `agent-runs.ts`     | 183   | Agent execution tracking                           |
| `decisions.ts`      | 133   | Decision log entries                               |
| `client.ts`         | 45    | Supabase client initialization                     |

### 6.4 API Layer -- 21 Routes

| Route                             | Method(s)          | Purpose                                            |
| --------------------------------- | ------------------ | -------------------------------------------------- |
| `/api/auth`                       | POST               | HMAC-SHA256 cookie authentication (Web Crypto API) |
| `/api/auth/logout`                | POST               | Clear auth cookie                                  |
| `/api/think`                      | POST               | Extended thinking (alias)                          |
| `/api/thinking`                   | POST               | Extended thinking (canonical)                      |
| `/api/thinking/stream`            | POST               | SSE streaming for thinking deltas                  |
| `/api/stream/[sessionId]`         | GET                | SSE stream (compatibility)                         |
| `/api/fork`                       | POST               | ThinkFork parallel reasoning (4 branches)          |
| `/api/fork/steer`                 | POST               | Branch steering (expand/merge/challenge/refork)    |
| `/api/got`                        | POST               | Graph of Thoughts reasoning                        |
| `/api/verify`                     | POST               | PRM step-by-step verification                      |
| `/api/sessions`                   | GET, POST          | Session CRUD                                       |
| `/api/sessions/[sessionId]`       | GET, PATCH, DELETE | Session detail operations                          |
| `/api/sessions/[sessionId]/nodes` | GET                | Thinking nodes for session                         |
| `/api/reasoning/[id]`             | GET                | Reasoning node details                             |
| `/api/reasoning/[id]/checkpoint`  | POST               | Human-in-the-loop checkpoint                       |
| `/api/insights`                   | GET, POST          | Metacognitive insights                             |
| `/api/memory`                     | GET, POST          | Hierarchical memory operations                     |
| `/api/health`                     | GET                | Health check (no auth)                             |
| `/api/demo`                       | POST               | Generate demo data                                 |
| `/api/seed`                       | POST               | Seed knowledge base                                |
| `/api/seed/business-strategy`     | POST               | Seed business strategy data                        |

### 6.5 Authentication

HMAC-SHA256 signed cookies via Web Crypto API (Edge-compatible):

- `AUTH_SECRET` is both the login password and the HMAC signing key
- Cookie: `opus-nx-auth = hex(HMAC-SHA256("opus-nx-authenticated", AUTH_SECRET))`
- Timing-safe comparison via `crypto.subtle.verify()` (no string equality -- resistant to timing attacks)
- `DEMO_MODE=true` enables the `/api/demo` data seeder (does NOT bypass auth)
- Public routes: `/login`, `/api/auth`, `/api/health`, `/api/demo`, `/_next/*`, static assets

### 6.6 Streaming Architecture

**Protocol**: Server-Sent Events (SSE)

- Event types: `thinking` (real-time thinking chunks), `compaction` (context summarization progress), `warning` (budget alerts), `done` (completion signal), `error` (failure details)
- Client disconnect handling via `request.signal` abort events
- Persistence happens AFTER streaming completes -- the user sees reasoning in real-time, and it's saved to the database once the full response is ready

### 6.7 Frontend -- 37 Components

| Directory   | Components                                                                                       | Purpose                                       |
| ----------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `graph/`    | ThinkingGraph, ThinkingNode, StreamingNode, EdgeTypes, GraphControls, GraphLegend                | Interactive reasoning graph via @xyflow/react |
| `fork/`     | ForkPanel, BranchCard, Convergence                                                               | Side-by-side branch comparison                |
| `got/`      | GoTPanel                                                                                         | Graph of Thoughts visualization               |
| `verify/`   | VerificationPanel                                                                                | Step-by-step verification display             |
| `insights/` | InsightsPanel, InsightCard                                                                       | Metacognitive insights with evidence          |
| `memory/`   | MemoryPanel                                                                                      | 3-tier memory browser                         |
| `thinking/` | ThinkingInput, ThinkingStream, TokenCounter                                                      | Real-time SSE display                         |
| `sessions/` | SessionList, SessionCard, SessionStats                                                           | Session management                            |
| `layout/`   | Dashboard, Header, LeftPanel, RightPanel, BottomPanel, MobileNav                                 | App layout with collapsible sidebars          |
| `tour/`     | DemoTour                                                                                         | Guided tour for new users                     |
| `ui/`       | badge, button, card, dropdown-menu, input, neural-submit-button, skeleton, sonner, tabs, tooltip | shadcn/ui primitives                          |

---

## 7. PRD (Product Requirements Document)

### Features with Implementation Status

| #   | Feature                                  | Module                | Lines | Status                    |
| --- | ---------------------------------------- | --------------------- | ----- | ------------------------- |
| 1   | ThinkGraph                               | `think-graph.ts`      | 935   | Complete                  |
| 2   | Metacognitive Self-Audit                 | `metacognition.ts`    | 619   | Complete                  |
| 3   | ThinkFork (4 styles + debate + steering) | `thinkfork.ts`        | 1,164 | Complete (expanded)       |
| 4   | Graph of Thoughts (BFS/DFS/best-first)   | `got-engine.ts`       | 871   | Complete (paper-backed)   |
| 5   | PRM Verifier (step-by-step)              | `prm-verifier.ts`     | 478   | Complete (paper-backed)   |
| 6   | Hierarchical Memory (3-tier)             | `memory-hierarchy.ts` | 633   | Complete (paper-backed)   |
| 7   | Dynamic Effort Routing                   | `orchestrator.ts`     | --    | Complete                  |
| 8   | Context Compaction                       | `thinking-engine.ts`  | --    | Complete                  |
| 9   | Checkpoint System                        | API route             | --    | Complete                  |
| 10  | Dashboard UI (37 components)             | `apps/web/`           | --    | Complete                  |
| 11  | Contradiction Resolution                 | --                    | --    | Descoped (DB schema only) |

### Key User Stories

**ThinkGraph**

- As a user, I can submit a complex query and watch the reasoning stream in real-time via SSE
- As a user, I can navigate the reasoning graph visually, clicking nodes to see decision points
- As a user, I can search past reasoning chains by keyword or natural language query

**ThinkFork**

- As a user, I can trigger parallel reasoning with 4 distinct perspectives on any complex decision
- As a user, I can see where perspectives converge (agreement) and diverge (disagreement)
- As a user, I can trigger debate mode where perspectives argue across multiple rounds
- As a user, I can steer active branches (expand, merge, challenge, refork)

**Metacognition**

- As a user, I can trigger a self-audit that analyzes the session's reasoning patterns
- As a user, I can see detected biases, recurring patterns, and improvement suggestions with evidence

**GoT / PRM / Memory**

- As a user, I can run Graph of Thoughts reasoning for problems requiring multiple merged perspectives
- As a user, I can verify any reasoning chain step-by-step, seeing scores and issues per step
- As a user, I can work across sessions without losing context via hierarchical memory

### Non-Functional Requirements

- **Performance**: <100ms SSE streaming latency, <200ms graph traversal via RPC, <2s dashboard load
- **Scalability**: 10,000+ thinking nodes per project, O(log n) HNSW search, 10+ concurrent fork branches
- **Security**: HMAC auth with timing-safe comparison, Zod validation on all routes, ReDoS-safe regex patterns, environment-variable-only secrets
- **Reliability**: Graceful degradation -- if persistence partially fails, nodes still store; partial results from `Promise.allSettled` in ThinkFork

### 5 Agent Definitions (from `configs/agents.yaml`)

| Agent         | Model           | Tokens | Temp | Tools                                               |
| ------------- | --------------- | ------ | ---- | --------------------------------------------------- |
| Research      | claude-opus-4-6 | 8,192  | 0.7  | web_search, paper_analysis, fact_verification       |
| Code          | claude-opus-4-6 | 16,384 | 0.3  | code_generation, repo_management, debugging         |
| Knowledge     | claude-opus-4-6 | 4,096  | 0.5  | categorization, cross_reference, retrieval          |
| Planning      | claude-opus-4-6 | 8,192  | 0.5  | task_decomposition, scheduling, dependency_analysis |
| Communication | claude-opus-4-6 | 4,096  | 0.7  | email_draft, message_format, report_generation      |

### Knowledge Taxonomy (from `configs/categories.yaml`)

5 categories with subcategories:

- **Technology**: ai_ml, web_development, infrastructure, security, data_engineering
- **Research**: academic_papers, industry_reports, case_studies, benchmarks
- **Business**: strategy, operations, finance, marketing, hiring
- **Personal**: ideas, bookmarks, notes, goals, preferences
- **Projects**: requirements, architecture, decisions, lessons_learned, blockers

---

## 8. Technical Specifications

### 8.1 Tech Stack

| Layer         | Technology                       | Version / Details                                           |
| ------------- | -------------------------------- | ----------------------------------------------------------- |
| LLM           | Claude Opus 4.6                  | Extended thinking up to 50k tokens, 1M context, 128K output |
| Framework     | Next.js 16                       | App Router, Turbopack, React 19                             |
| Styling       | Tailwind CSS 4.1.4               | + shadcn/ui + Radix UI                                      |
| Visualization | @xyflow/react 12.5               | Interactive graph rendering                                 |
| Database      | Supabase (PostgreSQL + pgvector) | HNSW indexes (m=16, ef_construction=64)                     |
| Embeddings    | Voyage AI voyage-3               | 1024 dimensions                                             |
| Agents        | LangChain + LangGraph            | @langchain/anthropic 0.3+                                   |
| Monorepo      | Turborepo + pnpm 9.15            | Build caching, workspace protocol                           |
| Language      | TypeScript 5.7+                  | Strict mode, ESM with .js extensions                        |
| Runtime       | Node.js 22+                      | Native top-level await                                      |
| Testing       | Vitest 4.0                       | 58 tests across 4 test suites                               |
| Validation    | Zod 3.24+                        | All API routes, config files, DB inputs                     |

### 8.2 API Contracts

#### POST /api/thinking

```typescript
// Request
interface ThinkingRequest {
  query: string;
  sessionId?: string;          // Auto-creates if omitted
  effort?: 'low' | 'medium' | 'high' | 'max';
  parentNodeId?: string;       // Chain to existing reasoning
}

// Response
interface ThinkingResponse {
  nodeId: string;
  sessionId: string;
  reasoning: string;           // Full thinking text
  response: string;            // Final response text
  confidence: number;          // 0-1
  decisionPoints: DecisionPoint[];
  tokenUsage: { input: number; output: number; thinking: number };
}

// SSE Events (POST /api/thinking/stream)
// event: thinking   -> { delta: string }
// event: compaction -> { summary: string }
// event: warning    -> { message: string, tokensUsed: number }
// event: done       -> ThinkingResponse
// event: error      -> { message: string }
```

#### POST /api/fork

```typescript
// Request
interface ForkRequest {
  query: string;
  sessionId: string;
  styles?: ForkStyle[];             // Default: all 4
  mode?: 'fork' | 'debate';
  debateRounds?: number;            // For debate mode
  branchGuidance?: Record<ForkStyle, string>;
}

// Response
interface ForkResponse {
  branches: ForkBranchResult[];     // One per style
  comparison: {
    convergencePoints: ConvergencePoint[];
    divergencePoints: DivergencePoint[];
    summary: string;
  };
  debateResult?: DebateResult;      // If mode === 'debate'
}
```

#### POST /api/got

```typescript
// Request
interface GoTRequest {
  query: string;
  sessionId: string;
  strategy?: 'bfs' | 'dfs' | 'best_first';
  maxDepth?: number;
  pruningThreshold?: number;
}

// Response
interface GoTResponse {
  thoughts: Thought[];
  bestThought: Thought;
  transformations: Transformation[];
  stats: {
    totalGenerated: number;
    totalEvaluated: number;
    totalPruned: number;
    totalAggregated: number;
  };
}
```

#### POST /api/verify

```typescript
// Request
interface VerifyRequest {
  steps: string[];                  // Array of reasoning steps to verify
  sessionId?: string;
  context?: string;                 // Additional context for verification
}

// Response
interface VerifyResponse {
  stepResults: StepVerification[];
  overallScore: number;             // Geometric mean
  patterns: string[];               // Detected patterns
  summary: string;
}

interface StepVerification {
  step: string;
  verdict: 'correct' | 'incorrect' | 'neutral' | 'uncertain';
  confidence: number;
  justification: string;
  issues?: {
    type: string;
    severity: 'critical' | 'major' | 'minor';
    description: string;
  }[];
}
```

#### POST /api/memory

```typescript
// Store Request
interface MemoryStoreRequest {
  action: 'store';
  title: string;
  content: string;
  category?: string;
}

// Search Request
interface MemorySearchRequest {
  action: 'search';
  query: string;
  category?: string;
  limit?: number;
}

// Response
interface MemoryResponse {
  entries?: KnowledgeEntry[];
  stored?: { id: string };
  stats: { totalEntries: number; categories: Record<string, number> };
}
```

#### POST /api/reasoning/:id/checkpoint

```typescript
// Request
interface CheckpointRequest {
  verdict: 'verified' | 'questionable' | 'disagree';
  comment?: string;
  correction?: string;              // Required when verdict === 'disagree'
}

// Response
interface CheckpointResponse {
  checkpointNodeId: string;
  edgeType: 'supports' | 'refines' | 'contradicts';
  alternativeBranch?: {             // When verdict === 'disagree'
    nodeId: string;
    reasoning: string;
  };
}
```

### 8.3 Database Schema

**Entity-Relationship Diagram:**

```
+------------------+     +-------------------+     +------------------+
|    sessions      |     |  thinking_nodes   |     | reasoning_edges  |
+------------------+     +-------------------+     +------------------+
| id (PK)          |<-+  | id (PK)           |<--->| id (PK)          |
| user_id (FK)     |  |  | session_id (FK)---+-+   | source_id (FK)   |
| status           |  |  | parent_node_id(FK)|     | target_id (FK)   |
| current_plan     |  |  | node_type         |     | edge_type        |
| knowledge_context|  |  | reasoning         |     | weight           |
| created_at       |  |  | structured_reason |     | metadata         |
| updated_at       |  |  | confidence_score  |     +------------------+
+------------------+  |  | thinking_budget   |
                      |  | signature         |     +------------------+
                      |  | input_query       |     | decision_points  |
                      |  | token_usage       |     +------------------+
                      |  | created_at        |     | id (PK)          |
                      |  +-------------------+     | thinking_node_id |
                      |                            | step_number      |
                      |  +-------------------+     | description      |
                      |  | decision_log      |     | chosen_path      |
                      |  +-------------------+     | alternatives     |
                      +--| session_id (FK)   |     | confidence       |
                      |  | decision_type     |     | reasoning_excerpt|
                      |  | input_context     |     +------------------+
                      |  | thinking_summary  |
                      |  | decision_output   |     +-------------------+
                      |  | tokens_used       |     | knowledge_entries |
                      |  | latency_ms        |     +-------------------+
                      |  +-------------------+     | id (PK)           |
                      |                            | title              |
                      |  +-------------------+     | content            |
                      |  | agent_runs        |     | embedding (1024)   |
                      |  +-------------------+     | category           |
                      +--| session_id (FK)   |     | subcategory        |
                      |  | agent_name        |     | source             |
                      |  | model             |     | metadata           |
                      |  | status            |     +-------------------+
                      |  | tokens_used       |            |
                      |  +-------------------+     +------+------------+
                      |                            | knowledge_relations|
                      |  +--------------------+    +-------------------+
                      |  | contradictions     |    | source_id (FK)    |
                      |  +--------------------+    | target_id (FK)    |
                      +--| session_id (FK)    |    | relation_type     |
                      |  | knowledge_a_id(FK) |    | weight            |
                      |  | knowledge_b_id(FK) |    +-------------------+
                      |  | thinking_node_id   |
                      |  | contradiction_type |    +---------------------+
                      |  | severity           |    | metacognitive_      |
                      |  | resolution_summary |    |   insights          |
                      |  +--------------------+    +---------------------+
                      |                            | id (PK)             |
                      +----------------------------| session_id (FK)     |
                                                   | thinking_nodes_     |
                                                   |   analyzed (UUID[]) |
                                                   | insight_type        |
                                                   | insight             |
                                                   | evidence            |
                                                   | confidence          |
                                                   +---------------------+
```

### 8.4 Environment Variables

| Variable                    | Required | Purpose                        |
| --------------------------- | -------- | ------------------------------ |
| `ANTHROPIC_API_KEY`         | Yes      | Claude Opus 4.6 access         |
| `AUTH_SECRET`               | Yes      | HMAC signing + login password  |
| `SUPABASE_URL`              | Yes      | PostgreSQL connection          |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Server-side DB (bypasses RLS)  |
| `SUPABASE_ANON_KEY`         | Yes      | Client-side DB (respects RLS)  |
| `VOYAGE_API_KEY`            | Yes      | voyage-3 embeddings (1024-dim) |
| `TAVILY_API_KEY`            | Optional | Web search for Research Agent  |
| `DEMO_MODE`                 | Optional | `"true"` enables demo seeder   |

### 8.5 Performance Optimizations

1. **Pre-built regex patterns**: All 12 decision detection, 8 choice extraction, and 6 rejection patterns are compiled at module load time, not per-invocation
2. **Batch decision point insertion**: `createDecisionPoints` inserts all decision points for a node in a single DB call
3. **Deterministic confidence jitter**: Uses text hash (not `Math.random`) to add minor variation to confidence scores, ensuring reproducibility
4. **Sorted insertion for best-first search**: O(log n) insertion maintains priority queue order in GoT
5. **Indexed thought lookup**: `Map<string, Thought>` for O(1) thought retrieval by ID in GoT
6. **Engine reuse**: ThinkingEngine instances created once per GoT `reason()` call and reused across all operations
7. **ThinkFork partial failure handling**: `Promise.allSettled` ensures 3 successful branches still produce a result even if 1 fails
8. **Concurrent knowledge retrieval**: `Promise.all` for parallel search + related entry fetching in MemoryManager

---

## 9. Tasks & TODO

### 7-Day Hackathon Timeline

| Day | Focus                          | Hours | Key Deliverable                                                                     |
| --- | ------------------------------ | ----- | ----------------------------------------------------------------------------------- |
| 1   | ThinkGraph Foundation          | 8     | Reasoning persistence working -- nodes, edges, decision points stored and queryable |
| 2   | Metacognition Engine           | 8     | Self-audit generating insights from reasoning patterns                              |
| 3   | ThinkFork + GoT + PRM + Memory | 8     | Parallel branches, graph reasoning, verification, and hierarchical memory           |
| 4   | Dashboard UI                   | 8     | 37-component visual explorer with interactive graph                                 |
| 5+  | Polish + Features + Demo       | 8+    | Dynamic routing, compaction, checkpoints, demo data, guided tour                    |

### Submission Checklist

- [ ] Demo video recorded and uploaded (YouTube/Loom)
- [ ] Dashboard deployed to Vercel
- [ ] Submission form completed at cv.inc/e/claude-code-hackathon
- [x] Code pushed to GitHub
- [x] README updated
- [x] Category selected: "Most Creative Opus 4.6 Exploration"

### Post-Hackathon Backlog

- **Contradiction Resolution Engine** -- DB schema exists (`contradictions` table), runtime not built. Would detect and resolve conflicting knowledge entries.
- **Multi-user collaboration** on reasoning graphs -- Multiple people contributing checkpoints and annotations to shared reasoning
- **Export reasoning graphs** for external analysis -- GraphML, JSON-LD, or Mermaid diagram export
- **Automated self-reflection scheduling** -- Trigger metacognition automatically at intervals or after significant reasoning chains
- **Reasoning quality benchmarking** -- Standardized evaluation suite for measuring improvement over time
- **Third-party model support** -- Extend beyond Claude Opus 4.6 to support other models with extended thinking

---

## 10. Analysis & Findings

### Technical Findings

**1. Why Claude Opus 4.6 is the only viable model**

The 50,000 thinking token budget is not a luxury -- it's a requirement. Meaningful metacognition (reasoning about reasoning) requires deep analysis of 10-20 previous reasoning nodes, each potentially containing thousands of characters. Models with smaller thinking budgets (4k-8k tokens) simply cannot maintain coherence across this much source material. Additionally: 1M context window, 128K output, native streaming with thinking deltas, and superior instruction following for the multi-layer meta-prompts that ThinkFork's debate mode requires.

**2. Why geometric mean for chain scoring**

We evaluated three scoring approaches for PRM chains:

- **Product of step confidences**: Too harsh. A chain of 10 steps where every step is 0.9 confidence produces 0.9^10 = 0.35. Long chains always approach zero regardless of quality.
- **Arithmetic mean**: Misleading. A chain with nine 0.95 steps and one 0.2 step averages 0.88, hiding the critical weak link.
- **Geometric mean**: The right balance. It penalizes weak steps proportionally while normalizing for chain length. That same chain with a weak step produces ~0.82 -- noticeably lower but not catastrophically so, and the weak step is flagged independently.

**3. Why 4 cognitive styles (not 2 or 3)**

Initial prototypes used only conservative/aggressive/balanced. The problem: these three often converge on similar conclusions from slightly different angles. Adding the contrarian style -- whose explicit job is to challenge assumptions and argue against the emerging consensus -- catches groupthink that the other three miss. In testing, the contrarian perspective surfaced legitimate concerns in approximately 40% of cases that the other three had overlooked.

**4. Why pgvector + ILIKE fallback**

Semantic search (pgvector cosine distance) handles synonyms beautifully -- "machine learning" matches "AI/ML" and "deep learning." But it misses acronyms and proper nouns. ILIKE pattern matching catches exact phrases like "GPT-4" or "HIPAA compliance." The hybrid approach: try semantic search first, fall back to ILIKE if results are sparse.

**5. Why YAML for configuration**

Agent definitions (`agents.yaml`), knowledge taxonomy (`categories.yaml`), and system prompts (`configs/prompts/`) are all external to TypeScript code. This means non-engineers can modify agent behavior, prompts, and taxonomy without touching compiled code. The config loader uses Zod for validation, catching errors at load time rather than runtime.

**6. Graceful degradation pattern**

If any persistence step fails (decision points, edges), the node itself still persists. A `degraded: true` flag and `persistenceIssues` array let the UI show what's partial. This pattern appears throughout the codebase: ThinkFork uses `Promise.allSettled` so partial branch failures don't lose successful branches; the Memory Manager falls back to local state if Supabase is unavailable.

### What We Descoped and Why

**Contradiction Resolution Engine** was descoped because:

- Building GoT, PRM, and Memory Hierarchy provided stronger hackathon differentiation (3 research papers implemented > 1 custom feature)
- The DB schema is preserved in `002_thinking_graph.sql` for future implementation
- The three research features address a broader set of the "reasoning trust" problem -- contradiction resolution addresses a narrower use case

### What We Learned

1. **Extended thinking text is surprisingly well-structured for parsing.** Decision patterns are consistent enough for regex extraction. Claude's thinking consistently uses phrases like "I could either...", "The options are...", "On one hand..." that map cleanly to decision points.

2. **50k thinking tokens for metacognition produces genuinely useful insights.** The self-audit doesn't just detect biases in the abstract -- it links them to specific reasoning nodes with excerpts and relevance scores. This makes the insights actionable.

3. **Debate mode produces the most interesting outputs when styles disagree.** Consensus is less valuable than illuminating genuine disagreement. When conservative and aggressive branches converge, that's reassuring but not surprising. When the contrarian branch raises a concern that causes balanced to shift its position in round 2, that's genuine insight.

4. **Auto-eviction in hierarchical memory enables sessions that feel unbounded** while staying within token budgets. Users don't notice the paging -- they just notice that the AI remembers context from 30 minutes ago that should have been lost to context limits.

---

## 11. Research Foundation

Opus Nx implements algorithms from four foundational papers, each advancing the state of the art in LLM reasoning:

| Paper                                                                           | Year | Module                          | Key Algorithm                                                    |
| ------------------------------------------------------------------------------- | ---- | ------------------------------- | ---------------------------------------------------------------- |
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al.)               | 2023 | `thinkfork.ts`, `got-engine.ts` | BFS/DFS search over reasoning trees with state evaluation        |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al.)            | 2023 | `got-engine.ts`                 | Arbitrary thought graph topology with aggregation and refinement |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al.) | 2023 | `prm-verifier.ts`               | Process supervision -- verify each reasoning step independently  |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al.)                      | 2023 | `memory-hierarchy.ts`           | 3-tier memory hierarchy with paging and auto-eviction            |

### Tree of Thoughts (Yao et al., 2023)

**Core idea**: Instead of linear chain-of-thought reasoning, explore a tree of possible reasoning paths using search algorithms. At each step, generate multiple candidate continuations, evaluate them, and use BFS or DFS to find the best path.

**How Opus Nx implements it**: ThinkFork and GoT both draw from this paper. ThinkFork implements the branching concept with 4 style-specific branches that run concurrently. GoT extends this with BFS, DFS, and best-first search strategies, plus evaluation-based pruning.

**What was adapted**: The original paper uses a single model evaluating its own thoughts. Opus Nx extends this with style-specific system prompts for diversity (ThinkFork) and aggregation operations that merge insights across branches (GoT).

### Graph of Thoughts (Besta et al., 2023)

**Core idea**: Go beyond trees to arbitrary graph structures. Thoughts can be combined (aggregation), refined (iterative improvement), and recycled (partial solutions from one branch can be used in another).

**How Opus Nx implements it**: `got-engine.ts` implements the full GoT framework with three search strategies (BFS, DFS, best-first), three operations (generate, aggregate, refine), and thought lifecycle management (generated -> evaluated -> verified/rejected/aggregated).

**What was adapted**: The paper focuses on mathematical and sorting problems. Opus Nx generalizes this to open-ended reasoning tasks, using Claude Opus 4.6's natural language capabilities for thought generation and evaluation rather than task-specific prompts.

### Let's Verify Step by Step (Lightman et al., 2023)

**Core idea**: Process reward models (PRMs) that score each step of a reasoning chain independently outperform outcome reward models (ORMs) that only score the final answer. PRMs catch errors that ORMs miss because correct final answers can emerge from flawed reasoning.

**How Opus Nx implements it**: `prm-verifier.ts` verifies each step in isolation with full preceding context. 8 issue types cover the spectrum of reasoning errors. Geometric mean scoring normalizes for chain length while penalizing weak steps.

**What was adapted**: The original paper trains a dedicated PRM classifier. Opus Nx uses Claude Opus 4.6 itself as the verifier, leveraging its extended thinking to deeply analyze each step. This is more flexible (handles any reasoning domain) at the cost of higher latency per step.

### MemGPT (Packer et al., 2023)

**Core idea**: Inspired by virtual memory in operating systems, create a tiered memory system for LLMs. Main context is the "RAM" -- always visible but limited. Archival storage is the "disk" -- unlimited but requires explicit retrieval.

**How Opus Nx implements it**: `memory-hierarchy.ts` implements three tiers (main context, recall storage, archival storage) with 7 memory operations. Auto-eviction sorts by importance and pages out the least important entries when main context exceeds capacity.

**What was adapted**: MemGPT pages individual messages. Opus Nx pages reasoning nodes and knowledge entries, which are richer structures. The importance scoring considers recency, confidence, and decision count (nodes with more decision points are considered more important).

---

## 12. README

*(The following is the content for the GitHub repository README)*

# Opus Nx

**AI reasoning you can see and steer.**

Built for the [Cerebral Valley "Built with Opus 4.6" Hackathon](https://cv.inc/e/claude-code-hackathon) (Feb 10-16, 2026)

---

## The Innovation

| What Others Do                       | What Opus Nx Does                                             |
| ------------------------------------ | ------------------------------------------------------------- |
| Extended thinking improves responses | Extended thinking becomes **queryable history**               |
| AI conversations are stateless       | Every reasoning chain is **persistent and traversable**       |
| "The AI said X"                      | "The AI reasoned A -> B -> C to conclude X"                   |
| Black box decisions                  | **Transparent decision archaeology**                          |
| Single reasoning path                | **Parallel branches** with convergence analysis               |
| Trust the final answer               | **Step-by-step verification** of each reasoning step          |
| Fixed context window                 | **Hierarchical memory** with automatic eviction and retrieval |

---

## Core Features

1. **ThinkGraph** -- Reasoning as a persistent, navigable data structure with decision point extraction
2. **Metacognitive Self-Audit** -- AI analyzing its own reasoning patterns, biases, and strategies
3. **ThinkFork** -- 4-style parallel reasoning with debate mode and branch steering
4. **Graph of Thoughts** -- Arbitrary reasoning topologies with aggregation and refinement
5. **PRM Verifier** -- Step-by-step reasoning verification with geometric mean scoring
6. **Hierarchical Memory** -- MemGPT-inspired 3-tier memory with auto-eviction
7. **Orchestrator** -- Adaptive effort routing, token budgets, and knowledge injection

## Architecture

```
+------------------------------------------------------------------+
|                       Next.js 16 Dashboard                       |
|  +------------+ +----------+ +-----------+ +--------+ +--------+ |
|  | ThinkGraph | | ThinkFork| | Metacog   | | GoT    | | PRM    | |
|  | Visualizer | | Panel    | | Insights  | | Panel  | | Verify | |
|  +-----+------+ +----+-----+ +----+------+ +---+----+ +---+----+ |
+--------+--------------+------------+------------+----------+------+
         |              |            |            |          |
+------------------------------------------------------------------+
|                    @opus-nx/core (9 modules)                     |
+------------------------------------------------------------------+
         |
+------------------------------------------------------------------+
|          Supabase (PostgreSQL + pgvector)                        |
+------------------------------------------------------------------+
         |
+------------------------------------------------------------------+
|  Claude Opus 4.6   |   Voyage AI   |   Tavily Search            |
+------------------------------------------------------------------+
```

## Tech Stack

| Layer         | Technology                                 |
| ------------- | ------------------------------------------ |
| LLM           | Claude Opus 4.6 (50k thinking, 1M context) |
| Framework     | Next.js 16, React 19, Tailwind CSS 4       |
| Database      | Supabase (PostgreSQL + pgvector, HNSW)     |
| Embeddings    | Voyage AI voyage-3 (1024-dim)              |
| Agents        | LangChain + LangGraph                      |
| Visualization | @xyflow/react                              |
| Monorepo      | Turborepo + pnpm 9.15                      |
| Testing       | Vitest 4.0 (58 tests, 4 suites)            |

## Quick Start

**Prerequisites**: Node.js 22+, pnpm 9.15+, Supabase project

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
pnpm install
cp .env.example .env          # Fill in API keys
pnpm db:migrate               # Run database migrations
pnpm build                    # Build all packages
pnpm dev                      # Start development server
```

**Environment Variables**:

| Variable                    | Required | Purpose              |
| --------------------------- | -------- | -------------------- |
| `ANTHROPIC_API_KEY`         | Yes      | Claude Opus 4.6      |
| `AUTH_SECRET`               | Yes      | HMAC auth + password |
| `SUPABASE_URL`              | Yes      | Database             |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Server DB access     |
| `SUPABASE_ANON_KEY`         | Yes      | Client DB access     |
| `VOYAGE_API_KEY`            | Yes      | Embeddings           |
| `TAVILY_API_KEY`            | No       | Web search           |

## Project Structure

```
opus-nx/
├── apps/
│   └── web/                    # Next.js 16 dashboard
│       └── src/
│           ├── app/api/        # 21 API routes
│           └── components/     # 37 React components (11 directories)
├── packages/
│   ├── core/                   # 9 reasoning modules (6,078 lines)
│   ├── db/                     # Supabase client + 7 query modules
│   ├── agents/                 # LangChain/LangGraph (5 agents)
│   └── shared/                 # Config loader (YAML+Zod), logger
├── configs/
│   ├── agents.yaml             # 5 agent definitions
│   ├── categories.yaml         # 5 knowledge categories
│   └── prompts/                # 7 system + 5 ThinkFork prompts
├── supabase/
│   └── migrations/             # 3 SQL migrations (10 tables, 6 RPCs)
└── [CLAUDE.md, ARCHITECTURE.md, PRD.md, ROADMAP.md, README.md]  # Root-level documentation
```

## Why Opus 4.6?

| Capability                     | Why It Matters                                         |
| ------------------------------ | ------------------------------------------------------ |
| 50k thinking token budget      | Required for metacognition (reasoning about reasoning) |
| 1M context window              | Enables deep analysis of long reasoning chains         |
| 128K output tokens             | Full reasoning chains without truncation               |
| Native thinking stream         | Real-time visibility into reasoning as it happens      |
| Superior instruction following | Multi-layer meta-prompts for debate mode               |

## Research Foundation

| Paper                                                         | Module                          | Key Contribution                       |
| ------------------------------------------------------------- | ------------------------------- | -------------------------------------- |
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601)          | `thinkfork.ts`, `got-engine.ts` | BFS/DFS search over reasoning          |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687)         | `got-engine.ts`                 | Arbitrary graph topology + aggregation |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) | `prm-verifier.ts`               | Process supervision per step           |
| [MemGPT](https://arxiv.org/abs/2310.08560)                    | `memory-hierarchy.ts`           | 3-tier memory with paging              |

## Development Commands

**Core Workflow:**

```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages (Turborepo)
pnpm dev                  # Start all dev servers
pnpm lint                 # Run linting
pnpm typecheck            # Type-check all packages
pnpm test                 # Run tests (includes migration drift check)
```

**Database:**

```bash
pnpm db:migrate           # Run Supabase migrations
pnpm db:generate          # Regenerate TypeScript types from Supabase
pnpm check:migrations     # Verify migration drift between supabase/ and packages/db/
```

**Package-Specific:**

```bash
pnpm --filter @opus-nx/web dev        # Start just the web dashboard
pnpm --filter @opus-nx/core test      # Run core package tests
pnpm --filter @opus-nx/web typecheck  # Type-check web only
```

## API Reference (21 Routes)

| Route                             | Method(s)          | Purpose                           |
| --------------------------------- | ------------------ | --------------------------------- |
| `/api/auth`                       | POST               | HMAC-SHA256 authentication        |
| `/api/auth/logout`                | POST               | Clear auth cookie                 |
| `/api/think`                      | POST               | Extended thinking (alias)         |
| `/api/thinking`                   | POST               | Extended thinking (canonical)     |
| `/api/thinking/stream`            | POST               | SSE streaming for thinking deltas |
| `/api/stream/[sessionId]`         | GET                | SSE stream (compatibility)        |
| `/api/fork`                       | POST               | ThinkFork parallel reasoning      |
| `/api/fork/steer`                 | POST               | Branch steering                   |
| `/api/got`                        | POST               | Graph of Thoughts reasoning       |
| `/api/verify`                     | POST               | PRM step-by-step verification     |
| `/api/sessions`                   | GET, POST          | Session CRUD                      |
| `/api/sessions/[sessionId]`       | GET, PATCH, DELETE | Session detail operations         |
| `/api/sessions/[sessionId]/nodes` | GET                | Thinking nodes for session        |
| `/api/reasoning/[id]`             | GET                | Reasoning node details            |
| `/api/reasoning/[id]/checkpoint`  | POST               | Human-in-the-loop checkpoint      |
| `/api/insights`                   | GET, POST          | Metacognitive insights            |
| `/api/memory`                     | GET, POST          | Hierarchical memory operations    |
| `/api/health`                     | GET                | Health check (no auth)            |
| `/api/demo`                       | POST               | Generate demo data                |
| `/api/seed`                       | POST               | Seed knowledge base               |
| `/api/seed/business-strategy`     | POST               | Seed business strategy data       |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) -- System architecture details
- [PRD.md](./PRD.md) -- Product requirements document
- [ROADMAP.md](./ROADMAP.md) -- Development roadmap
- [CLAUDE.md](./CLAUDE.md) -- Claude Code integration guide

## License

MIT

---

Built with Claude Code for the Cerebral Valley "Built with Opus 4.6" Hackathon, by [Ozzy](https://github.com/omerakben)

---

## 13. Differentiators

### vs. ChatGPT / Claude / Gemini

| Standard AI                        | Opus Nx                                 |
| ---------------------------------- | --------------------------------------- |
| Stateless conversations            | Persistent reasoning graph              |
| Extended thinking as quality boost | Extended thinking as the product        |
| "AI said X"                        | "AI reasoned A -> B -> C to conclude X" |
| Response quality focus             | Cognitive visibility focus              |
| Assistant paradigm                 | Peer-level metacognition                |
| Linear chain-of-thought            | Graph of Thoughts with aggregation      |
| No verification                    | Step-by-step process verification       |
| Single-session memory              | Three-tier hierarchical memory          |

### vs. Chain-of-Thought Prompting

Chain-of-thought prompting makes AI show its work in the response. That's valuable but ephemeral -- it vanishes when the conversation ends. Opus Nx makes reasoning a **structured, persistent data structure** that survives beyond the conversation. You can search it, branch it, verify it, and learn from it across sessions.

### vs. RAG Systems

RAG retrieves documents. Opus Nx retrieves **past reasoning chains and the decisions embedded within them**. The graph structure means related reasoning is connected by typed edges (supports, contradicts, refines), not just similar by embedding distance.

### vs. Agent Frameworks (LangChain, CrewAI)

Agent frameworks orchestrate **tool calls**. Opus Nx orchestrates **reasoning itself** -- branching it, verifying it, reflecting on it, and preserving it. The agents in Opus Nx are secondary to the reasoning infrastructure.

### The Unique Position

Opus Nx is the only system that:

1. **Treats extended thinking as a first-class data structure** (not just a quality enhancer)
2. **Implements 4 foundational reasoning papers** in a single coherent platform
3. **Enables human-in-the-loop reasoning** via checkpoints (not just approval gates)
4. **Has the AI analyze its own reasoning patterns** via metacognition
5. **Supports 4-way parallel reasoning with adversarial debate**

No other system combines persistence, branching, verification, self-reflection, and hierarchical memory into a single reasoning platform.

---

## 14. Use Case Ideas

### 1. Business Decision Making

A startup CEO faces a strategic dilemma: pivot to enterprise or stay consumer. They input the dilemma into Opus Nx. ThinkFork generates 4 perspectives -- conservative warns about enterprise sales cycles, aggressive champions the larger deal sizes, balanced models both scenarios, contrarian asks "what if the real problem is neither?" The CEO checkpoints a key assumption about customer acquisition cost, injecting market data the AI didn't have. PRM verifies each branch's reasoning step-by-step. The final decision is traceable, debatable, and archived for board review.

### 2. Medical Diagnosis Support

A doctor inputs a complex set of symptoms. Graph of Thoughts explores multiple diagnostic paths simultaneously, combining evidence from different symptom clusters. PRM verifies each diagnostic step, flagging where the reasoning relies on assumptions rather than evidence. The reasoning graph shows which conditions were considered and rejected, building an audit trail for compliance. The hierarchical memory retains the patient's history across visits.

### 3. Legal Case Strategy

A lawyer explores case arguments. ThinkFork presents aggressive (push for summary judgment) vs. conservative (negotiate settlement) vs. balanced (prepare for both) vs. contrarian (challenge standing) approaches. The reasoning graph becomes case documentation. Debate mode has the perspectives argue, often surfacing weaknesses the lawyer hadn't considered.

### 4. Technical Architecture Decisions

A senior engineer evaluates database choices for a new service. Graph of Thoughts explores relational vs. document vs. graph vs. time-series options. Each path is scored by PRM. Metacognition detects if the engineer's prompts show technology bias ("I usually use PostgreSQL..."). The comparison analysis highlights which non-functional requirements each option handles best.

### 5. Academic Research

A PhD student explores a research question. Reasoning branches into multiple literature streams. GoT aggregates insights from different paper clusters. PRM verifies logical steps in the thesis argument. Hierarchical memory preserves analysis across multi-week research sessions. Metacognition identifies when the student's framing shows confirmation bias.

### 6. Investment Analysis

An analyst evaluates a company. Conservative branch focuses on risks and downside scenarios. Aggressive branch models the bull case. Checkpoint system lets the analyst inject current market data at key reasoning points. The reasoning graph becomes the investment memo -- every conclusion traceable to evidence and reasoning.

### 7. Product Strategy

A PM explores feature prioritization. ThinkFork debate mode has four perspectives argue about roadmap priorities. Conservative warns about technical debt. Aggressive champions rapid iteration. Balanced weighs both. Contrarian asks "should we build this at all?" The convergence/divergence analysis highlights genuine strategic tensions vs. false dichotomies.

### 8. Incident Post-Mortem

An SRE investigates a production outage. The reasoning graph traces the investigation: hypotheses explored, root causes evaluated, red herrings dismissed. Each hypothesis is a branch; PRM verifies the logical chain from evidence to conclusion. The archived graph becomes the post-mortem document, with every reasoning step documented.

### 9. Education and Learning

A student works through a complex proof or concept. PRM verifies each logical step, catching mistakes before they compound. Metacognition identifies patterns in the student's reasoning errors ("you consistently miss edge cases in induction proofs"). Hierarchical memory preserves learning across study sessions.

### 10. Compliance and Audit

A compliance officer documents AI-assisted decisions. Every reasoning step is traceable with timestamps, confidence scores, and human checkpoints. The decision graph is the audit trail. Metacognition provides an independent check for systematic biases. The graph is exportable for regulatory review.

---

## 15. Hackathon Speech

### Opening Hook (0:00-0:30)

> "Imagine facing a tough problem -- a product strategy decision, a complex coding refactor, a medical diagnosis. You ask an AI for help. It thinks deeply, gives you a great answer... and then that brilliant reasoning vanishes forever.
>
> Every AI system today treats reasoning as disposable. We built something different.
>
> This is Opus Nx -- AI reasoning you can see and steer. Every thought is persistent, navigable, and yours to verify."

### Problem Statement (0:30-1:00)

> "Here's the problem we all face but rarely solve: we lose the reasoning behind our decisions. When the AI says 'choose option B', you can't see why it rejected A, what assumptions it made, or how confident it was at each step. It's a black box. And black boxes don't build trust.
>
> In regulated industries, this isn't just uncomfortable -- it's a compliance risk. In high-stakes decisions, it's a business risk. And in everyday work, it's an enormous waste of cognitive value."

### Demo -- ThinkGraph (1:00-2:00)

> "Let me show you what happens when reasoning becomes persistent. I'll submit a complex query -- let's say, 'Should we migrate our monolith to microservices?'"
>
> [Submit query, watch thinking stream in real-time via SSE]
>
> "Watch the thinking appear in real-time -- this is Claude Opus 4.6's extended thinking, and we're capturing every token. Now look at the graph -- each node represents a reasoning step. Click this node to see the decision point: the AI considered three migration strategies and chose a strangler fig pattern. You can see why the other two were rejected."
>
> [Navigate graph, click decision point, show alternatives]
>
> "Now search for past reasoning: 'Why did you decide on the strangler fig pattern?' The system finds the exact decision point across all sessions."

### Demo -- ThinkFork + Debate (2:00-3:00)

> "Now let's add parallel perspectives. ThinkFork spawns 4 branches -- conservative, aggressive, balanced, and contrarian -- each analyzing the same question from a fundamentally different angle."
>
> [Show 4 branches completing, convergence/divergence analysis]
>
> "Look: three branches agree on phased migration, but the contrarian branch raises a critical question about team capacity that the others ignored. Let's trigger debate mode."
>
> [Show debate round where branches argue]
>
> "After two rounds of debate, the balanced branch has shifted its position. The contrarian's team capacity concern was legitimate. That's not something single-path reasoning would catch."

### Demo -- Research Features (3:00-4:00)

> "Three features backed by research papers. First, PRM verification -- submit a reasoning chain, watch each step get scored independently."
>
> [Submit chain, show step scores, highlight found error]
>
> "Step 4 has an unsupported claim -- the overall chain looked fine, but step-by-step verification caught a hidden weakness.
>
> Graph of Thoughts -- instead of linear reasoning, thoughts form an arbitrary graph. Watch ideas from different branches merge via aggregation."
>
> [Show GoT graph with aggregation node]
>
> "And hierarchical memory -- three tiers, like virtual memory for AI. This session started 45 minutes ago, but context from the beginning is still available because it was paged to archival storage."

### Demo -- Human-in-the-Loop (4:00-4:30)

> "Finally, the checkpoint system. At any reasoning node, I can pause and inject my own knowledge."
>
> [Click checkpoint, select 'disagree', provide correction]
>
> "I disagreed with the cost assumption and provided actual market data. Watch -- the system generates an alternative branch incorporating my correction. I'm not a passive consumer; I'm a co-thinker shaping the reasoning landscape."

### Closing (4:30-5:00)

> "What's innovative is the interaction: you don't just follow the AI; you actively shape it. You can branch reasoning paths, test alternative assumptions, and see how different choices play out. It's not solely about AI assisting you -- it's about you co-steering your reasoning journey.
>
> This project implements 4 foundational AI reasoning papers. 9 core modules. 21 API routes. 37 UI components. 6,078 lines of core reasoning logic. Built in 7 days with $500 in API credits.
>
> Opus Nx transforms reasoning into something you can visualize, shape, and trust -- step by step.
>
> Only possible with Claude Opus 4.6.
>
> Thank you."

### Key Talking Points for Q&A

1. **"Why Opus 4.6 specifically?"** -- Only model with 50k thinking token budget (required for metacognition), 1M context window, 128K output, and native thinking stream. No other model can do this.

2. **"How is this different from chain-of-thought?"** -- CoT shows reasoning in the response. We make reasoning a persistent, navigable graph that survives beyond the conversation with typed relationships between nodes.

3. **"What's the business model?"** -- Enterprise decision audit trails (regulated industries need AI explainability), research teams studying reasoning patterns, and consulting firms that need transparent AI-assisted analysis.

4. **"What was hardest to build?"** -- ThinkFork debate mode (1,164 lines). Getting 4 AI instances to meaningfully argue with each other and reach genuine consensus (or productive disagreement) required careful prompt engineering across 5 style-specific prompts.

5. **"What paper was most impactful?"** -- MemGPT. The 3-tier memory hierarchy is what makes sessions feel infinite. Without it, the system is limited to one conversation's context window.

---

> *Built with Claude Code for the Cerebral Valley "Built with Opus 4.6" Claude Code Hackathon*
> *By Ozzy -- AI Engineer & Full-Stack Developer, Raleigh, NC*
> *GitHub: [github.com/omerakben/opus-nx](https://github.com/omerakben/opus-nx)*
