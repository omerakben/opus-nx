# Opus Nx: Development Roadmap

**Hackathon**: Built with Opus 4.6: Claude Code Hackathon
**Duration**: 5 Days (Feb 10-14, 2026)
**API Credits**: $500
**Submission Deadline**: Feb 14, 2026

---

## Timeline Overview

```
Day 1         Day 2         Day 3         Day 4         Day 5
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ThinkGraph│   │Metacog  │   │ThinkFork│   │Dashboard│   │ Polish  │
│Foundation│──►│ Engine  │──►│+ Contra-│──►│   UI    │──►│ + Demo  │
│          │   │         │   │ diction │   │         │   │         │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  Reasoning     Insights       Parallel       Visual        Submit
  persists      generate       branches       explorer      ready
```

| Day | Focus                     | Hours | Milestone                               |
| --- | ------------------------- | ----- | --------------------------------------- |
| 1   | ThinkGraph Foundation     | 8     | Reasoning persistence working           |
| 2   | Metacognition Engine      | 8     | Self-audit generating insights          |
| 3   | ThinkFork + Contradiction | 8     | Parallel branches + conflict resolution |
| 4   | Dashboard UI              | 8     | Visual reasoning explorer live          |
| 5   | Polish + Demo             | 8     | Submission ready                        |

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

- [ ] Migration runs without errors
- [ ] HNSW index created for reasoning search
- [ ] Graph traversal RPC function created
- [ ] Foreign keys properly cascade

**Verification**:

```bash
pnpm db:migrate
# Check Supabase dashboard for new tables
```

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

- [ ] All interfaces compile without errors
- [ ] Zod schemas validate sample data
- [ ] Types exported from package index

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

- [ ] CRUD operations work correctly
- [ ] Graph traversal returns connected nodes
- [ ] Proper error handling with typed errors

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

**Key Logic - Decision Point Extraction**:

```typescript
// Look for patterns like:
// "I considered X but chose Y because..."
// "Option A: ... Option B: ... I'll go with B"
// "The alternatives are: ... After weighing, ..."
```

**Acceptance Criteria**:

- [ ] Parsing extracts at least 80% of decision points
- [ ] Confidence scores calculated from language
- [ ] Alternatives captured with rejection reasons

---

#### Task 1.5: Integrate with ThinkingEngine

**Time**: 1.5 hours
**File**: `packages/core/src/thinking-engine.ts`

**Changes**:

```typescript
// Add to ThinkingEngine class:
private thinkGraph: ThinkGraph;

// Modify think() method:
async think(...): Promise<ThinkingResult> {
  // ... existing code ...

  // NEW: After parsing response
  const thinkingNode = this.thinkGraph.parseThinkingToNode(
    thinkingBlocks[0],
    this.currentSessionId
  );
  await this.thinkGraph.persistThinkingNode(thinkingNode);

  // Link to previous node if exists
  if (this.previousNodeId) {
    await this.thinkGraph.linkNodes(this.previousNodeId, thinkingNode.id, 'influences');
  }
  this.previousNodeId = thinkingNode.id;

  return { ...result, thinkingNode };
}
```

**Acceptance Criteria**:

- [ ] Every think() call creates a thinking node
- [ ] Nodes linked to session
- [ ] Sequential nodes linked with 'influences' edge

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

**Verification**:

```bash
pnpm --filter @opus-nx/core test
```

---

### Day 1 Deliverables

- [ ] `packages/db/migrations/002_thinking_graph.sql` - Schema
- [ ] `packages/core/src/types/thinking.ts` - Types
- [ ] `packages/db/src/thinking-nodes.ts` - DB queries
- [ ] `packages/core/src/think-graph.ts` - Core logic
- [ ] Modified `packages/core/src/thinking-engine.ts`
- [ ] `packages/core/src/tests/think-graph.test.ts`

### Day 1 Milestone Verification

```bash
# 1. Database has new tables
pnpm db:migrate

# 2. Run a thinking request
pnpm tsx scripts/test-thinking.ts

# 3. Check Supabase for thinking_nodes record
# 4. Verify decision_points extracted
# 5. Run tests
pnpm test
```

---

## Day 2: Metacognition Engine

> **Goal**: AI can analyze its own reasoning patterns using 50k thinking budget

### Morning Session (4 hours)

#### Task 2.1: Metacognition Schema

**Time**: 0.5 hours
**File**: `packages/db/migrations/002_thinking_graph.sql` (append)

**Work**:

```sql
-- Add to existing migration:
CREATE TABLE metacognitive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  thinking_nodes_analyzed UUID[],
  insight_type TEXT NOT NULL, -- 'bias_detection', 'pattern', 'improvement_hypothesis'
  insight TEXT NOT NULL,
  evidence JSONB, -- Links to specific reasoning nodes
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX metacognitive_insights_session_idx ON metacognitive_insights(session_id);
CREATE INDEX metacognitive_insights_type_idx ON metacognitive_insights(insight_type);
```

---

#### Task 2.2: Metacognition Types

**Time**: 0.5 hours
**File**: `packages/core/src/types/metacognition.ts`

**Work**:

```typescript
export interface MetacognitiveInsight {
  id: string;
  sessionId: string;
  thinkingNodesAnalyzed: string[];
  insightType: 'bias_detection' | 'pattern' | 'improvement_hypothesis';
  insight: string;
  evidence: InsightEvidence[];
  confidence: number;
  createdAt: Date;
}

export interface InsightEvidence {
  nodeId: string;
  excerpt: string;
  relevance: string;
}

export interface BiasPattern {
  biasType: string; // 'confirmation', 'anchoring', 'recency', 'availability'
  description: string;
  occurrences: number;
  evidence: InsightEvidence[];
}
```

---

#### Task 2.3: Metacognition Prompts

**Time**: 1.5 hours
**File**: `configs/prompts/metacognition.md`

**Work**:

```markdown
# Metacognitive Self-Analysis

You are analyzing your own reasoning patterns across multiple thinking sessions.
Your goal is to identify:

1. **Patterns**: Recurring strategies or approaches you use
2. **Biases**: Systematic tendencies that may skew your reasoning
3. **Improvements**: Concrete ways to enhance your reasoning

## Input
You will receive 10-20 reasoning chains from previous sessions.

## Analysis Framework

### Pattern Detection
- Look for recurring problem decomposition strategies
- Identify preferred solution approaches
- Note consistent estimation techniques

### Bias Detection
Common biases to check for:
- **Confirmation bias**: Only considering evidence that supports initial hypothesis
- **Anchoring**: Over-relying on first piece of information
- **Recency bias**: Over-weighting recent information
- **Availability bias**: Preferring easily recalled examples
- **Overconfidence**: Expressing certainty beyond evidence

### Improvement Generation
For each bias or limitation found:
- Describe specific mitigation strategy
- Provide example of how to apply it

## Output Format
Return structured JSON:
{
  "patterns": [...],
  "biases": [...],
  "improvements": [...]
}
```

---

#### Task 2.4: Metacognition Core Module

**Time**: 1.5 hours
**File**: `packages/core/src/metacognition.ts`

**Work**:

```typescript
export class MetacognitionEngine {
  private thinkingEngine: ThinkingEngine;
  private thinkGraph: ThinkGraph;

  constructor(options: MetacognitionOptions) { ... }

  // Fetch recent reasoning nodes for analysis
  async gatherReasoningHistory(sessionId: string, limit: number = 20): Promise<ThinkingNode[]>

  // Build context string from reasoning nodes
  buildAnalysisContext(nodes: ThinkingNode[]): string

  // Execute metacognitive analysis with 50k budget
  async analyzePatterns(nodes: ThinkingNode[]): Promise<AnalysisResult>

  // Detect biases in reasoning
  async detectBiases(nodes: ThinkingNode[]): Promise<BiasPattern[]>

  // Generate improvement hypotheses
  async generateImprovements(analysis: AnalysisResult): Promise<Improvement[]>

  // Full self-reflection pipeline
  async getSelfReflection(sessionId: string): Promise<MetacognitiveInsight[]>
}
```

---

### Afternoon Session (4 hours)

#### Task 2.5: 50k Thinking Budget Integration

**Time**: 2 hours
**File**: `packages/core/src/metacognition.ts`

**Key Implementation**:

```typescript
async getSelfReflection(sessionId: string): Promise<MetacognitiveInsight[]> {
  // 1. Gather recent reasoning
  const nodes = await this.gatherReasoningHistory(sessionId, 20);

  // 2. Build context (may be 50-100k tokens)
  const context = this.buildAnalysisContext(nodes);

  // 3. Configure engine for max thinking
  const config: OrchestratorConfig = {
    model: 'claude-opus-4-6',
    maxTokens: 16384,
    thinking: {
      type: 'enabled',
      effort: 'max', // 50k tokens
    },
    streaming: true,
  };

  // 4. Execute metacognitive analysis
  const result = await this.thinkingEngine.think(
    metacognitionPrompt,
    [{ role: 'user', content: context }],
    [], // No tools for pure analysis
    config
  );

  // 5. Parse and store insights
  const insights = this.parseInsights(result.textBlocks);
  await this.persistInsights(insights, sessionId, nodes.map(n => n.id));

  return insights;
}
```

**Token Budget Consideration**:

```typescript
// Rough estimation:
// - 20 reasoning nodes × ~2k tokens each = 40k input
// - 50k thinking budget
// - 16k output budget
// Total: ~106k tokens per metacognition run ≈ $1-2 per run

// Budget for hackathon ($500):
// ~250 metacognition runs available
```

---

#### Task 2.6: Orchestrator Integration

**Time**: 1 hour
**File**: `packages/core/src/orchestrator.ts`

**Changes**:

```typescript
export class Orchestrator {
  private metacognition: MetacognitionEngine;
  private sessionThinkCount: number = 0;

  // Add method to trigger metacognition
  async triggerMetacognition(): Promise<MetacognitiveInsight[]> {
    if (!this.session) {
      throw new Error('No active session');
    }
    return this.metacognition.getSelfReflection(this.session.id);
  }

  // Optional: Auto-trigger after N thinking sessions
  async process(userMessage: string): Promise<OrchestratorResult> {
    const result = await super.process(userMessage);

    this.sessionThinkCount++;
    if (this.sessionThinkCount % 10 === 0) {
      // Auto-trigger metacognition every 10 thinking sessions
      await this.triggerMetacognition();
    }

    return result;
  }
}
```

---

#### Task 2.7: Day 2 Integration Test

**Time**: 1 hour
**File**: `packages/core/src/tests/metacognition.test.ts`

**Test Cases**:

```typescript
describe('MetacognitionEngine', () => {
  test('gathers reasoning history from session')
  test('builds analysis context within token limits')
  test('uses 50k thinking budget')
  test('extracts patterns from analysis')
  test('detects biases with evidence')
  test('generates improvement hypotheses')
  test('persists insights to database')
})
```

---

### Day 2 Deliverables

- [ ] Extended `packages/db/migrations/002_thinking_graph.sql`
- [ ] `packages/core/src/types/metacognition.ts`
- [ ] `configs/prompts/metacognition.md`
- [ ] `packages/core/src/metacognition.ts`
- [ ] Modified `packages/core/src/orchestrator.ts`
- [ ] `packages/core/src/tests/metacognition.test.ts`

### Day 2 Milestone Verification

```bash
# 1. Create 5+ thinking sessions
pnpm tsx scripts/generate-test-reasoning.ts

# 2. Trigger metacognition
pnpm tsx scripts/test-metacognition.ts

# 3. Check Supabase for metacognitive_insights
# 4. Verify insights have evidence links
# 5. Run tests
pnpm test
```

---

## Day 3: ThinkFork + Contradiction Resolution

> **Goal**: Parallel reasoning branches and conflict resolution with audit trail

### Morning Session (4 hours)

#### Task 3.1: ThinkFork Types

**Time**: 0.5 hours
**File**: `packages/core/src/types/think-fork.ts`

**Work**:

```typescript
export interface ReasoningBranch {
  id: string;
  assumption: string;
  assumptionType: 'conservative' | 'aggressive' | 'balanced' | 'contrarian';
  thinkingNode: ThinkingNode;
  conclusion: string;
  confidence: number;
  keyDifferences: string[];
}

export interface ForkResult {
  id: string;
  originalQuery: string;
  branches: ReasoningBranch[];
  comparison: BranchComparison;
  selectedBranch?: string;
  selectionRationale?: string;
  createdAt: Date;
}

export interface BranchComparison {
  agreementAreas: string[];
  disagreementAreas: string[];
  confidenceSpread: { min: number; max: number; avg: number };
  recommendedBranch: string;
  recommendationReason: string;
}
```

---

#### Task 3.2: ThinkFork Core Module

**Time**: 2 hours
**File**: `packages/core/src/think-fork.ts`

**Work**:

```typescript
export class ThinkFork {
  private thinkingEngine: ThinkingEngine;
  private thinkGraph: ThinkGraph;

  constructor(options: ThinkForkOptions) { ... }

  // Generate prompts for different assumption frames
  createBranchPrompts(
    baseQuery: string,
    assumptions: BranchAssumption[]
  ): BranchPrompt[]

  // Execute all branches concurrently
  async executeBranches(prompts: BranchPrompt[]): Promise<ReasoningBranch[]>

  // Compare conclusions across branches
  compareBranches(branches: ReasoningBranch[]): BranchComparison

  // Full fork pipeline
  async fork(
    query: string,
    branchTypes?: BranchType[]
  ): Promise<ForkResult>

  // Record user's branch selection
  async selectBranch(
    forkId: string,
    branchId: string,
    rationale: string
  ): Promise<void>
}
```

---

#### Task 3.3: Parallel Execution

**Time**: 1.5 hours
**File**: `packages/core/src/think-fork.ts`

**Key Implementation**:

```typescript
async executeBranches(prompts: BranchPrompt[]): Promise<ReasoningBranch[]> {
  const branchPromises = prompts.map(async (prompt) => {
    try {
      const result = await this.thinkingEngine.think(
        prompt.systemPrompt,
        [{ role: 'user', content: prompt.userPrompt }]
      );

      return {
        id: crypto.randomUUID(),
        assumption: prompt.assumption,
        assumptionType: prompt.type,
        thinkingNode: result.thinkingNode,
        conclusion: this.extractConclusion(result.textBlocks),
        confidence: this.calculateConfidence(result),
        keyDifferences: [],
      };
    } catch (error) {
      // Return partial result on failure
      return {
        id: crypto.randomUUID(),
        assumption: prompt.assumption,
        assumptionType: prompt.type,
        error: error.message,
        failed: true,
      };
    }
  });

  const results = await Promise.all(branchPromises);

  // Filter successful branches, add key differences
  const successfulBranches = results.filter(r => !r.failed);
  this.identifyKeyDifferences(successfulBranches);

  return successfulBranches;
}
```

**Assumption Prompts**:

```typescript
const assumptionFrames: Record<BranchType, string> = {
  conservative: `
    Approach this with caution. Prioritize:
    - Proven, established solutions
    - Risk mitigation
    - Worst-case scenario planning
  `,
  aggressive: `
    Approach this optimistically. Prioritize:
    - Innovative, cutting-edge solutions
    - Maximum potential upside
    - First-mover advantages
  `,
  balanced: `
    Weigh trade-offs carefully. Consider:
    - Both risks and opportunities
    - Short-term vs long-term implications
    - Stakeholder perspectives
  `,
  contrarian: `
    Challenge conventional wisdom. Consider:
    - Why the obvious answer might be wrong
    - Overlooked alternatives
    - Counter-intuitive approaches
  `,
};
```

---

### Afternoon Session (4 hours)

#### Task 3.4: Contradiction Detection Types

**Time**: 0.5 hours
**File**: `packages/core/src/types/contradiction.ts`

**Work**:

```typescript
export interface Contradiction {
  id: string;
  knowledgeAId: string;
  knowledgeBId: string;
  contradictionType: 'factual' | 'temporal' | 'perspective' | 'scope';
  description: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: Date;
}

export interface Resolution {
  id: string;
  contradictionId: string;
  thinkingNodeId: string; // The reasoning used to resolve
  resolvedInFavor: 'a' | 'b' | 'synthesized' | 'unresolved';
  summary: string;
  confidence: number;
  resolvedAt: Date;
  resolvedBy: 'auto' | 'user';
}
```

---

#### Task 3.5: Contradiction Resolver Module

**Time**: 2 hours
**File**: `packages/core/src/contradiction-resolver.ts`

**Work**:

```typescript
export class ContradictionResolver {
  private thinkingEngine: ThinkingEngine;
  private memoryManager: MemoryManager;

  constructor(options: ContradictionResolverOptions) { ... }

  // Detect contradiction between knowledge entries
  async detectContradiction(
    newKnowledge: KnowledgeEntry,
    existingKnowledge: KnowledgeEntry[]
  ): Promise<Contradiction | null>

  // Deep analysis of contradiction
  async analyzeContradiction(
    a: KnowledgeEntry,
    b: KnowledgeEntry
  ): Promise<ContradictionAnalysis>

  // Use extended thinking to resolve
  async resolveContradiction(
    contradiction: Contradiction
  ): Promise<Resolution>

  // Apply resolution to knowledge graph
  async applyResolution(resolution: Resolution): Promise<void>
}
```

**Resolution Prompt**:

```markdown
# Contradiction Resolution

You are resolving a contradiction between two pieces of knowledge.

## Knowledge A
{knowledgeA}

## Knowledge B
{knowledgeB}

## Analysis Task
1. Identify the nature of the contradiction
2. Evaluate source reliability for each
3. Consider temporal factors (which is more recent?)
4. Look for nuance that might reconcile both
5. Make a reasoned decision

## Output
Provide your resolution in this format:
- Resolution: favor_a | favor_b | synthesized | unresolved
- Confidence: 0.0-1.0
- Reasoning: <your full reasoning>
- Updated knowledge: <if synthesized, the merged truth>
```

---

#### Task 3.6: Knowledge Retrieval Integration

**Time**: 1 hour
**File**: `packages/core/src/memory-manager.ts`

**Changes**:

```typescript
export class MemoryManager {
  private contradictionResolver: ContradictionResolver;

  async store(
    input: CreateKnowledgeInput,
    options: StoreOptions = {}
  ): Promise<StoreResult> {
    // ... existing embedding logic ...

    // NEW: Check for contradictions
    if (options.checkContradictions !== false) {
      const existing = await this.search(input.content, { limit: 5 });
      const contradiction = await this.contradictionResolver.detectContradiction(
        { ...input, embedding },
        existing
      );

      if (contradiction) {
        const resolution = await this.contradictionResolver.resolveContradiction(
          contradiction
        );
        await this.contradictionResolver.applyResolution(resolution);

        return {
          entry: await createKnowledgeEntry(input, embedding),
          contradiction,
          resolution,
        };
      }
    }

    return { entry: await createKnowledgeEntry(input, embedding) };
  }
}
```

---

#### Task 3.7: Day 3 Integration Test

**Time**: 0.5 hours

**Test Cases**:

```typescript
describe('ThinkFork', () => {
  test('creates parallel branches with different assumptions')
  test('executes branches concurrently')
  test('handles partial failures gracefully')
  test('compares conclusions across branches')
  test('records branch selection with rationale')
})

describe('ContradictionResolver', () => {
  test('detects factual contradictions')
  test('analyzes contradiction severity')
  test('resolves using extended thinking')
  test('applies resolution to knowledge graph')
})
```

---

### Day 3 Deliverables

- [ ] `packages/core/src/types/think-fork.ts`
- [ ] `packages/core/src/think-fork.ts`
- [ ] `packages/core/src/types/contradiction.ts`
- [ ] `packages/core/src/contradiction-resolver.ts`
- [ ] Modified `packages/core/src/memory-manager.ts`
- [ ] Tests for both features

### Day 3 Milestone Verification

```bash
# 1. Test ThinkFork with a complex question
pnpm tsx scripts/test-think-fork.ts "Should we use microservices or monolith?"

# 2. Test contradiction detection
pnpm tsx scripts/test-contradiction.ts

# 3. Verify parallel execution (check timing)
# 4. Check resolution audit trail in database
# 5. Run tests
pnpm test
```

---

## Day 4: Dashboard UI

> **Goal**: Visual reasoning explorer with real-time thinking stream

### Morning Session (4 hours)

#### Task 4.1: Next.js App Scaffold

**Time**: 1 hour
**Directory**: `apps/web/`

**Commands**:

```bash
cd apps
pnpm create next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd web
pnpm add @supabase/supabase-js
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dialog input tabs badge
pnpm add reactflow d3 framer-motion
```

**Configuration**:

- App Router
- TypeScript strict mode
- Tailwind with custom theme
- shadcn/ui components
- Supabase client setup

---

#### Task 4.2: Layout & Navigation

**Time**: 1 hour
**File**: `apps/web/src/app/layout.tsx`

**Work**:

```tsx
// Main layout with:
// - Sidebar navigation (Reasoning, Insights, Fork, Settings)
// - Dark mode toggle
// - Session indicator
// - Real-time connection status
```

**Pages to create**:

```
apps/web/src/app/
├── page.tsx              # Dashboard home
├── reasoning/
│   ├── page.tsx          # Reasoning graph explorer
│   └── [id]/page.tsx     # Single node detail
├── insights/
│   └── page.tsx          # Metacognition insights
├── fork/
│   └── page.tsx          # ThinkFork interface
└── api/
    ├── think/route.ts
    ├── reasoning/[id]/route.ts
    ├── insights/route.ts
    └── fork/route.ts
```

---

#### Task 4.3: Reasoning Tree Component

**Time**: 2 hours
**File**: `apps/web/src/components/reasoning-tree.tsx`

**Work**:

```tsx
// Using react-flow for graph visualization
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background
} from 'reactflow';

export function ReasoningTree({ nodes, edges }: ReasoningTreeProps) {
  // Transform ThinkingNodes to react-flow format
  const flowNodes: Node[] = nodes.map(node => ({
    id: node.id,
    type: 'thinkingNode',
    data: {
      reasoning: node.reasoning.slice(0, 100) + '...',
      confidence: node.confidenceScore,
      decisionPoints: node.structuredReasoning.decisionPoints.length,
    },
    position: calculatePosition(node),
  }));

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={{ thinkingNode: ThinkingNodeCard }}
      onNodeClick={handleNodeClick}
    >
      <Controls />
      <MiniMap />
      <Background />
    </ReactFlow>
  );
}
```

**Custom Node Card**:

```tsx
function ThinkingNodeCard({ data }: { data: NodeData }) {
  return (
    <Card className="w-64 p-3">
      <div className="flex justify-between items-center mb-2">
        <Badge variant={getConfidenceBadge(data.confidence)}>
          {(data.confidence * 100).toFixed(0)}%
        </Badge>
        <span className="text-xs text-muted-foreground">
          {data.decisionPoints} decisions
        </span>
      </div>
      <p className="text-sm line-clamp-3">{data.reasoning}</p>
    </Card>
  );
}
```

---

### Afternoon Session (4 hours)

#### Task 4.4: ThinkFork Viewer

**Time**: 1.5 hours
**File**: `apps/web/src/components/think-fork-viewer.tsx`

**Work**:

```tsx
export function ThinkForkViewer({ forkResult }: ThinkForkViewerProps) {
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-3 gap-4">
      {forkResult.branches.map(branch => (
        <BranchCard
          key={branch.id}
          branch={branch}
          isSelected={selectedBranch === branch.id}
          onSelect={() => setSelectedBranch(branch.id)}
          isRecommended={forkResult.comparison.recommendedBranch === branch.id}
        />
      ))}

      <div className="col-span-3 mt-4">
        <ComparisonSummary comparison={forkResult.comparison} />
      </div>

      {selectedBranch && (
        <BranchSelectionDialog
          branch={forkResult.branches.find(b => b.id === selectedBranch)}
          onConfirm={handleConfirmSelection}
        />
      )}
    </div>
  );
}
```

---

#### Task 4.5: Metacognition Insights

**Time**: 1 hour
**File**: `apps/web/src/components/metacog-insights.tsx`

**Work**:

```tsx
export function MetacogInsights({ insights }: MetacogInsightsProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Cognitive Insights</h2>
        <Button onClick={handleTriggerAnalysis}>
          Run Self-Reflection
        </Button>
      </div>

      <Tabs defaultValue="patterns">
        <TabsList>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="biases">Biases</TabsTrigger>
          <TabsTrigger value="improvements">Improvements</TabsTrigger>
        </TabsList>

        <TabsContent value="patterns">
          {insights.filter(i => i.insightType === 'pattern').map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </TabsContent>
        {/* ... other tabs */}
      </Tabs>
    </div>
  );
}
```

---

#### Task 4.6: Real-Time Thinking Stream

**Time**: 1 hour
**File**: `apps/web/src/components/thinking-stream.tsx`

**Work**:

```tsx
export function ThinkingStream({ sessionId }: ThinkingStreamProps) {
  const [thinking, setThinking] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(`/api/stream/${sessionId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'thinking_delta') {
        setThinking(prev => prev + data.content);
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [sessionId]);

  return (
    <Card className="p-4 font-mono text-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-muted-foreground">Extended Thinking</span>
      </div>
      <div className="whitespace-pre-wrap max-h-96 overflow-y-auto">
        {thinking || 'Waiting for thinking...'}
      </div>
    </Card>
  );
}
```

---

#### Task 4.7: API Routes

**Time**: 0.5 hours

**Files**:

```typescript
// apps/web/src/app/api/think/route.ts
export async function POST(req: Request) {
  const { query, sessionId } = await req.json();
  // Call orchestrator.process()
  // Return result with thinking node
}

// apps/web/src/app/api/reasoning/[id]/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  // Get thinking node by ID
  // Include decision points and related nodes
}

// apps/web/src/app/api/insights/route.ts
export async function GET(req: Request) {
  // Get metacognitive insights for session
}

export async function POST(req: Request) {
  // Trigger new metacognition analysis
}

// apps/web/src/app/api/fork/route.ts
export async function POST(req: Request) {
  // Create ThinkFork with specified branches
}
```

---

### Day 4 Deliverables

- [ ] `apps/web/` scaffolded with dependencies
- [ ] Layout with navigation
- [ ] `reasoning-tree.tsx` with react-flow
- [ ] `think-fork-viewer.tsx` with comparison
- [ ] `metacog-insights.tsx` with tabs
- [ ] `thinking-stream.tsx` with SSE
- [ ] All API routes

### Day 4 Milestone Verification

```bash
# 1. Start development server
pnpm --filter @opus-nx/web dev

# 2. Navigate to http://localhost:3000
# 3. Test reasoning graph visualization
# 4. Test ThinkFork interface
# 5. Test metacognition insights
# 6. Verify streaming works
# 7. Deploy to Vercel
pnpm --filter @opus-nx/web build
vercel --prod
```

---

## Day 5: Polish + Demo

> **Goal**: Compelling demo video and polished submission

### Morning Session (4 hours)

#### Task 5.1: Demo Script Finalization

**Time**: 1 hour

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

2:00-3:30  Metacognition Demo
- Trigger self-reflection
- Show 50k thinking budget in action
- Display detected patterns
- Show bias with evidence
- "This is AI introspection"

3:30-4:30  ThinkFork Demo
- Submit question with "explore approaches"
- Show parallel branches appearing
- Compare conclusions
- Highlight key differences
- Select branch with rationale

4:30-5:00  Wrap-up
- Contradiction resolution quick demo
- "Only possible with Opus 4.6"
- Architecture slide
- Thank you
```

---

#### Task 5.2: Demo Data Seeding

**Time**: 1.5 hours
**File**: `scripts/seed-demo-data.ts`

**Work**:

```typescript
// Create interesting reasoning nodes
const demoQueries = [
  "Design a scalable architecture for a real-time collaboration app",
  "Analyze the trade-offs between microservices and monolith",
  "Create a content moderation strategy for a social platform",
  "Evaluate investment strategies for a volatile market",
];

// Run each query to generate reasoning nodes
// Create connections between related reasoning
// Generate sample contradictions
// Create metacognitive insights
```

---

#### Task 5.3: Bug Fixes

**Time**: 1.5 hours

**Priority fixes**:

1. Streaming reliability
2. Graph performance with many nodes
3. ThinkFork timeout handling
4. UI polish (loading states, error handling)
5. Mobile responsiveness (basic)

---

### Afternoon Session (4 hours)

#### Task 5.4: README Update

**Time**: 1 hour
**File**: `README.md`

**Sections**:

1. Hero section with tagline
2. Architecture diagram (ASCII)
3. Features with screenshots
4. Quick start guide
5. Demo video embed
6. Technical stack
7. Hackathon credits

---

#### Task 5.5: Demo Recording

**Time**: 2 hours

**Setup**:

- Screen recording (OBS or similar)
- Microphone for voiceover
- Clean browser (no extensions visible)
- Pre-seeded data ready
- Script printed

**Recording tips**:

- Record in 1080p
- Keep mouse movements smooth
- Pause briefly on important UI elements
- Re-record sections if needed
- Edit for timing (aim for exactly 5 min)

---

#### Task 5.6: Submission

**Time**: 1 hour

**Checklist**:

- [ ] Demo video uploaded (YouTube/Loom)
- [ ] README updated with video embed
- [ ] Code pushed to GitHub
- [ ] Dashboard deployed to Vercel
- [ ] Submission form completed at cv.inc/e/claude-code-hackathon
- [ ] All team members listed
- [ ] Project description (500 words)
- [ ] Category selected: "Most Creative Opus 4.6 Exploration"

---

### Day 5 Deliverables

- [ ] Demo script finalized
- [ ] Demo data seeded
- [ ] Critical bugs fixed
- [ ] README updated
- [ ] Demo video recorded and edited
- [ ] Project submitted

### Final Verification

```bash
# 1. Fresh clone and build
git clone <repo>
pnpm install
pnpm build

# 2. Run all tests
pnpm test

# 3. Deploy
vercel --prod

# 4. Verify demo flow end-to-end
# 5. Submit to hackathon portal
```

---

## Risk Mitigation

| Risk                     | Probability | Impact | Mitigation                                                 |
| ------------------------ | ----------- | ------ | ---------------------------------------------------------- |
| API rate limiting        | Medium      | High   | Pre-test with small budgets, implement exponential backoff |
| 50k thinking timeout     | Low         | Medium | Set 120s timeout, checkpoint streaming progress            |
| Graph visualization slow | Medium      | Medium | Limit to 50 visible nodes, lazy load details               |
| Streaming drops          | Medium      | Medium | Implement reconnection logic, show connection status       |
| Demo data insufficient   | Low         | High   | Seed data day before, have backup queries ready            |
| Vercel deployment fails  | Low         | Medium | Test deployment daily, have Railway as backup              |

---

## Dependencies Graph

```
           Day 1
       ThinkGraph
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
   Day 2       Day 3
 Metacog    ThinkFork
     │           │
     └─────┬─────┘
           │
           ▼
         Day 4
       Dashboard
           │
           ▼
         Day 5
        Demo
```

**Critical Path**: Day 1 → Day 2/3 → Day 4 → Day 5

**Parallel Work Opportunities**:

- Day 2 and Day 3 can be worked in parallel by different people
- Dashboard wireframes can start on Day 2
- Demo script can be drafted on Day 3

---

## Token Budget Estimation

| Feature                  | Tokens/Call | Calls/Day | Daily Total |
| ------------------------ | ----------- | --------- | ----------- |
| Standard thinking        | ~3k         | 20        | 60k         |
| Metacognition            | ~100k       | 2         | 200k        |
| ThinkFork (3 branches)   | ~10k        | 5         | 50k         |
| Contradiction resolution | ~5k         | 3         | 15k         |
| **Daily Total**          |             |           | **~325k**   |

**5-Day Estimate**: ~1.6M tokens ≈ $160-200 (well within $500 budget)

---

*Last Updated: February 6, 2026*
