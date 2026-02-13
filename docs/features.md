# Opus Nx — Visual Feature Guide

Every feature shown here runs on real data generated from a single question: *"Can AI systems develop genuine consciousness, or is machine consciousness fundamentally different from biological consciousness?"*

This guide walks through every tab, panel, and capability in the platform.

---

## Table of Contents

1. [ThinkGraph — Persistent Reasoning Graphs](#thinkgraph--persistent-reasoning-graphs)
2. [Agent Swarm — 6-Specialist Orchestration](#agent-swarm--6-specialist-orchestration)
3. [Graph of Thoughts — Tree Search Reasoning](#graph-of-thoughts--tree-search-reasoning)
4. [Step Verification — Structured Reasoning (PRM)](#step-verification--structured-reasoning-prm)
5. [ThinkFork — Divergent Analysis](#thinkfork--divergent-analysis)
6. [Metacognitive Insights — Self-Reflection](#metacognitive-insights--self-reflection)
7. [Memory Hierarchy — MemGPT-Inspired](#memory-hierarchy--memgpt-inspired)
8. [Sessions — Persistent Reasoning Library](#sessions--persistent-reasoning-library)

---

## ThinkGraph — Persistent Reasoning Graphs

The core innovation: every extended thinking session becomes a navigable, persistent graph. Nodes represent discrete reasoning steps. Edges are typed (influence, support, contradiction, refinement, supersedes) to show how ideas relate.

### Full Workspace View

<p align="center">
  <img src="../images/ThinkGraph.png" alt="ThinkGraph — Full workspace" width="100%" />
</p>

The complete workspace: reasoning graph center stage, session list on the left, right panel with Insights/Fork/Memory tabs, and the thinking input at the bottom. The header shows the session title, replay tour button, and navigation links.

### Graph Detail

<p align="center">
  <img src="../images/ThinkGraph2.png" alt="ThinkGraph — Graph detail" width="100%" />
</p>

Zoomed into the graph structure:

- **Green nodes** (majority) — Regular thinking steps with confidence scores
- **Orange/red bordered nodes** — Fork branches (contrarian and aggressive perspectives)
- **Teal node** — Compaction boundary (context consolidation checkpoint)
- **Colored edges** — Different relationship types visible at a glance
- **Minimap** (bottom-right) — Navigate large graphs efficiently
- **Legend** (top-left) — All 5 edge types and 3 node types documented

Each node displays a truncated reasoning excerpt and its confidence score. Click to expand the full reasoning text.

### What Makes This Novel

Traditional AI interfaces show only final answers. ThinkGraph persists the *entire reasoning path* as a first-class data structure:

- Every node is stored in PostgreSQL with pgvector embeddings
- Edges capture the actual relationships between reasoning steps
- Graphs survive across sessions and can be queried, compared, and extended
- Decision points within nodes are extracted and tracked separately

---

## Agent Swarm — 6-Specialist Orchestration

A swarm of 6 specialized AI agents collaborate on complex problems in 3 phases:

1. **Phase 1**: Maestro decomposes the query into subtasks
2. **Phase 2**: DeepThinker, Contrarian, Verifier run in parallel
3. **Phase 3**: Synthesizer merges, then Metacognition audits

### Swarm Results with Synthesis

<p align="center">
  <img src="../images/Swarm.png" alt="Swarm — Synthesis view" width="100%" />
</p>

The Synthesizer agent's output: a structured analysis incorporating all agent perspectives. Notice the session stats on the left (17 thinking nodes, 62K total tokens, 14 high-confidence nodes, 1 low-confidence). The tab bar shows ThinkGraph, Swarm, GoT, and Verify tabs.

### Human-in-the-Loop Checkpoints

<p align="center">
  <img src="../images/Swarm_human.png" alt="Swarm — Human checkpoint" width="100%" />
</p>

The full swarm execution trace showing multiple agent phases. Each agent's output is collapsible with role labels, key findings, and challenge details. The human can intervene at checkpoint boundaries to steer the analysis.

### What Makes This Novel

Unlike simple multi-agent setups, the Opus Nx swarm:

- Streams agent reasoning live via WebSocket (not batch)
- Uses a SharedReasoningGraph (NetworkX) so agents build on each other's work
- Provides human-in-the-loop checkpoints between phases
- Tracks token usage per agent for cost transparency
- The Metacognition agent audits the entire swarm for biases after synthesis

---

## Graph of Thoughts — Tree Search Reasoning

An implementation of Besta et al. (2023) — arbitrary thought graph topologies with BFS, DFS, or best-first search.

### GoT Overview with Thought Stream

<p align="center">
  <img src="../images/GoT.png" alt="GoT — Overview" width="100%" />
</p>

Top: the thought tree visualization with color-coded depth levels. Bottom: the full thought stream showing each node's reasoning in detail. The tree uses BFS/DFS/best-first search over reasoning branches, with aggregation and verification at each level.

### GoT Tree Detail

<p align="center">
  <img src="../images/GoT2.png" alt="GoT — Tree visualization" width="100%" />
</p>

A 4-depth GoT tree with 8+ branches:

- **Top (root)**: The original question with 100% confidence
- **Level 1** (pink): Aggregated reasoning perspectives (75%–88% confidence)
- **Level 2** (green): Verified sub-arguments (70%–85%)
- **Level 3** (yellow): Evaluated evidence and counterarguments (75%–87%)
- **Level 4** (blue/orange): Final verified conclusions and aggregated syntheses (83%–94%)

Each node shows: thought content, confidence score, verification status (Verified/Aggregated), and a "best path" indicator for optimal reasoning chains. Edge colors match the node depth for visual tracing.

### What Makes This Novel

The GoT implementation goes beyond the original paper by:

- Persisting the entire thought tree as reasoning artifacts
- Color-coding depth levels for instant visual orientation
- Showing verification status (Verified vs. Aggregated) per node
- Highlighting the "best path" through the tree
- Integrating with the ThinkGraph — GoT results become graph nodes

---

## Step Verification — Structured Reasoning (PRM)

Based on "Let's Verify Step by Step" (Lightman et al., 2023). Each reasoning step is extracted, typed, and verified independently.

### Step-by-Step Verification Chain

<p align="center">
  <img src="../images/Reasoning_Steps1.png" alt="Steps 1-5: Consideration → Hypothesis" width="100%" />
</p>

The first 5 steps of a 13-step reasoning chain:

- **Steps 1-4**: CONSIDERATION — Examining the analysis structure, identifying strengths, noting risks
- **Step 5**: HYPOTHESIS — Identifying philosophical assumptions embedded in the framing

Each step has a numbered badge, colored type label, and the full reasoning text. Header shows: 13 Steps, 13 Decisions, 1 Edge, 1.6K thinking tokens, 40% confidence.

<p align="center">
  <img src="../images/Reasoning_Steps2.png" alt="Steps 6-9: Hypothesis → Evaluation" width="100%" />
</p>

Steps 6-9: The chain transitions from HYPOTHESIS to EVALUATION, examining each claim against evidence and identifying logical gaps.

<p align="center">
  <img src="../images/Reasoning_Steps3.png" alt="Steps 10-12: Evaluation → Decision" width="100%" />
</p>

Steps 10-12: Deep EVALUATION of specific claims — testing each assertion for falsifiability, examining counterarguments, and rating argument strength.

<p align="center">
  <img src="../images/Reasoning_Steps4.png" alt="Step 13 + Conclusion + Output" width="100%" />
</p>

The final step (13: EVALUATION), followed by the MAIN CONCLUSION (highlighted in green) and the MODEL OUTPUT section. The conclusion summarizes the entire deliberation chain, and the output presents a structured response generated from the reasoning.

### Verify Tab — Chain Validity Assessment

<p align="center">
  <img src="../images/Verify.png" alt="Verify — Chain validation" width="100%" />
</p>

The Verify tab shows the full PRM output: a step-by-step verification chain with confidence bands (green gradient), step validity assessments, and overall chain integrity scoring.

### Extended Reasoning Detail

<p align="center">
  <img src="../images/Reasoning.png" alt="Reasoning — Full text view" width="100%" />
</p>

A zoomed view of a single reasoning artifact: the complete text of a thinking node, showing the full deliberation including strengths, weaknesses, philosophical assumptions, and synthesis.

### What Makes This Novel

Most verification approaches check only final answers. PRM in Opus Nx:

- Extracts discrete reasoning *types* (consideration, hypothesis, evaluation, conclusion)
- Verifies each step independently with per-step confidence
- Tracks the decision count within each reasoning pass
- Persists structured reasoning as a queryable artifact
- Links each step back to the source thinking node in the graph

---

## ThinkFork — Divergent Analysis

Fork any question into 4 concurrent reasoning styles: conservative, aggressive, balanced, and contrarian. Based on Tree of Thoughts (Yao et al., 2023) with added debate mode.

### Fork Analysis Results

<p align="center">
  <img src="../images/Fork.png" alt="Fork — 4 perspectives" width="48%" />
  <img src="../images/Fork_Final.png" alt="Fork — Final positions" width="48%" />
</p>

**Left**: The divergent analysis overview showing 4 branches, 4 perspectives, and 8 divergences identified. The Analysis Summary section shows key points from each style.

**Right**: Final positions from each perspective with confidence scores:
- **Conservative** (82%): Focus on falsifiable functional measures
- **Aggressive** (45%): Consciousness is already emerging
- **Balanced** (78%): Multi-dimensional consciousness space
- **Contrarian** (58%): Computation may be fundamentally insufficient

Each perspective includes key points, confidence scoring, and the style badge. The synthesis at the bottom reconciles the positions.

### What Makes This Novel

ThinkFork adds to Tree of Thoughts by:

- Running 4 reasoning styles concurrently (not sequentially)
- Allowing mid-flight steering — redirect any branch while it's running
- Producing fork branch nodes that integrate into the ThinkGraph
- Offering a Debate mode where branches argue against each other
- Quantifying divergence between perspectives

---

## Metacognitive Insights — Self-Reflection

The AI analyzes its own reasoning for biases, patterns, and blind spots. Uses a 50K thinking budget to audit reasoning traces across the session.

### Insights Overview

<p align="center">
  <img src="../images/Insights.png" alt="Insights — Overview" width="48%" />
  <img src="../images/Insights_Ideas.png" alt="Insights — Improvement ideas" width="48%" />
</p>

**Left**: 7 total metacognitive insights: 3 biases, 3 patterns, 1 improvement idea. The panel shows all insights with confidence scores, searchable and filterable by type. The confidence slider lets you set a minimum threshold.

**Right**: An Improvement insight (75% confidence) suggesting a "conditional analysis protocol" for contested philosophical questions. Includes metadata showing which agents generated the insight and the source (swarm_v2).

### Bias Detection

<p align="center">
  <img src="../images/Insights_Bias.png" alt="Insights — Bias detection" width="48%" />
  <img src="../images/Insights_Pattern.png" alt="Insights — Pattern recognition" width="48%" />
</p>

**Left**: A bias insight detecting "confirmation validation" — where the verifier tends to mark pre-existing beliefs as "correct" rather than genuinely probing them. Includes specific evidence citations with node references.

**Right**: A pattern insight identifying convergence across all agents toward gradient/spectrum models, with analysis of whether this represents genuine insight or groupthink.

### What Makes This Novel

Metacognition in Opus Nx goes beyond simple summarization:

- Uses a dedicated 50K thinking budget (separate from the main analysis)
- Categorizes findings into 3 types: bias detection, pattern recognition, improvement hypotheses
- Links every insight back to specific evidence nodes in the graph
- Tracks actionability (high/medium/low) for each finding
- Can audit across sessions, not just within one

---

## Memory Hierarchy — MemGPT-Inspired

A 3-tier memory system based on MemGPT (Packer et al., 2023): working context, recall buffer, and archival storage.

### Memory Overview

<p align="center">
  <img src="../images/Memory.png" alt="Memory — 3-tier hierarchy" width="48%" />
  <img src="../images/Memory_Recall.png" alt="Memory — Recall entries" width="48%" />
</p>

**Left**: The Memory Hierarchy panel showing:
- **Main Context** (Working Memory): 4 entries, 1,061 tokens, 1% capacity
- **Recall** (Recent History): 4 entries
- **Archival** (Long-term Knowledge): 0 entries (promotes from recall over time)
- Stats: Insertions, Searches, Evictions, Promotions tracked
- Recent Entries: Each showing content, importance score, source type, and tier badge

**Right**: The Recall tier with entries showing "What's biased to say" analysis and "Token Usage" metadata. Each entry is tagged with its importance score and source (thinking_node).

### What Makes This Novel

The memory system provides cross-session reasoning continuity:

- Auto-eviction when working memory exceeds token budget
- Promotion pipeline: working → recall → archival based on access patterns
- Semantic search via pgvector embeddings (voyage-3, 1024-dim)
- Knowledge entries with graph relations (theoretical_basis, supports, challenges, informs)
- Token accounting per tier to prevent context overflow

---

## Sessions — Persistent Reasoning Library

Every session is a persistent reasoning artifact that can be revisited, extended, or shared.

### Session Stats

<p align="center">
  <img src="../images/Session.png" alt="Session stats" width="40%" />
</p>

The session panel showing:
- **Thinking Nodes**: 17 discrete reasoning steps persisted
- **Total Tokens**: 62.0K consumed across all operations
- **High Confidence**: 14 nodes above threshold
- **Low Confidence**: 1 node flagged for review
- **Token Breakdown**: Thinking (323), Input (51.5K), Output (10.1K)
- Session timestamp and active status indicator

### What Makes This Novel

Sessions in Opus Nx aren't just chat history:

- Every session contains a full reasoning graph (nodes + edges + decisions)
- Sessions can be shared via unique tokens
- Archived sessions can be restored and extended
- Cross-session insights compare reasoning patterns over time
- The evaluation harness measures retrieval quality and reasoning improvements

---

## How to Try It

### Run Locally

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
./scripts/dev-start.sh
```

### Launch Demo

Set `DEMO_MODE=true` in your `.env`, then click "Launch Demo" on the login page. The demo seeds a fully populated workspace with all features visible — ThinkGraph, Swarm, GoT, Verify, Fork, Insights, Memory, and a guided tour walks through each one.

---

*Built by [Ozzy](https://omerakben.com) + [TUEL AI](https://tuel.ai) + [Claude](https://www.anthropic.com/news/claude-opus-4-6) — a human-AI collaboration exploring persistent reasoning artifacts.*
