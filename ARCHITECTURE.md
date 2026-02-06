# Opus Nx: Technical Architecture

**Version**: 1.0
**Last Updated**: February 6, 2026

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Next.js 16 Dashboard                             │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │  Reasoning  │ │  ThinkFork  │ │  Metacog    │ │   Thinking Stream   │ │ │
│  │  │    Tree     │ │   Viewer    │ │  Insights   │ │   (Real-time SSE)   │ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘ │ │
│  └─────────┼───────────────┼───────────────┼───────────────────┼────────────┘ │
└────────────┼───────────────┼───────────────┼───────────────────┼──────────────┘
             │               │               │                   │
             ▼               ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               API LAYER                                      │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                      Next.js API Routes (App Router)                      │ │
│  │  POST /api/think     POST /api/fork     GET /api/insights   SSE /api/stream │
│  │  GET /api/reasoning  POST /api/insights GET /api/reasoning/:id            │ │
│  └───────────────────────────────────┬──────────────────────────────────────┘ │
└──────────────────────────────────────┼──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE LAYER                                      │
│                           @opus-nx/core                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Orchestrator                                   │  │
│  │  • Session management                                                  │  │
│  │  • Task routing & agent delegation                                     │  │
│  │  • Knowledge context injection                                         │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│  ┌───────────────┐ ┌─────────────┴─────────────┐ ┌─────────────────────┐   │
│  │   Thinking    │ │        ThinkGraph         │ │   Metacognition     │   │
│  │    Engine     │◄┤  • Parse thinking blocks  │◄┤      Engine         │   │
│  │               │ │  • Extract decisions      │ │  • 50k thinking     │   │
│  │  • Opus 4.6   │ │  • Build reasoning graph  │ │  • Pattern detect   │   │
│  │  • Streaming  │ │  • Persist nodes          │ │  • Bias identify    │   │
│  │  • 5k-50k     │ │  • Link relationships     │ │  • Self-improve     │   │
│  └───────┬───────┘ └───────────────────────────┘ └─────────────────────┘   │
│          │                                                                  │
│  ┌───────▼───────┐ ┌───────────────────────────┐ ┌─────────────────────┐   │
│  │   ThinkFork   │ │   Contradiction Resolver  │ │   Memory Manager    │   │
│  │               │ │                           │ │                     │   │
│  │  • Parallel   │ │  • Detect conflicts       │ │  • Voyage AI embed  │   │
│  │    branches   │ │  • Deep analysis          │ │  • Semantic search  │   │
│  │  • Compare    │ │  • Resolution audit       │ │  • Context build    │   │
│  │  • Select     │ │  • Apply updates          │ │  • Categorization   │   │
│  └───────────────┘ └───────────────────────────┘ └──────────┬──────────┘   │
└──────────────────────────────────────────────────────────────┼──────────────┘
                                                               │
                                                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
│                            @opus-nx/db                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Query Functions                                 │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐  │  │
│  │  │  Sessions  │ │  Knowledge │ │  Thinking  │ │  Metacog Insights  │  │  │
│  │  │            │ │   Entries  │ │   Nodes    │ │                    │  │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────────────┘  │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERSISTENCE LAYER                                  │
│                     Supabase (PostgreSQL + pgvector)                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐ ┌───────────────┐ ┌────────────────┐ ┌────────────────┐ │  │
│  │  │ sessions │ │ knowledge_    │ │ thinking_nodes │ │ metacog_       │ │  │
│  │  │          │ │ entries       │ │ reasoning_edges│ │ insights       │ │  │
│  │  │          │ │ knowledge_    │ │ decision_points│ │                │ │  │
│  │  │          │ │ relations     │ │ contradictions │ │                │ │  │
│  │  └──────────┘ └───────────────┘ └────────────────┘ └────────────────┘ │  │
│  │                                                                        │  │
│  │  Extensions: pgvector (HNSW indexes), pg_cron                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────────┐ │
│  │  Claude Opus    │ │   Voyage AI     │ │         Tavily                  │ │
│  │     4.6         │ │   Embeddings    │ │       Web Search                │ │
│  │                 │ │                 │ │                                 │ │
│  │  • Extended     │ │  • voyage-3     │ │  • Research queries             │ │
│  │    thinking     │ │  • 1024-dim     │ │  • Fact verification            │ │
│  │  • 200k context │ │  • Semantic     │ │                                 │ │
│  │  • Streaming    │ │    similarity   │ │                                 │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### Presentation Layer

#### Next.js Dashboard (`apps/web/`)

| Component | Responsibility |
|-----------|---------------|
| `reasoning-tree.tsx` | Interactive graph visualization using react-flow |
| `think-fork-viewer.tsx` | Side-by-side branch comparison with selection |
| `metacog-insights.tsx` | Tabbed display of patterns, biases, improvements |
| `thinking-stream.tsx` | Real-time SSE stream of extended thinking |

### Core Layer

#### Orchestrator (`packages/core/src/orchestrator.ts`)

**Current Responsibilities**:
- Session lifecycle management
- User message processing
- Knowledge context retrieval
- Task plan creation and routing
- Agent delegation

**New Responsibilities**:
- ThinkGraph integration after each thinking call
- Metacognition triggering (manual + auto after N sessions)
- ThinkFork coordination
- Contradiction handling during knowledge operations

#### ThinkingEngine (`packages/core/src/thinking-engine.ts`)

**Responsibilities**:
- Claude Opus 4.6 API wrapper
- Extended thinking configuration (5k-50k token budgets)
- Streaming and non-streaming modes
- Response parsing into typed blocks (thinking, text, tool_use)
- Token usage tracking (including cache tokens)

**Enhancement**:
- Emit `ThinkingNode` after each call
- Link sequential thinking nodes

#### ThinkGraph (`packages/core/src/think-graph.ts`)

**Responsibilities**:
- Parse raw thinking text into structured format
- Extract decision points (chosen path, alternatives, confidence)
- Persist thinking nodes to database
- Create reasoning edges (influences, contradicts, supports, supersedes)
- Graph traversal queries

**Key Algorithm - Decision Point Extraction**:
```
1. Split reasoning into paragraphs
2. Look for decision markers:
   - "I'll choose...", "Going with...", "Selecting..."
   - "On the other hand...", "Alternatively..."
   - "The options are...", "Considering..."
3. Extract alternatives from surrounding context
4. Assign confidence based on language certainty
5. Create DecisionPoint records
```

#### Metacognition Engine (`packages/core/src/metacognition.ts`)

**Responsibilities**:
- Gather recent thinking nodes (10-20)
- Build analysis context within token limits
- Execute with maximum 50k thinking budget
- Parse insights: patterns, biases, improvements
- Store insights with evidence links

**Unique Capability**: Only possible with Opus 4.6's extended thinking budget

#### ThinkFork (`packages/core/src/think-fork.ts`)

**Responsibilities**:
- Generate variant prompts with different assumptions
- Execute branches concurrently (Promise.all)
- Handle partial failures gracefully
- Compare conclusions across branches
- Identify key differences
- Track branch selection with rationale

**Branch Types**:
| Type | Assumption Frame |
|------|------------------|
| Conservative | Risk-averse, proven approaches |
| Aggressive | Optimistic, innovative approaches |
| Balanced | Weighted trade-offs |
| Contrarian | Challenge conventional wisdom |

#### Contradiction Resolver (`packages/core/src/contradiction-resolver.ts`)

**Responsibilities**:
- Detect conflicts between knowledge entries (semantic similarity)
- Analyze contradiction type and severity
- Use extended thinking for resolution reasoning
- Persist resolution with full audit trail
- Update knowledge graph with provenance

**Resolution Types**:
| Type | Description |
|------|-------------|
| `favor_a` | Original knowledge kept |
| `favor_b` | New knowledge replaces |
| `synthesized` | Merged/nuanced truth |
| `unresolved` | Flagged for human review |

#### Memory Manager (`packages/core/src/memory-manager.ts`)

**Responsibilities**:
- Generate Voyage AI embeddings (voyage-3, 1024-dim)
- Store knowledge entries with embeddings
- Semantic search with similarity threshold
- Build context strings for prompt injection
- Auto-categorization using Claude Haiku

**Enhancement**:
- Contradiction checking during store()
- Trigger resolution when conflicts detected

### Data Layer

#### Query Functions (`packages/db/src/`)

| Module | Functions |
|--------|-----------|
| `sessions.ts` | createSession, getSession, updateSessionPlan |
| `knowledge.ts` | createKnowledgeEntry, searchKnowledge, getRelatedKnowledge |
| `thinking-nodes.ts` | createThinkingNode, getThinkingNode, traverseReasoningGraph |
| `decisions.ts` | logDecision |
| `agent-runs.ts` | createAgentRun, updateAgentRun |
| `metacognition.ts` | createInsight, getSessionInsights |

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────────┐
│     sessions    │───────│   thinking_nodes    │
│                 │  1:N  │                     │
│ id              │       │ id                  │
│ user_id         │       │ session_id (FK)     │
│ status          │       │ parent_node_id (FK) │───┐
│ current_plan    │       │ reasoning           │   │ self-ref
│ created_at      │       │ structured_reasoning│   │
│ updated_at      │       │ confidence_score    │◄──┘
└────────┬────────┘       │ thinking_budget     │
         │                │ signature           │
         │                │ created_at          │
         │                └──────────┬──────────┘
         │                           │
         │                           │ 1:N
         │                           ▼
         │                ┌─────────────────────┐
         │                │   decision_points   │
         │                │                     │
         │                │ id                  │
         │                │ thinking_node_id(FK)│
         │                │ step_number         │
         │                │ description         │
         │                │ chosen_path         │
         │                │ alternatives (JSONB)│
         │                │ confidence          │
         │                └─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────────┐
│ knowledge_      │       │   reasoning_edges   │
│ entries         │       │                     │
│                 │       │ id                  │
│ id              │       │ source_id (FK)──────┼──► thinking_nodes
│ title           │       │ target_id (FK)──────┼──► thinking_nodes
│ content         │       │ edge_type           │
│ embedding       │       │ weight              │
│ category        │       │ metadata (JSONB)    │
│ subcategory     │       │ created_at          │
│ source          │       └─────────────────────┘
│ metadata        │
│ created_by (FK) │
│ created_at      │       ┌─────────────────────┐
│ updated_at      │       │   contradictions    │
└────────┬────────┘       │                     │
         │                │ id                  │
         │ N:N            │ knowledge_a_id (FK) │───► knowledge_entries
         ▼                │ knowledge_b_id (FK) │───► knowledge_entries
┌─────────────────┐       │ thinking_node_id(FK)│───► thinking_nodes
│ knowledge_      │       │ contradiction_type  │
│ relations       │       │ resolution_summary  │
│                 │       │ resolved_in_favor   │
│ source_id (FK)  │       │ created_at          │
│ target_id (FK)  │       └─────────────────────┘
│ relation_type   │
│ weight          │       ┌─────────────────────┐
└─────────────────┘       │ metacognitive_      │
                          │ insights            │
                          │                     │
                          │ id                  │
                          │ session_id (FK)     │───► sessions
                          │ thinking_nodes_     │
                          │   analyzed (UUID[]) │
                          │ insight_type        │
                          │ insight             │
                          │ evidence (JSONB)    │
                          │ confidence          │
                          │ created_at          │
                          └─────────────────────┘
```

### Complete Schema SQL

```sql
-- ============================================================
-- Opus Nx: Cognitive Architect Schema
-- Migration: 002_thinking_graph.sql
-- ============================================================

-- Thinking nodes with graph relationships
CREATE TABLE IF NOT EXISTS thinking_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_node_id UUID REFERENCES thinking_nodes(id) ON DELETE SET NULL,
  reasoning TEXT NOT NULL,
  structured_reasoning JSONB DEFAULT '{}',
  confidence_score FLOAT,
  thinking_budget INT,
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for thinking nodes
CREATE INDEX IF NOT EXISTS thinking_nodes_session_idx
ON thinking_nodes(session_id);

CREATE INDEX IF NOT EXISTS thinking_nodes_parent_idx
ON thinking_nodes(parent_node_id);

CREATE INDEX IF NOT EXISTS thinking_nodes_reasoning_search_idx
ON thinking_nodes USING gin(to_tsvector('english', reasoning));

-- Reasoning graph edges
CREATE TABLE IF NOT EXISTS reasoning_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('influences', 'contradicts', 'supports', 'supersedes')),
  weight FLOAT DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, edge_type)
);

-- Indexes for graph traversal
CREATE INDEX IF NOT EXISTS reasoning_edges_source_idx
ON reasoning_edges(source_id);

CREATE INDEX IF NOT EXISTS reasoning_edges_target_idx
ON reasoning_edges(target_id);

CREATE INDEX IF NOT EXISTS reasoning_edges_type_idx
ON reasoning_edges(edge_type);

-- Decision points within reasoning
CREATE TABLE IF NOT EXISTS decision_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thinking_node_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  description TEXT NOT NULL,
  chosen_path TEXT NOT NULL,
  alternatives JSONB DEFAULT '[]',
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decision_points_node_idx
ON decision_points(thinking_node_id);

-- Contradiction resolutions
CREATE TABLE IF NOT EXISTS contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_a_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL,
  knowledge_b_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL,
  thinking_node_id UUID REFERENCES thinking_nodes(id) ON DELETE SET NULL,
  contradiction_type TEXT CHECK (contradiction_type IN ('factual', 'temporal', 'perspective', 'scope')),
  resolution_summary TEXT,
  resolved_in_favor TEXT CHECK (resolved_in_favor IN ('a', 'b', 'synthesized', 'unresolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contradictions_knowledge_idx
ON contradictions(knowledge_a_id, knowledge_b_id);

-- Metacognitive insights
CREATE TABLE IF NOT EXISTS metacognitive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  thinking_nodes_analyzed UUID[] DEFAULT '{}',
  insight_type TEXT NOT NULL CHECK (insight_type IN ('bias_detection', 'pattern', 'improvement_hypothesis')),
  insight TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metacognitive_insights_session_idx
ON metacognitive_insights(session_id);

CREATE INDEX IF NOT EXISTS metacognitive_insights_type_idx
ON metacognitive_insights(insight_type);

-- ============================================================
-- RPC Functions
-- ============================================================

-- Graph traversal function for reasoning
CREATE OR REPLACE FUNCTION traverse_reasoning_graph(
  start_node_id UUID,
  max_depth INT DEFAULT 3
)
RETURNS TABLE (
  node_id UUID,
  reasoning TEXT,
  edge_type TEXT,
  hop_distance INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE graph AS (
    -- Base case: direct edges
    SELECT
      re.target_id AS node_id,
      tn.reasoning,
      re.edge_type,
      1 AS hop_distance
    FROM reasoning_edges re
    JOIN thinking_nodes tn ON tn.id = re.target_id
    WHERE re.source_id = start_node_id

    UNION ALL

    -- Recursive case: follow edges up to max_depth
    SELECT
      re.target_id,
      tn.reasoning,
      re.edge_type,
      g.hop_distance + 1
    FROM graph g
    JOIN reasoning_edges re ON re.source_id = g.node_id
    JOIN thinking_nodes tn ON tn.id = re.target_id
    WHERE g.hop_distance < max_depth
  )
  SELECT DISTINCT * FROM graph
  ORDER BY hop_distance;
END;
$$;

-- Get reasoning context for a session
CREATE OR REPLACE FUNCTION get_session_reasoning_context(
  p_session_id UUID,
  node_limit INT DEFAULT 10
)
RETURNS TABLE (
  node_id UUID,
  reasoning TEXT,
  confidence_score FLOAT,
  decision_count INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tn.id AS node_id,
    tn.reasoning,
    tn.confidence_score,
    (SELECT COUNT(*)::INT FROM decision_points dp WHERE dp.thinking_node_id = tn.id) AS decision_count,
    tn.created_at
  FROM thinking_nodes tn
  WHERE tn.session_id = p_session_id
  ORDER BY tn.created_at DESC
  LIMIT node_limit;
END;
$$;
```

---

## Data Flows

### Flow 1: Standard Thinking Request

```
User Query
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│                    Orchestrator.process()                      │
│                                                                │
│  1. Validate session active                                    │
│  2. Retrieve knowledge context                                 │
│     └─► MemoryManager.buildContextString()                     │
│         └─► Voyage AI: embed query                             │
│         └─► Supabase: search knowledge_entries                 │
│  3. Build routing prompt with agent context                    │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    ThinkingEngine.think()                      │
│                                                                │
│  1. Configure extended thinking (budget based on effort)       │
│  2. Call Claude Opus 4.6 API                                   │
│  3. Stream thinking deltas to callback ─────────────────────── │───► SSE to UI
│  4. Await final response                                       │
│  5. Parse into typed blocks                                    │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    ThinkGraph.parseAndPersist()                │
│                                                                │
│  1. Parse thinking text                                        │
│  2. Extract decision points                                    │
│     └─► Identify choices made                                  │
│     └─► Capture alternatives considered                        │
│     └─► Assign confidence scores                               │
│  3. Create ThinkingNode record                                 │
│  4. Persist to Supabase                                        │
│  5. Link to previous node (if exists)                          │
│     └─► Create 'influences' edge                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                      Return Result                             │
│                                                                │
│  {                                                             │
│    response: string,                                           │
│    thinkingBlocks: ThinkingBlock[],                            │
│    thinkingNode: ThinkingNode,      ◄── NEW                    │
│    plan?: TaskPlan,                                            │
│    knowledgeContext?: string                                   │
│  }                                                             │
└───────────────────────────────────────────────────────────────┘
```

### Flow 2: Metacognitive Self-Reflection

```
Trigger: Manual or auto after N sessions
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│               MetacognitionEngine.getSelfReflection()          │
│                                                                │
│  1. Fetch recent thinking nodes (10-20)                        │
│     └─► get_session_reasoning_context RPC                      │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Build Analysis Context                     │
│                                                                │
│  For each node:                                                │
│    - Include full reasoning text                               │
│    - Include decision points                                   │
│    - Include confidence scores                                 │
│                                                                │
│  Format as structured analysis prompt                          │
│  Total context: up to 100k tokens                              │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│              ThinkingEngine.think() with MAX budget            │
│                                                                │
│  Config:                                                       │
│    model: 'claude-opus-4-6-20260101'                           │
│    thinking.effort: 'max'  // 50k tokens                       │
│    maxTokens: 16384                                            │
│                                                                │
│  System prompt: metacognition.md                               │
│  User content: Formatted reasoning history                     │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                       Parse Insights                           │
│                                                                │
│  Extract from response:                                        │
│    - Patterns (recurring strategies)                           │
│    - Biases (with evidence links to nodes)                     │
│    - Improvement hypotheses                                    │
│                                                                │
│  Each insight includes:                                        │
│    - Type                                                      │
│    - Description                                               │
│    - Confidence                                                │
│    - Evidence (links to specific reasoning nodes)              │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Persist Insights                           │
│                                                                │
│  For each insight:                                             │
│    INSERT INTO metacognitive_insights (                        │
│      session_id, thinking_nodes_analyzed,                      │
│      insight_type, insight, evidence, confidence               │
│    )                                                           │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
                    Return MetacognitiveInsight[]
```

### Flow 3: ThinkFork Parallel Reasoning

```
User Query: "Explore multiple approaches for X"
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│                    ThinkFork.fork()                            │
│                                                                │
│  1. Parse branch types from request (or use defaults)          │
│  2. Generate variant prompts                                   │
│     └─► Conservative: "Approach with caution..."               │
│     └─► Aggressive: "Approach optimistically..."               │
│     └─► Balanced: "Weigh trade-offs carefully..."              │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                   Execute Branches Concurrently                │
│                                                                │
│  Promise.all([                                                 │
│    thinkingEngine.think(conservativePrompt),                   │
│    thinkingEngine.think(aggressivePrompt),                     │
│    thinkingEngine.think(balancedPrompt),                       │
│  ])                                                            │
│                                                                │
│  Handle partial failures:                                      │
│    - Continue with successful branches                         │
│    - Log failed branches with error                            │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Compare Branches                           │
│                                                                │
│  For successful branches:                                      │
│    1. Extract conclusions                                      │
│    2. Identify key differences                                 │
│    3. Calculate confidence spread                              │
│    4. Determine recommended branch                             │
│                                                                │
│  BranchComparison {                                            │
│    agreementAreas: string[],                                   │
│    disagreementAreas: string[],                                │
│    confidenceSpread: { min, max, avg },                        │
│    recommendedBranch: string,                                  │
│    recommendationReason: string                                │
│  }                                                             │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
                    Return ForkResult with all branches
                                │
                                ▼
                    Display in ThinkForkViewer component
                                │
                                ▼
                    User selects branch (with rationale)
                                │
                                ▼
                    Persist selection to database
```

### Flow 4: Contradiction Detection & Resolution

```
MemoryManager.store(newKnowledge)
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│                  Check for Contradictions                      │
│                                                                │
│  1. Search existing knowledge (top 5 similar)                  │
│  2. For each similar entry:                                    │
│     └─► ContradictionResolver.detectContradiction()            │
│         - Compare semantic similarity                          │
│         - Check for opposing claims                            │
│         - Identify contradiction type                          │
└───────────────────────────────┬───────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
       No contradiction                   Contradiction detected
              │                                   │
              ▼                                   ▼
    Store normally              ┌─────────────────────────────────┐
                                │   ContradictionResolver.        │
                                │   resolveContradiction()        │
                                │                                 │
                                │  1. Build resolution prompt     │
                                │     - Include both knowledge    │
                                │     - Include sources           │
                                │     - Include timestamps        │
                                │                                 │
                                │  2. ThinkingEngine.think()      │
                                │     - Extended thinking         │
                                │     - Deep analysis             │
                                │                                 │
                                │  3. Parse resolution            │
                                │     - Decision: a/b/synth/unres │
                                │     - Reasoning                 │
                                │     - Confidence                │
                                └─────────────────┬───────────────┘
                                                  │
                                                  ▼
                                ┌─────────────────────────────────┐
                                │   Apply Resolution              │
                                │                                 │
                                │  1. Store contradiction record  │
                                │  2. Link resolution thinking    │
                                │  3. Update knowledge graph      │
                                │     - If favor_b: mark a as     │
                                │       superseded                │
                                │     - If synthesized: create    │
                                │       new merged entry          │
                                │  4. Add provenance metadata     │
                                └─────────────────────────────────┘
```

---

## Technology Stack

### Core Technologies

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Runtime | Node.js | 22+ | Native TypeScript, async/await |
| Language | TypeScript | 5.7+ | Strict types, latest features |
| Monorepo | Turborepo | 2.3+ | Build caching, task pipelines |
| Package Manager | pnpm | 9.15+ | Fast, disk efficient |

### AI/ML

| Component | Technology | Details |
|-----------|------------|---------|
| LLM | Claude Opus 4.6 | Extended thinking up to 50k tokens |
| Embeddings | Voyage AI | voyage-3, 1024 dimensions |
| Agent Framework | LangChain | @langchain/anthropic, @langchain/core |
| Agent Orchestration | LangGraph | @langchain/langgraph |

### Database

| Component | Technology | Details |
|-----------|------------|---------|
| Primary DB | PostgreSQL | Via Supabase |
| Vector Search | pgvector | HNSW indexes, 1024-dim |
| Client | @supabase/supabase-js | 2.47+ |
| Migrations | Supabase CLI | 1.200+ |

### Frontend

| Component | Technology | Details |
|-----------|------------|---------|
| Framework | Next.js | 16+ with App Router |
| React | React | 19+ |
| Styling | Tailwind CSS | 4.0+ |
| Components | shadcn/ui | Radix primitives |
| Graph Viz | react-flow | 11+ |
| Animation | Framer Motion | 11+ |

### DevOps

| Component | Technology | Details |
|-----------|------------|---------|
| Hosting | Vercel | Next.js optimized |
| Database | Supabase | Managed PostgreSQL |
| CI/CD | GitHub Actions | Build, test, deploy |

---

## API Contracts

### POST /api/think

**Request**:
```typescript
{
  query: string;
  sessionId: string;
  options?: {
    thinkingEffort?: 'low' | 'medium' | 'high' | 'max';
    includeKnowledge?: boolean;
  };
}
```

**Response**:
```typescript
{
  response: string;
  thinkingNodeId: string;
  tokenUsage: {
    input: number;
    output: number;
    thinking: number;
  };
}
```

### POST /api/fork

**Request**:
```typescript
{
  query: string;
  sessionId: string;
  branchTypes?: ('conservative' | 'aggressive' | 'balanced' | 'contrarian')[];
}
```

**Response**:
```typescript
{
  forkId: string;
  branches: Array<{
    id: string;
    type: string;
    conclusion: string;
    confidence: number;
    thinkingNodeId: string;
  }>;
  comparison: {
    recommendedBranch: string;
    reason: string;
  };
}
```

### GET /api/insights

**Response**:
```typescript
{
  insights: Array<{
    id: string;
    type: 'pattern' | 'bias_detection' | 'improvement_hypothesis';
    insight: string;
    confidence: number;
    evidence: Array<{
      nodeId: string;
      excerpt: string;
    }>;
    createdAt: string;
  }>;
}
```

### SSE /api/stream/:sessionId

**Events**:
```typescript
// Thinking delta
{ type: 'thinking_delta', content: string }

// Text delta
{ type: 'text_delta', content: string }

// Completion
{ type: 'complete', nodeId: string }

// Error
{ type: 'error', message: string }
```

---

## Security Considerations

### API Key Management

```
Environment Variables (never committed):
├── ANTHROPIC_API_KEY
├── SUPABASE_URL
├── SUPABASE_SERVICE_ROLE_KEY
├── SUPABASE_ANON_KEY
├── VOYAGE_API_KEY
└── TAVILY_API_KEY
```

### Row-Level Security

```sql
-- Example RLS policy for thinking_nodes
ALTER TABLE thinking_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own thinking nodes"
ON thinking_nodes
FOR ALL
USING (
  session_id IN (
    SELECT id FROM sessions WHERE user_id = auth.uid()
  )
);
```

### Thinking Signature Verification

```typescript
// Verify Anthropic thinking signatures on retrieval
async function verifyThinkingNode(node: ThinkingNode): Promise<boolean> {
  if (!node.signature) return false;
  // Anthropic signature verification logic
  return verifySignature(node.reasoning, node.signature);
}
```

---

## Performance Considerations

### Database Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| thinking_nodes | session_id | B-tree | Session queries |
| thinking_nodes | reasoning | GIN | Full-text search |
| knowledge_entries | embedding | HNSW | Vector similarity |
| reasoning_edges | source_id | B-tree | Graph traversal |
| reasoning_edges | target_id | B-tree | Reverse traversal |

### Caching Strategy

```typescript
// Token usage estimation cache
const tokenCache = new Map<string, number>();

// Embedding cache (LRU)
const embeddingCache = new LRUCache<string, number[]>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});
```

### Streaming Optimization

```typescript
// Stream thinking to client as it arrives
const encoder = new TextEncoder();

async function* streamThinking(thinkingEngine: ThinkingEngine) {
  for await (const delta of thinkingEngine.streamThink(prompt)) {
    yield encoder.encode(`data: ${JSON.stringify(delta)}\n\n`);
  }
}
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Vercel Edge                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Next.js 16 Dashboard                       │ │
│  │  • Server Components                                         │ │
│  │  • API Routes (Edge Functions)                               │ │
│  │  • Static assets (CDN)                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (us-east-1)                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL                                                  │ │
│  │  • pgvector extension                                        │ │
│  │  • Connection pooling (PgBouncer)                            │ │
│  │  • Auto-scaling                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External APIs                              │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐  │
│  │   Anthropic   │ │   Voyage AI   │ │       Tavily          │  │
│  │   Claude API  │ │  Embeddings   │ │     Web Search        │  │
│  └───────────────┘ └───────────────┘ └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

*Last Updated: February 6, 2026*
