# Opus Nx: Cognitive Architect

## Product Requirements Document

**Version**: 1.0
**Last Updated**: February 6, 2026
**Author**: Ozzy
**Status**: Active Development
**Hackathon**: Built with Opus 4.6 - Claude Code Hackathon

---

## Executive Summary

Opus Nx is a **Thinking Archaeology Platform** - the first AI system where reasoning is persistent, queryable, and self-improving. While other AI systems treat extended thinking as a black box to improve response quality, Opus Nx transforms reasoning into a first-class, navigable data structure.

**Tagline**: *The first AI system where reasoning itself is persistent, queryable, and evolving*

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
- **Transparent Resolution**: Contradictions resolved through visible deliberation

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
| "AI said X" | "AI reasoned A→B→C to conclude X" |
| Response quality focus | Cognitive visibility focus |
| Assistant paradigm | Peer-level metacognition |

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

### 3.1 ThinkGraph - Reasoning as Data Structure

**Description**
Every extended thinking session creates a persistent, navigable graph node with structured reasoning chains, confidence scores, decision points, and alternative paths considered.

**User Stories**

| ID | Story | Priority |
|----|-------|----------|
| US-1.1 | As a user, I can see a visual graph of all reasoning nodes from my sessions | P0 |
| US-1.2 | As a user, I can click on any node to see the full reasoning chain | P0 |
| US-1.3 | As a user, I can search past reasoning with natural language queries | P1 |
| US-1.4 | As a user, I can see what alternatives were considered and rejected | P0 |
| US-1.5 | As a user, I can trace how one reasoning session influenced another | P1 |
| US-1.6 | As a user, I can export reasoning graphs for external analysis | P2 |

**Acceptance Criteria**

- [ ] Thinking blocks parsed into structured JSON with decision points
- [ ] Each decision point captures: description, chosen path, alternatives, confidence
- [ ] Graph stored in PostgreSQL with efficient traversal queries
- [ ] Real-time streaming of thinking to UI during inference
- [ ] Search returns relevant reasoning nodes with similarity scores
- [ ] Graph visualization renders up to 100 nodes performantly

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

### 3.2 Metacognitive Self-Audit

**Description**
Using the maximum 50k thinking token budget, the system analyzes its own reasoning patterns across multiple sessions to identify biases, recurring strategies, and improvement opportunities.

**User Stories**

| ID | Story | Priority |
|----|-------|----------|
| US-2.1 | As a user, I can trigger a "self-reflection" that analyzes recent reasoning | P0 |
| US-2.2 | As a user, I can see identified patterns in the AI's thinking | P0 |
| US-2.3 | As a user, I can see identified biases with supporting evidence | P0 |
| US-2.4 | As a user, I can view improvement hypotheses generated by the AI | P1 |
| US-2.5 | As a user, I can see reasoning templates the AI has learned | P2 |
| US-2.6 | As a user, I can configure how often self-reflection runs | P2 |

**Acceptance Criteria**

- [ ] Metacognition uses maximum (50k) thinking budget
- [ ] Analysis reviews at least 10-20 recent thinking nodes
- [ ] Patterns extracted with confidence scores
- [ ] Bias types identified: confirmation, anchoring, recency, etc.
- [ ] Each bias linked to evidence (specific reasoning nodes)
- [ ] Insights displayed in dashboard with actionable format
- [ ] Self-reflection completes in under 90 seconds

**Insight Types**

| Type | Description | Example |
|------|-------------|---------|
| `bias_detection` | Systematic reasoning bias | "Tendency to favor conservative estimates when facing uncertainty" |
| `pattern` | Recurring reasoning strategy | "Often breaks complex problems into 3-5 sub-problems" |
| `improvement_hypothesis` | Self-improvement suggestion | "Could improve by considering more contrarian viewpoints" |

---

### 3.3 ThinkFork - Parallel Reasoning Branches

**Description**
Complex decisions spawn 2-3 parallel reasoning branches with different assumptions, allowing users to compare conclusions and their full reasoning paths before selecting one.

**User Stories**

| ID | Story | Priority |
|----|-------|----------|
| US-3.1 | As a user, I can request "explore multiple approaches" for a question | P0 |
| US-3.2 | As a user, I can see 2-3 parallel branches with different conclusions | P0 |
| US-3.3 | As a user, I can compare assumptions between branches side-by-side | P0 |
| US-3.4 | As a user, I can select a branch to continue with and record my rationale | P1 |
| US-3.5 | As a user, I can see confidence scores for each branch | P0 |
| US-3.6 | As a user, I can ask for a synthesis of best elements from all branches | P2 |

**Acceptance Criteria**

- [ ] Parallel API calls execute concurrently (Promise.all)
- [ ] Each branch receives different assumption framing
- [ ] Results displayed side-by-side with visual diff of conclusions
- [ ] Confidence scores calculated per branch
- [ ] Branch selection persists with user's rationale
- [ ] Partial failures handled gracefully (show completed branches)

**Branch Types**

| Branch | Assumption Frame | Use Case |
|--------|------------------|----------|
| Conservative | Risk-averse, proven approaches | High-stakes decisions |
| Aggressive | Optimistic, innovative approaches | Growth opportunities |
| Balanced | Synthesis of trade-offs | Default recommendation |
| Contrarian | Challenge conventional wisdom | Avoiding groupthink |

---

### 3.4 Contradiction Resolution Engine

**Description**
When new information conflicts with existing knowledge, the system uses extended thinking to analyze and resolve the contradiction with a full audit trail.

**User Stories**

| ID | Story | Priority |
|----|-------|----------|
| US-4.1 | As a user, I'm notified when new info contradicts existing knowledge | P0 |
| US-4.2 | As a user, I can see the reasoning behind resolution decisions | P0 |
| US-4.3 | As a user, I can override automatic resolutions | P1 |
| US-4.4 | As a user, I can query history of all contradictions and resolutions | P1 |
| US-4.5 | As a user, I can see how resolutions affected dependent knowledge | P2 |

**Acceptance Criteria**

- [ ] Contradictions detected during knowledge retrieval/storage
- [ ] Detection uses semantic similarity, not just exact matching
- [ ] Extended thinking analyzes both pieces of information
- [ ] Resolution stored with full reasoning chain
- [ ] Knowledge graph updated with provenance metadata
- [ ] User can mark resolutions for review

**Resolution Types**

| Resolution | Description | When Used |
|------------|-------------|-----------|
| `favor_a` | Original knowledge correct | New info unreliable source |
| `favor_b` | New knowledge correct | More recent, better sourced |
| `synthesized` | Both partially correct | Nuance reconciles conflict |
| `unresolved` | Cannot determine | Flagged for human review |

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

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feature completion | 4/4 core features | Checklist |
| Demo quality | Compelling 5-min video | Judge feedback |
| Technical depth | Novel Opus 4.6 usage | Code review |
| Prize positioning | "Most Creative Opus 4.6 Exploration" | Submission |

### 5.2 Product Metrics (Post-Hackathon)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first insight | < 5 reasoning sessions | User testing |
| Graph engagement | 3+ nodes explored per session | Analytics |
| Metacognition value | Insights rated useful 4+/5 | User survey |
| Contradiction resolution accuracy | 80%+ correct resolutions | Human review |

---

## 6. Technical Constraints

### 6.1 API Limitations

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| $500 API credits | ~1M tokens budget | Efficient prompting, caching |
| Rate limits | Concurrent call limits | Queue management |
| 50k thinking max | Metacognition depth | Prioritize node selection |
| Response timeouts | Long thinking times | Extended timeouts, streaming |

### 6.2 Technology Choices (Locked)

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Model | Claude Opus 4.6 | Extended thinking, hackathon requirement |
| Database | Supabase (PostgreSQL) | Already configured, pgvector |
| Embeddings | Voyage AI (voyage-3) | Already configured, 1024-dim |
| Frontend | Next.js 16 | Modern React, streaming support |
| Styling | Tailwind + shadcn/ui | Rapid development |
| Monorepo | Turborepo + pnpm | Already configured |

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

## 9. Glossary

| Term | Definition |
|------|------------|
| **ThinkGraph** | Persistent graph structure storing reasoning nodes and their relationships |
| **Metacognition** | AI analyzing its own reasoning patterns across sessions |
| **ThinkFork** | Parallel execution of reasoning branches with different assumptions |
| **Thinking Node** | Single reasoning session stored as a graph node |
| **Decision Point** | Specific point in reasoning where alternatives were considered |
| **Reasoning Edge** | Relationship between thinking nodes (influences, contradicts, supports) |
| **Contradiction Resolution** | Process of reconciling conflicting knowledge with audit trail |
| **Extended Thinking** | Claude Opus 4.6's ability to "think" with configurable token budgets |
| **Thinking Archaeology** | The practice of exploring and querying past reasoning chains |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 6, 2026 | Ozzy | Initial PRD for hackathon |

---

## Appendix A: User Flow Diagrams

### A.1 Standard Thinking Request

```
User submits query
        │
        ▼
┌───────────────────┐
│  Orchestrator     │
│  retrieves        │
│  knowledge        │
│  context          │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  ThinkingEngine   │
│  executes with    │◄──── Stream thinking to UI
│  extended thinking│
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  ThinkGraph       │
│  parses and       │
│  persists node    │
└────────┬──────────┘
         │
         ▼
Return response + thinking node ID
```

### A.2 Metacognition Flow

```
User triggers self-reflection
        │
        ▼
┌───────────────────┐
│  Load recent      │
│  thinking nodes   │
│  (10-20)          │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  ThinkingEngine   │
│  with 50k budget  │
│  analyzes patterns│
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Parse insights:  │
│  - Patterns       │
│  - Biases         │
│  - Improvements   │
└────────┬──────────┘
         │
         ▼
Store insights, display in dashboard
```

---

*This PRD is a living document and will be updated as development progresses.*
