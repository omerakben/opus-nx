# Opus Nx: Development Roadmap

**Hackathon**: Built with Opus 4.6: Claude Code Hackathon (Cerebral Valley)
**Duration**: 7 Days (Feb 10-16, 2026)
**API Credits**: $500
**Submission Deadline**: Feb 16, 2026

---

## Current State (as of February 8, 2026)

All planned hackathon features have been built, plus significant additional features beyond the original plan. The Contradiction Resolution Engine was descoped in favor of three research-paper-backed features that provided stronger differentiation.

### What was built

| Feature                                        | Module                           | Status              | Lines |
| ---------------------------------------------- | -------------------------------- | ------------------- | ----- |
| ThinkGraph (reasoning as persistent graph)     | `think-graph.ts`                 | Complete            | 935   |
| Metacognitive Self-Audit (50k thinking budget) | `metacognition.ts`               | Complete            | 619   |
| ThinkFork (4 styles + debate + steering)       | `thinkfork.ts`                   | Complete (expanded) | 1,164 |
| Graph of Thoughts (BFS/DFS/best-first)         | `got-engine.ts`                  | Complete (new)      | 871   |
| PRM Verifier (step-by-step verification)       | `prm-verifier.ts`                | Complete (new)      | 478   |
| Hierarchical Memory (3-tier MemGPT-inspired)   | `memory-hierarchy.ts`            | Complete (new)      | 633   |
| Dynamic Effort Routing                         | `orchestrator.ts`                | Complete (new)      | --    |
| Context Compaction                             | `thinking-engine.ts`             | Complete (new)      | --    |
| Checkpoint System                              | `/api/reasoning/[id]/checkpoint` | Complete (new)      | --    |
| Dashboard UI (37 components)                   | `apps/web/`                      | Complete            | --    |

### What was descoped

| Feature                         | Reason                                            | Artifact                                                           |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Contradiction Resolution Engine | Time redirected to GoT, PRM, and Memory Hierarchy | DB schema exists (migration 002), types defined, no runtime module |

---

## Timeline Overview

```
Day 1         Day 2         Day 3         Day 4         Day 5+
+---------+   +---------+   +---------+   +---------+   +---------+
|ThinkGraph|   |Metacog  |   |ThinkFork|   |Dashboard|   | Polish  |
|Foundation|-->| Engine  |-->|+ GoT/PRM|-->|   UI    |-->|+ New    |
|          |   |         |   |+ Memory |   |         |   | Features|
+---------+   +---------+   +---------+   +---------+   +---------+
     |              |              |              |              |
     v              v              v              v              v
  Reasoning     Insights       Parallel       Visual        Submit
  persists      generate       branches       explorer      ready
```

| Day | Focus                          | Hours | Milestone                             | Status   |
| --- | ------------------------------ | ----- | ------------------------------------- | -------- |
| 1   | ThinkGraph Foundation          | 8     | Reasoning persistence working         | Complete |
| 2   | Metacognition Engine           | 8     | Self-audit generating insights        | Complete |
| 3   | ThinkFork + GoT + PRM + Memory | 8     | Parallel branches + research features | Complete |
| 4   | Dashboard UI                   | 8     | Visual reasoning explorer live        | Complete |
| 5+  | Polish + New Features + Demo   | 8+    | Submission ready                      | Complete |

---

## Day 1: ThinkGraph Foundation

> **Goal**: Every extended thinking session creates a persistent, navigable graph node

### Morning Session (4 hours)

#### Task 1.1: Database Schema Update

**Time**: 1.5 hours
**File**: `packages/db/migrations/002_thinking_graph.sql`

**Work**:

```sql
-- Tables to create:
- thinking_nodes (id, session_id, parent_node_id, reasoning, structured_reasoning, confidence_score, thinking_budget, signature, created_at)
- reasoning_edges (id, source_id, target_id, edge_type, weight, metadata, created_at)
- decision_points (id, thinking_node_id, step_number, description, chosen_path, alternatives, confidence)
```

**Acceptance Criteria**:

- [x] Migration runs without errors
- [x] HNSW index created for reasoning search
- [x] Graph traversal RPC function created
- [x] Foreign keys properly cascade

---

#### Task 1.2: Thinking Node Types

**Time**: 1 hour
**File**: `packages/core/src/types/thinking.ts`

**Work**:

```typescript
// Types to define:
export interface ThinkingNode { ... }
export interface ReasoningEdge { ... }
export interface DecisionPoint { ... }
export interface StructuredReasoning { ... }

// Zod schemas:
export const ThinkingNodeSchema = z.object({ ... })
export const DecisionPointSchema = z.object({ ... })
```

**Acceptance Criteria**:

- [x] All interfaces compile without errors
- [x] Zod schemas validate sample data
- [x] Types exported from package index

---

#### Task 1.3: DB Query Layer

**Time**: 1.5 hours
**File**: `packages/db/src/thinking-nodes.ts`

**Work**:

```typescript
// Functions to implement:
export async function createThinkingNode(node: CreateThinkingNodeInput): Promise<ThinkingNode>
export async function getThinkingNode(id: string): Promise<ThinkingNode | null>
export async function getSessionThinkingNodes(sessionId: string): Promise<ThinkingNode[]>
export async function traverseReasoningGraph(nodeId: string, depth: number): Promise<GraphTraversalResult>
export async function createReasoningEdge(sourceId: string, targetId: string, type: EdgeType): Promise<ReasoningEdge>
```

**Acceptance Criteria**:

- [x] CRUD operations work correctly
- [x] Graph traversal returns connected nodes
- [x] Proper error handling with typed errors

---

### Afternoon Session (4 hours)

#### Task 1.4: ThinkGraph Core Module

**Time**: 2 hours
**File**: `packages/core/src/think-graph.ts`

**Work**:

```typescript
export class ThinkGraph {
  // Parse raw thinking into structured format
  parseThinkingToNode(thinkingBlock: ThinkingBlock, sessionId: string): ThinkingNode

  // Extract decision points from reasoning text
  extractDecisionPoints(reasoning: string): DecisionPoint[]

  // Persist node to database
  async persistThinkingNode(node: ThinkingNode): Promise<ThinkingNode>

  // Create edge between nodes
  async linkNodes(sourceId: string, targetId: string, type: EdgeType): Promise<void>

  // Query graph for related reasoning
  async getRelatedReasoning(nodeId: string, depth?: number): Promise<ThinkingNode[]>
}
```

**Acceptance Criteria**:

- [x] Parsing extracts at least 80% of decision points
- [x] Confidence scores calculated from language
- [x] Alternatives captured with rejection reasons

---

#### Task 1.5: Integrate with ThinkingEngine

**Time**: 1.5 hours
**File**: `packages/core/src/thinking-engine.ts`

**Acceptance Criteria**:

- [x] Every think() call creates a thinking node
- [x] Nodes linked to session
- [x] Sequential nodes linked with 'influences' edge

---

#### Task 1.6: Day 1 Integration Test

**Time**: 0.5 hours
**File**: `packages/core/src/tests/think-graph.test.ts`

**Test Cases**:

```typescript
describe('ThinkGraph', () => {
  test('parses thinking block into structured node')
  test('extracts decision points from reasoning')
  test('persists node to database')
  test('links sequential nodes')
  test('traverses reasoning graph')
})
```

---

### Day 1 Deliverables

- [x] `packages/db/migrations/002_thinking_graph.sql` - Schema
- [x] `packages/core/src/types/thinking.ts` - Types
- [x] `packages/db/src/thinking-nodes.ts` - DB queries
- [x] `packages/core/src/think-graph.ts` - Core logic (935 lines)
- [x] Modified `packages/core/src/thinking-engine.ts`
- [x] `packages/core/src/tests/think-graph.test.ts`

---

## Day 2: Metacognition Engine

> **Goal**: AI can analyze its own reasoning patterns using 50k thinking budget

### Morning Session (4 hours)

#### Task 2.1: Metacognition Schema

**Time**: 0.5 hours
**File**: `packages/db/migrations/002_thinking_graph.sql` (append)

**Acceptance Criteria**:

- [x] `metacognitive_insights` table created
- [x] Indexes on session_id and insight_type

---

#### Task 2.2: Metacognition Types

**Time**: 0.5 hours
**File**: `packages/core/src/types/metacognition.ts`

**Acceptance Criteria**:

- [x] MetacognitiveInsight, InsightEvidence, BiasPattern interfaces defined
- [x] Types exported from package index

---

#### Task 2.3: Metacognition Prompts

**Time**: 1.5 hours
**File**: `configs/prompts/metacognition.md`

**Acceptance Criteria**:

- [x] Self-analysis prompt covers patterns, biases, and improvements
- [x] Output format specifies structured JSON

---

#### Task 2.4: Metacognition Core Module

**Time**: 1.5 hours
**File**: `packages/core/src/metacognition.ts`

**Acceptance Criteria**:

- [x] MetacognitionEngine class implemented (619 lines)
- [x] gatherReasoningHistory, analyzePatterns, detectBiases, generateImprovements methods
- [x] Full getSelfReflection pipeline

---

### Afternoon Session (4 hours)

#### Task 2.5: 50k Thinking Budget Integration

**Time**: 2 hours
**File**: `packages/core/src/metacognition.ts`

**Acceptance Criteria**:

- [x] Metacognition uses `effort: 'max'` (50k thinking tokens)
- [x] Context built from 10-20 recent reasoning nodes
- [x] Insights parsed and persisted to database

---

#### Task 2.6: Orchestrator Integration

**Time**: 1 hour
**File**: `packages/core/src/orchestrator.ts`

**Acceptance Criteria**:

- [x] Orchestrator exposes triggerMetacognition() method
- [x] Auto-trigger logic after N thinking sessions

---

#### Task 2.7: Day 2 Integration Test

**Time**: 1 hour
**File**: `packages/core/src/tests/metacognition.test.ts`

**Acceptance Criteria**:

- [x] Tests for reasoning gathering, analysis, bias detection, insight persistence

---

### Day 2 Deliverables

- [x] Extended `packages/db/migrations/002_thinking_graph.sql`
- [x] `packages/core/src/types/metacognition.ts`
- [x] `configs/prompts/metacognition.md`
- [x] `packages/core/src/metacognition.ts` (619 lines)
- [x] Modified `packages/core/src/orchestrator.ts`
- [x] `packages/core/src/tests/metacognition.test.ts`

---

## Day 3: ThinkFork + Research Features

> **Goal**: Parallel reasoning branches, Graph of Thoughts, PRM verification, and hierarchical memory

**Note**: The original plan called for ThinkFork + Contradiction Resolution on Day 3. Contradiction Resolution was descoped. In its place, three research-paper-backed features were implemented: Graph of Thoughts, PRM Verification, and Hierarchical Memory.

### Morning Session (4 hours)

#### Task 3.1: ThinkFork Types

**Time**: 0.5 hours
**File**: `packages/core/src/types/think-fork.ts`

**Acceptance Criteria**:

- [x] ReasoningBranch, ForkResult, BranchComparison interfaces defined

---

#### Task 3.2: ThinkFork Core Module

**Time**: 2 hours
**File**: `packages/core/src/thinkfork.ts`

**Note**: Actual filename is `thinkfork.ts` (no hyphen), not `think-fork.ts` as originally planned.

**Acceptance Criteria**:

- [x] ThinkFork class with 4 branch styles (conservative/aggressive/balanced/contrarian)
- [x] Debate mode where branches argue against each other
- [x] Branch steering for user-directed exploration
- [x] 1,164 lines of implementation (expanded beyond original spec)

---

#### Task 3.3: Parallel Execution

**Time**: 1.5 hours
**File**: `packages/core/src/thinkfork.ts`

**Acceptance Criteria**:

- [x] Branches execute concurrently via Promise.all
- [x] Partial failures handled gracefully
- [x] Key differences identified across branches

---

### Afternoon Session (4 hours)

#### Task 3.4: Contradiction Resolution -- DESCOPED

**Original plan**: Build `contradiction-resolver.ts` for detecting and resolving knowledge conflicts.

**Actual outcome**: Descoped. The `contradictions` database table exists (migration 002) and types are defined in `packages/core/src/types/contradiction.ts`, but no runtime resolver module was built. Development time was redirected to the research features below.

---

#### Task 3.5: Graph of Thoughts (GoT) -- NEW

**File**: `packages/core/src/got-engine.ts`
**Research basis**: [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023)

**Acceptance Criteria**:

- [x] BFS, DFS, and best-first search strategies
- [x] Thought aggregation (merging insights from multiple paths)
- [x] Thought refinement (iterative improvement)
- [x] Arbitrary graph topology support
- [x] State evaluation scoring
- [x] 871 lines of implementation

---

#### Task 3.6: PRM Verifier -- NEW

**File**: `packages/core/src/prm-verifier.ts`
**Research basis**: [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023)

**Acceptance Criteria**:

- [x] Per-step independent correctness scoring
- [x] Natural-language explanations for each step verdict
- [x] Overall chain validity score
- [x] Threshold-based flagging for human review
- [x] 478 lines of implementation

---

#### Task 3.7: Hierarchical Memory -- NEW

**File**: `packages/core/src/memory-hierarchy.ts`
**Research basis**: [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023)

**Acceptance Criteria**:

- [x] Three-tier hierarchy (main context / recall / archival)
- [x] Automatic promotion and demotion between tiers
- [x] Semantic search via Voyage AI embeddings in archival tier
- [x] Context compaction auto-summarization
- [x] 633 lines of implementation

---

#### Task 3.8: Day 3 Integration Test

**Test Cases**:

```typescript
describe('ThinkFork', () => {
  test('creates parallel branches with different assumptions')
  test('executes branches concurrently')
  test('handles partial failures gracefully')
  test('compares conclusions across branches')
  test('records branch selection with rationale')
  test('debate mode produces adversarial evaluation')
  test('branch steering redirects mid-reasoning')
})
```

---

### Day 3 Deliverables

- [x] `packages/core/src/types/think-fork.ts`
- [x] `packages/core/src/thinkfork.ts` (1,164 lines)
- [x] `packages/core/src/got-engine.ts` (871 lines) -- NEW
- [x] `packages/core/src/prm-verifier.ts` (478 lines) -- NEW
- [x] `packages/core/src/memory-hierarchy.ts` (633 lines) -- NEW
- [x] Tests for ThinkFork, GoT, PRM, and Memory features
- ~~`packages/core/src/contradiction-resolver.ts`~~ -- DESCOPED

---

## Day 4: Dashboard UI

> **Goal**: Visual reasoning explorer with real-time thinking stream

### Morning Session (4 hours)

#### Task 4.1: Next.js App Scaffold

**Time**: 1 hour
**Directory**: `apps/web/`

**Configuration**:

- App Router (Next.js 16)
- TypeScript strict mode
- Tailwind CSS 4 with custom theme
- shadcn/ui components
- @xyflow/react (react-flow) for graph visualization
- Supabase client setup

**Acceptance Criteria**:

- [x] App scaffolded with all dependencies
- [x] Build succeeds

---

#### Task 4.2: Layout & Navigation

**Time**: 1 hour
**File**: `apps/web/src/app/layout.tsx`

**Pages created**:

```
apps/web/src/app/
+-- page.tsx              # Dashboard home
+-- reasoning/
|   +-- page.tsx          # Reasoning graph explorer
|   +-- [id]/page.tsx     # Single node detail
+-- insights/
|   +-- page.tsx          # Metacognition insights
+-- fork/
|   +-- page.tsx          # ThinkFork interface
+-- api/
    +-- think/route.ts
    +-- fork/route.ts
    +-- stream/route.ts
    +-- insights/route.ts
    +-- reasoning/route.ts
    +-- got/route.ts
    +-- verify/route.ts
    +-- memory/route.ts
    +-- sessions/route.ts
    +-- reasoning/[id]/checkpoint/route.ts
```

**Acceptance Criteria**:

- [x] Layout with sidebar navigation
- [x] Collapsible sidebars
- [x] All API routes wired up

---

#### Task 4.3: Reasoning Tree Component

**Time**: 2 hours
**File**: `apps/web/src/components/reasoning-tree.tsx`

**Acceptance Criteria**:

- [x] @xyflow/react graph visualization
- [x] Custom ThinkingNodeCard with confidence badge and decision count
- [x] Interactive node click for detail view
- [x] Controls, minimap, and background

---

### Afternoon Session (4 hours)

#### Task 4.4: ThinkFork Viewer

**Time**: 1.5 hours
**File**: `apps/web/src/components/think-fork-viewer.tsx`

**Acceptance Criteria**:

- [x] Side-by-side branch comparison
- [x] Branch selection with rationale dialog
- [x] Recommended branch highlight
- [x] Comparison summary

---

#### Task 4.5: Metacognition Insights Panel

**Time**: 1 hour
**File**: `apps/web/src/components/metacog-insights.tsx`

**Acceptance Criteria**:

- [x] Tabbed display (Patterns / Biases / Improvements)
- [x] "Run Self-Reflection" trigger button
- [x] Insight cards with evidence links

---

#### Task 4.6: Additional Dashboard Panels -- NEW

Beyond the original plan, these panels were added:

- **GoT Panel**: Visualization for Graph of Thoughts reasoning sessions
- **Verification Panel**: PRM step-by-step verification display with per-step scores
- **Memory Panel**: Hierarchical memory tier browser with promotion/demotion controls
- **Demo Tour**: Guided tour for first-time users

**Acceptance Criteria**:

- [x] GoT panel shows thought graph with aggregation/refinement edges
- [x] Verification panel highlights problematic reasoning steps
- [x] Memory panel displays all three tiers with search
- [x] Demo tour guides users through key features

---

#### Task 4.7: Real-Time Thinking Stream

**Time**: 1 hour
**File**: `apps/web/src/components/thinking-stream.tsx`

**Acceptance Criteria**:

- [x] SSE streaming of thinking deltas
- [x] Connection status indicator
- [x] Scrollable thinking display

---

#### Task 4.8: API Routes

**Files**: `apps/web/src/app/api/`

**Routes implemented**:

| Route                             | Method           | Purpose                               | Status   |
| --------------------------------- | ---------------- | ------------------------------------- | -------- |
| `/api/auth`                       | POST             | Authenticate with AUTH_SECRET         | Complete |
| `/api/auth/logout`                | POST             | Clear auth cookie                     | Complete |
| `/api/thinking`                   | POST             | Extended thinking request (canonical) | Complete |
| `/api/thinking/stream`            | POST             | SSE streaming for thinking deltas     | Complete |
| `/api/think`                      | POST             | Extended thinking (alias)             | Complete |
| `/api/stream/[sessionId]`        | GET              | SSE stream (compatibility)            | Complete |
| `/api/fork`                       | POST             | ThinkFork parallel reasoning          | Complete |
| `/api/fork/steer`                 | POST             | Branch steering mid-reasoning         | Complete |
| `/api/got`                        | POST             | Graph of Thoughts reasoning           | Complete |
| `/api/verify`                     | POST             | PRM step-by-step verification         | Complete |
| `/api/sessions`                   | GET/POST         | List or create sessions               | Complete |
| `/api/sessions/[sessionId]`      | GET/PATCH/DELETE | Session CRUD                          | Complete |
| `/api/sessions/[sessionId]/nodes`| GET              | List thinking nodes for session       | Complete |
| `/api/reasoning/[id]`            | GET              | Query ThinkGraph by ID                | Complete |
| `/api/reasoning/[id]/checkpoint` | POST             | Human-in-the-loop checkpoint          | Complete |
| `/api/insights`                   | GET/POST         | Metacognitive insights                | Complete |
| `/api/memory`                     | GET/POST         | Hierarchical memory operations        | Complete |
| `/api/health`                     | GET              | Health check                          | Complete |
| `/api/demo`                       | POST             | Generate demo data                    | Complete |
| `/api/seed`                       | POST             | Seed knowledge base                   | Complete |
| `/api/seed/business-strategy`    | POST             | Seed business strategy scenario       | Complete |

---

### Day 4 Deliverables

- [x] `apps/web/` scaffolded with dependencies
- [x] Layout with navigation and collapsible sidebars
- [x] `reasoning-tree.tsx` with @xyflow/react
- [x] `think-fork-viewer.tsx` with comparison
- [x] `metacog-insights.tsx` with tabs
- [x] `thinking-stream.tsx` with SSE
- [x] GoT panel, verification panel, memory panel -- NEW
- [x] Demo tour component -- NEW
- [x] All API routes (21 routes)
- [x] Input validation on forms
- [x] 37 total components

---

## Day 5+: Polish + Demo

> **Goal**: Compelling demo video and polished submission

### Task 5.1: Demo Script Finalization

**Status**: Complete

**Script Structure** (5 minutes total):

```
0:00-0:30  Hook
"Let me show you something no one else has built - an AI system
where reasoning itself is persistent, queryable, and evolving."

0:30-2:00  ThinkGraph Demo
- Submit complex query
- Show thinking stream in real-time
- Navigate reasoning graph
- Click node to show decision points
- Query: "Why did you decide X?"

2:00-3:00  Metacognition Demo
- Trigger self-reflection
- Show 50k thinking budget in action
- Display detected patterns and biases

3:00-3:45  ThinkFork Demo
- Submit question with "explore approaches"
- Show parallel branches with debate mode
- Compare conclusions, highlight key differences

3:45-4:30  Research Features Demo
- Graph of Thoughts with aggregation
- PRM step-by-step verification
- Memory hierarchy tier browser

4:30-5:00  Wrap-up
- Checkpoint system quick demo
- "Only possible with Opus 4.6"
- Architecture slide
- Thank you
```

---

### Task 5.2: Demo Data Seeding

**Status**: Complete

---

### Task 5.3: Bug Fixes & Polish

**Status**: Complete

**Work completed**:

1. Streaming reliability
2. Graph performance with many nodes
3. ThinkFork timeout handling
4. UI polish (loading states, error handling)
5. Collapsible sidebars
6. Input validation
7. Checkpoint system integration

---

### Task 5.4: Additional Features Built During Polish

The following features were implemented beyond the original Day 5 plan:

- **Dynamic Effort Routing** in orchestrator (auto-classifies task complexity)
- **Context Compaction** in thinking engine (infinite sessions via auto-summarization)
- **Checkpoint System** via `/api/reasoning/[id]/checkpoint` (human-in-the-loop verification)
- **Debate Mode** in ThinkFork (branches argue against each other)
- **Branch Steering** in ThinkFork (user-directed exploration mid-reasoning)

---

### Task 5.5: README Update

**Status**: Complete

---

### Task 5.6: Demo Recording

**Status**: In progress

---

### Task 5.7: Submission

**Checklist**:

- [ ] Demo video uploaded (YouTube/Loom)
- [x] README updated with video embed
- [x] Code pushed to GitHub
- [ ] Dashboard deployed to Vercel
- [ ] Submission form completed at cv.inc/e/claude-code-hackathon
- [x] All team members listed
- [x] Project description (500 words)
- [x] Category selected: "Most Creative Opus 4.6 Exploration"

---

### Day 5+ Deliverables

- [x] Demo script finalized
- [x] Demo data seeded
- [x] Critical bugs fixed
- [x] README updated
- [x] Dynamic Effort Routing implemented -- NEW
- [x] Context Compaction implemented -- NEW
- [x] Checkpoint System implemented -- NEW
- [ ] Demo video recorded and edited
- [ ] Project submitted

---

## Additional Features Beyond Original Plan

The following features were built during the hackathon but were not part of the original 5-day plan. They represent scope expansion driven by research paper implementations and user experience improvements.

### Research-Paper-Backed Features

| Feature             | Module                            | Paper                                                     | Description                                                                                  |
| ------------------- | --------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Graph of Thoughts   | `got-engine.ts` (871 lines)       | [Besta et al., 2023](https://arxiv.org/abs/2308.09687)    | Arbitrary thought graph topology with BFS/DFS/best-first search, aggregation, and refinement |
| PRM Verifier        | `prm-verifier.ts` (478 lines)     | [Lightman et al., 2023](https://arxiv.org/abs/2305.20050) | Step-by-step reasoning verification with per-step correctness scoring                        |
| Hierarchical Memory | `memory-hierarchy.ts` (633 lines) | [Packer et al., 2023](https://arxiv.org/abs/2310.08560)   | Three-tier memory (context/recall/archival) with automatic promotion/demotion                |

### ThinkFork Expansions

| Feature                 | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| Contrarian branch style | Fourth branch type that challenges conventional wisdom                |
| Debate mode             | Branches argue against each other for adversarial evaluation          |
| Branch steering         | Users can redirect a branch mid-reasoning with additional constraints |

### Infrastructure Features

| Feature                | Module                           | Description                                                                  |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Dynamic Effort Routing | `orchestrator.ts`                | Auto-classifies task complexity to set thinking budget (low/medium/high/max) |
| Context Compaction     | `thinking-engine.ts`             | Infinite sessions via auto-summarization when approaching context limits     |
| Checkpoint System      | `/api/reasoning/[id]/checkpoint` | Human-in-the-loop reasoning verification and redirection                     |

### Dashboard UI Additions

| Component            | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| GoT Panel            | Graph of Thoughts visualization with aggregation/refinement edges |
| Verification Panel   | PRM step-by-step verification display with per-step scores        |
| Memory Panel         | Hierarchical memory tier browser with promotion/demotion          |
| Demo Tour            | Guided walkthrough for first-time users                           |
| Collapsible Sidebars | Improved layout flexibility                                       |
| Input Validation     | Form validation across all input components                       |

---

## Risk Mitigation

| Risk                     | Probability | Impact | Mitigation                                                 | Outcome                            |
| ------------------------ | ----------- | ------ | ---------------------------------------------------------- | ---------------------------------- |
| API rate limiting        | Medium      | High   | Pre-test with small budgets, implement exponential backoff | Managed via dynamic effort routing |
| 50k thinking timeout     | Low         | Medium | Set 120s timeout, checkpoint streaming progress            | Handled                            |
| Graph visualization slow | Medium      | Medium | Limit to 50 visible nodes, lazy load details               | Handled                            |
| Streaming drops          | Medium      | Medium | Implement reconnection logic, show connection status       | Handled                            |
| Demo data insufficient   | Low         | High   | Seed data day before, have backup queries ready            | Seeded                             |
| Vercel deployment fails  | Low         | Medium | Test deployment daily, have Railway as backup              | Pending verification               |

---

## Dependencies Graph

```
           Day 1
       ThinkGraph
           |
     +-----+-----+
     |           |
     v           v
   Day 2       Day 3
 Metacog    ThinkFork + GoT + PRM + Memory
     |           |
     +-----+-----+
           |
           v
         Day 4
       Dashboard (37 components)
           |
           v
         Day 5+
     Polish + New Features + Demo
```

**Critical Path**: Day 1 -> Day 2/3 -> Day 4 -> Day 5+

**Parallel Work Opportunities** (realized):

- Day 2 and Day 3 worked in parallel
- Dashboard wireframes started on Day 2
- Demo script drafted on Day 3
- Research features (GoT, PRM, Memory) built in parallel with ThinkFork on Day 3

---

## Token Budget Estimation

| Feature                | Tokens/Call | Calls/Day | Daily Total |
| ---------------------- | ----------- | --------- | ----------- |
| Standard thinking      | ~3k         | 20        | 60k         |
| Metacognition          | ~100k       | 2         | 200k        |
| ThinkFork (4 branches) | ~12k        | 5         | 60k         |
| Graph of Thoughts      | ~15k        | 3         | 45k         |
| PRM Verification       | ~8k         | 5         | 40k         |
| Memory Operations      | ~2k         | 10        | 20k         |
| **Daily Total**        |             |           | **~425k**   |

**7-Day Estimate**: ~3M tokens (within $500 budget with dynamic effort routing)

---

## Filename Reference

Correct filenames for all core modules (some differ from original plan):

| Original Plan               | Actual Filename       | Notes                      |
| --------------------------- | --------------------- | -------------------------- |
| `think-fork.ts`             | `thinkfork.ts`        | No hyphen                  |
| `think-graph.ts`            | `think-graph.ts`      | As planned                 |
| `metacognition.ts`          | `metacognition.ts`    | As planned                 |
| `thinking-engine.ts`        | `thinking-engine.ts`  | As planned                 |
| `orchestrator.ts`           | `orchestrator.ts`     | As planned                 |
| `memory-manager.ts`         | `memory-manager.ts`   | As planned                 |
| `contradiction-resolver.ts` | --                    | Never created (descoped)   |
| `got-engine.ts`             | `got-engine.ts`       | New (not in original plan) |
| `prm-verifier.ts`           | `prm-verifier.ts`     | New (not in original plan) |
| `memory-hierarchy.ts`       | `memory-hierarchy.ts` | New (not in original plan) |

---

*Last Updated: February 8, 2026*
