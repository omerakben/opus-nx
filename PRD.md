# Opus Nx: Cognitive Architect

## Product Requirements Document

**Version**: 2.0
**Last Updated**: February 8, 2026
**Author**: Ozzy
**Status**: Hackathon Build Complete
**Hackathon**: Built with Opus 4.6 - Claude Code Hackathon (Cerebral Valley, Feb 10-16, 2026)

---

## Executive Summary

Opus Nx is a **Thinking Archaeology Platform** - the first AI system where reasoning is persistent, queryable, and self-improving. While other AI systems treat extended thinking as a black box to improve response quality, Opus Nx transforms reasoning into a first-class, navigable data structure.

**Tagline**: *The first AI system where reasoning itself is persistent, queryable, and evolving*

---

## Implementation Status

| Feature | Status | Module | Lines |
|---------|--------|--------|-------|
| ThinkGraph | Implemented | `think-graph.ts` | 936 |
| Metacognitive Self-Audit | Implemented | `metacognition.ts` | 620 |
| ThinkFork (4 styles + debate) | Implemented (expanded) | `thinkfork.ts` | 1,165 |
| Contradiction Resolution | **Descoped** | -- | -- |
| Graph of Thoughts | Implemented (new) | `got-engine.ts` | 872 |
| PRM Verifier | Implemented (new) | `prm-verifier.ts` | 479 |
| Hierarchical Memory | Implemented (new) | `memory-hierarchy.ts` | 634 |
| Dynamic Effort Routing | Implemented (new) | `orchestrator.ts` | -- |
| Context Compaction | Implemented (new) | `thinking-engine.ts` | -- |
| Checkpoint System | Implemented (new) | `/api/reasoning/[id]/checkpoint` | -- |
| Dashboard UI (37 components) | Implemented | `apps/web/` | -- |

---

## 1. Vision & Problem Statement

### 1.1 The Problem

Current AI systems treat reasoning as a hidden, ephemeral process:

| Current State | Impact |
|---------------|--------|
| Reasoning disappears after each response | No ability to learn from past decisions |
| Users receive answers without context | "Black box" AI creates trust issues |
| No query capability over past reasoning | Missed insights from reasoning patterns |
| Contradictions silently overwritten | No audit trail for knowledge changes |
| Each session starts fresh | AI can't improve its own thinking |

### 1.2 The Vision

Opus Nx transforms AI reasoning from a black box into a transparent, persistent, and self-improving cognitive infrastructure:

- **Reasoning as Data**: Every thinking chain becomes a queryable graph node
- **Metacognitive Self-Audit**: The AI analyzes its own reasoning patterns
- **Parallel Exploration**: Users see multiple reasoning paths before choosing
- **Graph-Structured Thought**: Reasoning follows arbitrary graph topologies, not just linear chains
- **Step-by-Step Verification**: Each reasoning step independently verified for correctness
- **Persistent Memory**: Three-tier memory hierarchy enables infinite-length sessions

### 1.3 Why Now

Claude Opus 4.6 introduces capabilities that make this possible for the first time:

| Capability | Opus 4.6 Spec | Enables |
|------------|---------------|---------|
| Extended Thinking | Up to 50k tokens | Deep metacognitive analysis |
| Context Window | 200k tokens | Multi-session reasoning review |
| Thinking Signatures | Cryptographic | Verification of reasoning authenticity |
| Superior Instruction Following | Best in class | Complex meta-cognitive prompts |

### 1.4 Differentiation

| Other AI Systems | Opus Nx: Cognitive Architect |
|------------------|------------------------------|
| Stateless conversations | Persistent reasoning graph |
| Extended thinking as quality boost | Extended thinking as product |
| "AI said X" | "AI reasoned A->B->C to conclude X" |
| Response quality focus | Cognitive visibility focus |
| Assistant paradigm | Peer-level metacognition |
| Linear chain-of-thought | Graph of Thoughts with aggregation |
| No verification | Step-by-step process verification |
| Single-session memory | Three-tier hierarchical memory |

---

## 2. Target Users

### 2.1 Primary: AI Researchers & Engineers

**Profile**: Building explainable AI systems, researching reasoning patterns

**Needs**:
- Audit trails for AI decisions
- Understanding of model reasoning patterns
- Reproducible reasoning chains
- Bias detection in AI outputs

**Value Proposition**: First platform enabling systematic study of LLM reasoning

### 2.2 Secondary: Knowledge Workers

**Profile**: Analysts, researchers, strategists making complex decisions

**Needs**:
- Transparent AI assistance for high-stakes decisions
- Ability to explore "what if" scenarios
- Understanding of why AI recommended specific actions
- Confidence levels for AI conclusions

**Value Proposition**: See how the AI thinks, not just what it concludes

### 2.3 Tertiary: Enterprise Compliance

**Profile**: Regulated industries requiring AI explainability

**Needs**:
- Decision provenance for auditors
- Reasoning trails for compliance
- Contradiction resolution records
- Verifiable AI decision-making

**Value Proposition**: Full audit trail for AI-assisted decisions

---

## 3. Core Features

### 3.1 ThinkGraph - Reasoning as Data Structure -- IMPLEMENTED

**Status**: Fully implemented in `packages/core/src/think-graph.ts` (936 lines)

**Description**
Every extended thinking session creates a persistent, navigable graph node with structured reasoning chains, confidence scores, decision points, and alternative paths considered.

**User Stories**

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-1.1 | As a user, I can see a visual graph of all reasoning nodes from my sessions | P0 | Done |
| US-1.2 | As a user, I can click on any node to see the full reasoning chain | P0 | Done |
| US-1.3 | As a user, I can search past reasoning with natural language queries | P1 | Done |
| US-1.4 | As a user, I can see what alternatives were considered and rejected | P0 | Done |
| US-1.5 | As a user, I can trace how one reasoning session influenced another | P1 | Done |
| US-1.6 | As a user, I can export reasoning graphs for external analysis | P2 | Not started |

**Acceptance Criteria**

- [x] Thinking blocks parsed into structured JSON with decision points
- [x] Each decision point captures: description, chosen path, alternatives, confidence
- [x] Graph stored in PostgreSQL with efficient traversal queries
- [x] Real-time streaming of thinking to UI during inference
- [x] Search returns relevant reasoning nodes with similarity scores
- [x] Graph visualization renders up to 100 nodes performantly

**Technical Notes**

```typescript
interface ThinkingNode {
  id: string;
  sessionId: string;
  parentNodeId?: string;
  reasoning: string;
  structuredReasoning: {
    steps: ReasoningStep[];
    decisionPoints: DecisionPoint[];
    confidence: number;
  };
  signature: string;  // Anthropic thinking signature
  createdAt: Date;
}

interface DecisionPoint {
  stepNumber: number;
  description: string;
  chosenPath: string;
  alternatives: Array<{ path: string; reasonRejected: string }>;
  confidence: number;
}
```

---

### 3.2 Metacognitive Self-Audit -- IMPLEMENTED

**Status**: Fully implemented in `packages/core/src/metacognition.ts` (620 lines)

**Description**
Using the maximum 50k thinking token budget, the system analyzes its own reasoning patterns across multiple sessions to identify biases, recurring strategies, and improvement opportunities.

**User Stories**

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-2.1 | As a user, I can trigger a "self-reflection" that analyzes recent reasoning | P0 | Done |
| US-2.2 | As a user, I can see identified patterns in the AI's thinking | P0 | Done |
| US-2.3 | As a user, I can see identified biases with supporting evidence | P0 | Done |
| US-2.4 | As a user, I can view improvement hypotheses generated by the AI | P1 | Done |
| US-2.5 | As a user, I can see reasoning templates the AI has learned | P2 | Not started |
| US-2.6 | As a user, I can configure how often self-reflection runs | P2 | Not started |

**Acceptance Criteria**

- [x] Metacognition uses maximum (50k) thinking budget
- [x] Analysis reviews at least 10-20 recent thinking nodes
- [x] Patterns extracted with confidence scores
- [x] Bias types identified: confirmation, anchoring, recency, etc.
- [x] Each bias linked to evidence (specific reasoning nodes)
- [x] Insights displayed in dashboard with actionable format
- [ ] Self-reflection completes in under 90 seconds

**Insight Types**

| Type | Description | Example |
|------|-------------|---------|
| `bias_detection` | Systematic reasoning bias | "Tendency to favor conservative estimates when facing uncertainty" |
| `pattern` | Recurring reasoning strategy | "Often breaks complex problems into 3-5 sub-problems" |
| `improvement_hypothesis` | Self-improvement suggestion | "Could improve by considering more contrarian viewpoints" |

---

### 3.3 ThinkFork - Parallel Reasoning Branches -- IMPLEMENTED (EXPANDED)

**Status**: Fully implemented and expanded in `packages/core/src/thinkfork.ts` (1,165 lines)

**Note**: The original spec called for 2-3 branches with 3 styles (conservative/aggressive/balanced). The implementation expanded to 4 styles by adding **contrarian**, and introduced **debate mode** (branches argue against each other) and **branch steering** (users can redirect a branch mid-reasoning). The actual filename is `thinkfork.ts` (no hyphen), not `think-fork.ts` as originally planned.

**Description**
Complex decisions spawn parallel reasoning branches with different assumptions, allowing users to compare conclusions and their full reasoning paths before selecting one. Includes debate mode for adversarial evaluation and steering for interactive exploration.

**User Stories**

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-3.1 | As a user, I can request "explore multiple approaches" for a question | P0 | Done |
| US-3.2 | As a user, I can see 2-4 parallel branches with different conclusions | P0 | Done |
| US-3.3 | As a user, I can compare assumptions between branches side-by-side | P0 | Done |
| US-3.4 | As a user, I can select a branch to continue with and record my rationale | P1 | Done |
| US-3.5 | As a user, I can see confidence scores for each branch | P0 | Done |
| US-3.6 | As a user, I can ask for a synthesis of best elements from all branches | P2 | Done |
| US-3.7 | As a user, I can trigger debate mode where branches argue against each other | P1 | Done (new) |
| US-3.8 | As a user, I can steer a branch mid-reasoning with additional constraints | P1 | Done (new) |

**Acceptance Criteria**

- [x] Parallel API calls execute concurrently (Promise.all)
- [x] Each branch receives different assumption framing
- [x] Results displayed side-by-side with visual diff of conclusions
- [x] Confidence scores calculated per branch
- [x] Branch selection persists with user's rationale
- [x] Partial failures handled gracefully (show completed branches)

**Branch Types**

| Branch | Assumption Frame | Use Case |
|--------|------------------|----------|
| Conservative | Risk-averse, proven approaches | High-stakes decisions |
| Aggressive | Optimistic, innovative approaches | Growth opportunities |
| Balanced | Synthesis of trade-offs | Default recommendation |
| Contrarian | Challenge conventional wisdom | Avoiding groupthink |

---

### 3.4 Contradiction Resolution Engine -- DESCOPED

**Status**: Descoped from hackathon build.

**What exists**: The `contradictions` database table was created in migration 002 (`supabase/migrations/`) with schema for tracking knowledge conflicts, resolution types, and audit trails. The contradiction types are defined in `packages/core/src/types/contradiction.ts`.

**What was NOT built**: No `contradiction-resolver.ts` module was implemented. There is no runtime logic for detecting contradictions during knowledge storage, analyzing contradiction severity, resolving conflicts via extended thinking, or applying resolutions to the knowledge graph.

**Reason for descoping**: Development time was redirected toward three research-paper-backed features (Graph of Thoughts, PRM Verification, and Hierarchical Memory) that provided stronger differentiation for the hackathon submission. The database schema is preserved for future implementation.

**Original Description**
When new information conflicts with existing knowledge, the system uses extended thinking to analyze and resolve the contradiction with a full audit trail.

**Original User Stories** (not implemented)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-4.1 | As a user, I'm notified when new info contradicts existing knowledge | P0 | Not built |
| US-4.2 | As a user, I can see the reasoning behind resolution decisions | P0 | Not built |
| US-4.3 | As a user, I can override automatic resolutions | P1 | Not built |
| US-4.4 | As a user, I can query history of all contradictions and resolutions | P1 | Not built |
| US-4.5 | As a user, I can see how resolutions affected dependent knowledge | P2 | Not built |

**Original Acceptance Criteria** (not implemented)

- [ ] Contradictions detected during knowledge retrieval/storage
- [ ] Detection uses semantic similarity, not just exact matching
- [ ] Extended thinking analyzes both pieces of information
- [ ] Resolution stored with full reasoning chain
- [ ] Knowledge graph updated with provenance metadata
- [ ] User can mark resolutions for review

**Resolution Types** (defined in schema only)

| Resolution | Description | When Used |
|------------|-------------|-----------|
| `favor_a` | Original knowledge correct | New info unreliable source |
| `favor_b` | New knowledge correct | More recent, better sourced |
| `synthesized` | Both partially correct | Nuance reconciles conflict |
| `unresolved` | Cannot determine | Flagged for human review |

---

### 3.5 Graph of Thoughts (GoT) -- IMPLEMENTED (NEW)

**Status**: Fully implemented in `packages/core/src/got-engine.ts` (872 lines). Not in original PRD.

**Research basis**: [Graph of Thoughts: Solving Elaborate Problems with Large Language Models](https://arxiv.org/abs/2308.09687) (Besta et al., 2023)

**Description**
Extends reasoning beyond linear chains and simple trees into arbitrary graph topologies. Thought nodes can be aggregated (combining insights from multiple paths), refined (iteratively improving a single thought), and searched using BFS, DFS, or best-first strategies. This enables the system to model complex reasoning structures where ideas from separate branches merge, split, and loop back.

**User Stories**

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-5.1 | As a user, I can initiate a GoT reasoning session for complex problems | P0 | Done |
| US-5.2 | As a user, I can see the thought graph with aggregation and refinement edges | P0 | Done |
| US-5.3 | As a user, I can select a search strategy (BFS, DFS, best-first) | P1 | Done |
| US-5.4 | As a user, I can view the final aggregated conclusion from multiple thought paths | P0 | Done |

**Acceptance Criteria**

- [x] BFS, DFS, and best-first search strategies implemented
- [x] Thought aggregation merges insights from multiple graph branches
- [x] Thought refinement iteratively improves individual nodes
- [x] Graph topology supports arbitrary connections (not just tree edges)
- [x] State evaluation scores each thought node for search prioritization
- [x] API route available at `/api/got`

**Technical Notes**

The GoT engine implements three core operations from the paper:
1. **Generate**: Create new thoughts from existing ones
2. **Aggregate**: Merge multiple thoughts into a unified insight
3. **Refine**: Iteratively improve a thought based on evaluation feedback

Search strategies control exploration order. Best-first search uses a scored priority queue, making it the recommended default for most use cases.

---

### 3.6 Process Reward Model (PRM) Verification -- IMPLEMENTED (NEW)

**Status**: Fully implemented in `packages/core/src/prm-verifier.ts` (479 lines). Not in original PRD.

**Research basis**: [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023)

**Description**
Implements process supervision by verifying each individual step in a reasoning chain rather than only evaluating the final answer. Each step receives an independent correctness score, enabling early detection of reasoning errors and providing granular feedback on where a chain of thought goes wrong.

**User Stories**

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-6.1 | As a user, I can submit a reasoning chain for step-by-step verification | P0 | Done |
| US-6.2 | As a user, I can see per-step correctness scores with explanations | P0 | Done |
| US-6.3 | As a user, I can identify the exact step where reasoning diverged | P0 | Done |
| US-6.4 | As a user, I can view an overall chain validity score | P1 | Done |

**Acceptance Criteria**

- [x] Each reasoning step scored independently (not just the final answer)
- [x] Per-step verification explains why a step is correct or incorrect
- [x] Overall chain score aggregated from individual step scores
- [x] Visualization highlights problematic steps in the dashboard
- [x] API route available at `/api/verify`

**Technical Notes**

The PRM verifier operates as a "judge" model call. For each step in a reasoning chain, it evaluates:
- **Logical validity**: Does this step follow from the previous one?
- **Factual accuracy**: Are the claims in this step correct?
- **Relevance**: Does this step contribute to answering the original question?

Each step receives a score and a natural-language explanation. Steps scoring below a threshold are flagged for user review.

---

### 3.7 Hierarchical Memory (MemGPT-inspired) -- IMPLEMENTED (NEW)

**Status**: Fully implemented in `packages/core/src/memory-hierarchy.ts` (634 lines). Not in original PRD.

**Research basis**: [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560) (Packer et al., 2023)

**Description**
Implements a three-tier memory hierarchy inspired by operating system virtual memory management. This enables the system to maintain coherent context across sessions that far exceed the model's context window, automatically promoting and demoting information between tiers based on relevance and recency.

**Memory Tiers**

| Tier | Name | Capacity | Latency | Purpose |
|------|------|----------|---------|---------|
| L1 | Main Context | Model context window | Instant | Currently active reasoning context |
| L2 | Recall Memory | Bounded buffer | Low | Recently used facts and reasoning summaries |
| L3 | Archival Memory | Unbounded (Supabase + pgvector) | Medium | Full history, semantic search retrieval |

**User Stories**

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-7.1 | As a user, I can have sessions that exceed the context window without losing information | P0 | Done |
| US-7.2 | As a user, I can see what information is in each memory tier | P1 | Done |
| US-7.3 | As a user, I can manually promote or pin information to active context | P1 | Done |
| US-7.4 | As a user, I can search archival memory with natural language | P0 | Done |

**Acceptance Criteria**

- [x] Three-tier memory hierarchy (context / recall / archival) implemented
- [x] Automatic promotion and demotion between tiers based on relevance
- [x] Archival memory uses Voyage AI embeddings for semantic search
- [x] Context compaction auto-summarizes when approaching context limits
- [x] Memory panel in dashboard shows tier contents
- [x] API route available at `/api/memory`

---

### 3.8 Dynamic Effort Routing & Context Compaction -- IMPLEMENTED (NEW)

**Status**: Implemented within `packages/core/src/orchestrator.ts` and `packages/core/src/thinking-engine.ts`. Not in original PRD.

**Description**
Two complementary features that optimize token usage and enable unbounded sessions:

**Dynamic Effort Routing** automatically classifies incoming task complexity and routes to the appropriate thinking effort level (`low` | `medium` | `high` | `max`). Simple factual questions use minimal thinking budget while complex analytical tasks receive the full 50k token allocation. This reduces API costs without sacrificing reasoning quality where it matters.

**Context Compaction** enables infinite-length sessions by automatically summarizing older context when approaching the model's context window limit. Instead of truncating history, the system compresses earlier exchanges into dense summaries that preserve key facts, decisions, and reasoning outcomes.

**Acceptance Criteria**

- [x] Task complexity classifier routes to appropriate effort level
- [x] Simple queries use `low` effort (minimal thinking tokens)
- [x] Complex analytical tasks escalate to `max` effort (50k tokens)
- [x] Context compaction triggers before hitting context window limit
- [x] Summaries preserve decision points and key reasoning outcomes
- [x] Session continuity maintained across compaction boundaries

---

### 3.9 Checkpoint System -- IMPLEMENTED (NEW)

**Status**: Implemented via `/api/reasoning/[id]/checkpoint` API route. Not in original PRD.

**Description**
Human-in-the-loop verification system that allows users to pause reasoning at specific points, review the current state, and approve or redirect before the system continues. Provides a mechanism for collaborative reasoning where the human maintains oversight of the AI's thought process.

**Acceptance Criteria**

- [x] Users can set checkpoints on reasoning nodes
- [x] Reasoning pauses at checkpoint for human review
- [x] Users can approve, modify, or redirect at each checkpoint
- [x] Checkpoint history preserved as part of the reasoning audit trail

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Thinking streaming latency | < 100ms from API to UI |
| NFR-2 | Graph traversal queries | < 200ms for depth 3 |
| NFR-3 | ThinkFork parallel execution | Concurrent, not sequential |
| NFR-4 | Dashboard initial load | < 2 seconds |
| NFR-5 | Reasoning node search | < 500ms for 10k nodes |

### 4.2 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-6 | Thinking nodes per user | Support 10k+ |
| NFR-7 | Graph query complexity | O(log n) with HNSW index |
| NFR-8 | Concurrent API calls | 10+ for ThinkFork |

### 4.3 Security

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-9 | API key storage | Environment variables only |
| NFR-10 | Data isolation | Row-level security on Supabase |
| NFR-11 | Thinking verification | Anthropic signatures validated |
| NFR-12 | No secrets in code | .env excluded from git |

### 4.4 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-13 | API error handling | Graceful degradation |
| NFR-14 | Partial ThinkFork failure | Show completed branches |
| NFR-15 | Stream interruption | Resume capability |

---

## 5. Success Metrics

### 5.1 Hackathon Success (Primary)

| Metric | Target | Status |
|--------|--------|--------|
| Core feature completion | 3/4 original + 4 new features | 7 features shipped |
| Demo quality | Compelling 5-min video | In progress |
| Technical depth | Novel Opus 4.6 usage | 4 research papers implemented |
| Prize positioning | "Most Creative Opus 4.6 Exploration" | Submitted |

### 5.2 Product Metrics (Post-Hackathon)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first insight | < 5 reasoning sessions | User testing |
| Graph engagement | 3+ nodes explored per session | Analytics |
| Metacognition value | Insights rated useful 4+/5 | User survey |
| PRM verification accuracy | Correct step flagging 80%+ | Human review |

---

## 6. Technical Constraints

### 6.1 API Limitations

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| $500 API credits | ~1M tokens budget | Efficient prompting, caching, dynamic effort routing |
| Rate limits | Concurrent call limits | Queue management |
| 50k thinking max | Metacognition depth | Prioritize node selection |
| Response timeouts | Long thinking times | Extended timeouts, streaming |

### 6.2 Technology Choices (Locked)

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Model | Claude Opus 4.6 | Extended thinking, hackathon requirement |
| Database | Supabase (PostgreSQL + pgvector) | Already configured, HNSW indexes |
| Embeddings | Voyage AI (voyage-3, 1024-dim) | Already configured |
| Frontend | Next.js 16, React 19 | Modern React, streaming support |
| Styling | Tailwind CSS 4 + shadcn/ui | Rapid development |
| Visualization | @xyflow/react (react-flow) | Graph rendering |
| Monorepo | Turborepo + pnpm | Already configured |
| Agents | LangChain + LangGraph | Agent orchestration |

---

## 7. Out of Scope (v1.0)

The following features are explicitly NOT included in the hackathon version:

- Multi-user collaboration on reasoning graphs
- Third-party model support (Opus 4.6 only)
- Mobile application
- Real-time voice interface
- Integration with external knowledge bases (Notion, Confluence, etc.)
- Custom model fine-tuning
- On-premise deployment
- HIPAA/SOC2 compliance features
- Multi-language support
- Automated testing of reasoning quality
- **Contradiction Resolution Engine** (descoped; see Section 3.4)

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API rate limiting | Medium | High | Pre-test with small budgets, implement backoff |
| 50k thinking timeout | Low | Medium | Extended timeouts, checkpoint streaming |
| Graph visualization performance | Medium | Medium | Limit visible nodes, lazy loading |
| Supabase cold starts | Low | Low | Connection pooling, keep-alive |
| Complex parsing failures | Medium | Medium | Fallback to raw text, graceful degradation |

---

## 9. Research Foundation

Opus Nx implements algorithms from four foundational papers:

| Paper | Module | Key Contribution |
|-------|--------|-----------------|
| [Tree of Thoughts](https://arxiv.org/abs/2305.10601) (Yao et al., 2023) | `thinkfork.ts`, `got-engine.ts` | BFS/DFS search over reasoning trees with state evaluation |
| [Graph of Thoughts](https://arxiv.org/abs/2308.09687) (Besta et al., 2023) | `got-engine.ts` | Arbitrary thought graph topology with aggregation and refinement |
| [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) (Lightman et al., 2023) | `prm-verifier.ts` | Process supervision -- verify each reasoning step independently |
| [MemGPT](https://arxiv.org/abs/2310.08560) (Packer et al., 2023) | `memory-hierarchy.ts` | 3-tier memory hierarchy (main context / recall / archival) |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **ThinkGraph** | Persistent graph structure storing reasoning nodes and their relationships |
| **Metacognition** | AI analyzing its own reasoning patterns across sessions |
| **ThinkFork** | Parallel execution of reasoning branches with different assumptions |
| **Thinking Node** | Single reasoning session stored as a graph node |
| **Decision Point** | Specific point in reasoning where alternatives were considered |
| **Reasoning Edge** | Relationship between thinking nodes (influences, contradicts, supports) |
| **Graph of Thoughts (GoT)** | Reasoning over arbitrary graph topologies with aggregation and refinement |
| **PRM Verifier** | Process Reward Model that scores each reasoning step independently |
| **Hierarchical Memory** | Three-tier memory system (context/recall/archival) for unbounded sessions |
| **Dynamic Effort Routing** | Automatic classification of task complexity to set thinking budget |
| **Context Compaction** | Auto-summarization of older context to enable infinite sessions |
| **Checkpoint** | Human-in-the-loop pause point for reviewing and redirecting reasoning |
| **Contradiction Resolution** | Process of reconciling conflicting knowledge with audit trail (descoped) |
| **Extended Thinking** | Claude Opus 4.6's ability to "think" with configurable token budgets |
| **Thinking Archaeology** | The practice of exploring and querying past reasoning chains |

---

## 11. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 6, 2026 | Ozzy | Initial PRD for hackathon |
| 2.0 | Feb 8, 2026 | Ozzy | Updated to reflect actual build: marked feature statuses, descoped Contradiction Resolution (Section 3.4), added Graph of Thoughts (3.5), PRM Verification (3.6), Hierarchical Memory (3.7), Dynamic Effort Routing & Context Compaction (3.8), Checkpoint System (3.9), Research Foundation (Section 9), updated acceptance criteria checkboxes, corrected filenames and tech stack |

---

## Appendix A: User Flow Diagrams

### A.1 Standard Thinking Request

```
User submits query
        |
        v
+-------------------+
|  Orchestrator     |
|  classifies       |
|  complexity &     |
|  retrieves        |
|  knowledge        |
|  context          |
+--------+----------+
         |
         v
+-------------------+
|  ThinkingEngine   |
|  executes with    |<---- Stream thinking to UI
|  dynamic effort   |
|  level            |
+--------+----------+
         |
         v
+-------------------+
|  ThinkGraph       |
|  parses and       |
|  persists node    |
+--------+----------+
         |
         v
Return response + thinking node ID
```

### A.2 Metacognition Flow

```
User triggers self-reflection
        |
        v
+-------------------+
|  Load recent      |
|  thinking nodes   |
|  (10-20)          |
+--------+----------+
         |
         v
+-------------------+
|  ThinkingEngine   |
|  with 50k budget  |
|  analyzes patterns|
+--------+----------+
         |
         v
+-------------------+
|  Parse insights:  |
|  - Patterns       |
|  - Biases         |
|  - Improvements   |
+--------+----------+
         |
         v
Store insights, display in dashboard
```

### A.3 Graph of Thoughts Flow

```
User submits complex problem
        |
        v
+-------------------+
|  GoT Engine       |
|  selects search   |
|  strategy         |
+--------+----------+
         |
    +----+----+
    |    |    |
    v    v    v
  BFS  DFS  Best-first
    |    |    |
    +----+----+
         |
         v
+-------------------+
|  Generate ->      |
|  Evaluate ->      |
|  Aggregate ->     |
|  Refine           |
+--------+----------+
         |
         v
Return aggregated conclusion + full thought graph
```

---

*This PRD is a living document. Version 2.0 reflects the actual state of the codebase as of February 8, 2026.*
