# OPUS NX — HACKATHON BATTLE PLAN

**Mission**: Win the Cerebral Valley "Built with Opus 4.6" Hackathon
**Timeline**: Feb 10–16, 2026 (6 days)
**Team**: Solo (Ozzy)
**Strategy**: Option B — 3 features at 99% quality
**Target Prizes**: "Most Creative Opus 4.6 Exploration" ($5K) + Top 3 ($10K–$50K)

---

## THE REFRAME

**Old pitch**: "Reasoning visualization — see how the AI thinks"
**New pitch**: "Reasoning verification — audit, challenge, and correct how the AI thinks"

This reframe matters because Anthropic's judges care about safety, transparency, and interpretability above everything else. You're not building a dashboard — you're building **the first reasoning audit tool for high-stakes AI decisions**.

**The one sentence that wins**: *"Extended thinking shouldn't be a black box that makes AI more convincing — it should be an audit trail that makes AI trustworthy."*

---

## CODEBASE REALITY CHECK

### What's Built (Keep & Polish)

| Component                   | Lines | Quality  | Status                                                     |
| --------------------------- | ----- | -------- | ---------------------------------------------------------- |
| ThinkingEngine              | 352   | Solid    | Opus 4.6 streaming wrapper works                           |
| ThinkGraph                  | 935   | Strong   | Parses thinking → structured nodes with decision points    |
| MetacognitionEngine         | 619   | Strong   | Uses 50K thinking budget, tool-based insight extraction    |
| DB thinking-nodes           | 614   | Good     | Full CRUD + graph traversal + search                       |
| DB migrations               | 610   | Good     | Schema with pgvector, edges, decision points               |
| ThinkFork types             | ~100  | Complete | Types defined: styles, branches, convergence/divergence    |
| API routes (fork, insights) | 193   | Partial  | Fork route calls ThinkForkEngine (which doesn't exist yet) |
| Login page                  | 203   | Done     | Working auth gate                                          |
| Config prompts              | 218   | Good     | Orchestrator + metacognition prompts                       |

### What's NOT Built (Build During Hackathon)

| Component                               | Priority | Effort | Day |
| --------------------------------------- | -------- | ------ | --- |
| **ThinkForkEngine** (core)              | P0       | 4 hrs  | 1   |
| **API /api/think route** (1 line stub)  | P0       | 2 hrs  | 1   |
| **API /api/thinking/stream route**      | P0       | 2 hrs  | 1   |
| **Dashboard page** (0 lines)            | P0       | 6 hrs  | 2–3 |
| **ThinkingStream UI** (live streaming)  | P0       | 4 hrs  | 2   |
| **ReasoningTree UI** (react-flow graph) | P0       | 6 hrs  | 2–3 |
| **ThinkForkViewer UI** (divergence viz) | P0       | 4 hrs  | 3   |
| **MetacogInsights UI**                  | P1       | 3 hrs  | 4   |
| **Human-in-the-loop interaction**       | P0       | 4 hrs  | 3   |
| ContradictionResolver                   | CUT      | —      | —   |
| Agents package                          | CUT      | —      | —   |
| Voyage AI embeddings                    | CUT      | —      | —   |
| Tavily search                           | CUT      | —      | —   |

### What to CUT

- **`packages/agents`** — 83% stubs, LangChain dead dependency. Don't touch it.
- **ContradictionResolver** — Fold the concept into ThinkFork divergence detection.
- **Voyage AI / Tavily** — Not needed for demo. Supabase full-text search is enough.
- **Knowledge management features** — Out of scope for 6 days.

---

## 3 FEATURES THAT WIN

### Feature 1: Live Reasoning Trace with Human Checkpoints

**What the judge sees**: User asks a complex question. Opus 4.6 thinking tokens stream live to the screen — raw, mesmerizing. When the response arrives, a structured reasoning chain appears as a navigable graph (react-flow). Each step is clickable. The user can mark steps as ✓ verified, ⚠ questionable, or ✗ disagree. If they flag a step, they inject a correction and Opus re-reasons from that point.

**Why it wins**: This is human-in-the-loop reasoning, not human-in-the-loop conversation. No one else is doing this.

**Technical approach**:

1. ThinkingEngine already streams thinking tokens via SSE
2. ThinkGraph already parses thinking → structured nodes
3. NEW: Build a react-flow visualization that renders the reasoning chain
4. NEW: Add "checkpoint" interaction — click a node, flag it, provide correction
5. NEW: Re-invoke Opus with the original context + human correction injected at the flagged step

**Key UI components**:

- `ThinkingStream` — real-time token stream (left panel)
- `ReasoningGraph` — react-flow graph that builds after stream completes (center panel)
- `NodeInspector` — slide-out panel when clicking a node (right panel)
- `HumanCheckpoint` — verification buttons + correction input on each node

### Feature 2: Divergence Detection (ThinkFork)

**What the judge sees**: For a high-stakes decision, the user triggers "Explore Divergent Paths." Three independent reasoning branches run concurrently with different assumption frames. The system automatically highlights where branches agree (high confidence zones) and where they diverge (uncertainty zones). Divergence points are presented with a clear question: "These paths disagree here. Which assumption do you want to proceed with?"

**Why it wins**: Agreement across independent chains = reliable. Disagreement = needs human judgment. This is a principled approach to AI reliability that judges will immediately understand.

**Technical approach**:

1. ThinkFork types already define styles, branches, convergence/divergence schemas
2. NEW: Build ThinkForkEngine — runs 3 concurrent Opus calls with different system prompts
3. NEW: Post-process with a 4th Opus call to identify convergence/divergence points
4. NEW: Build ThinkForkViewer UI — side-by-side branches with highlighted divergence
5. API route already exists and expects the right interface

**Branch configuration**:

- Don't use the 4 styles (conservative/aggressive/balanced/contrarian) — too gimmicky
- Use 3 INDEPENDENT reasoning attempts with subtle assumption variations
- The value is in finding where independent reasoning diverges, not in role-playing

### Feature 3: Metacognitive Self-Audit

**What the judge sees**: After 4-5 reasoning sessions on related topics, the user triggers "Analyze My Reasoning." Using the full 50K thinking token budget, Opus reviews its past reasoning chains and identifies systematic patterns: "In 3 of 5 sessions on business strategy, I consistently underweighted operational complexity. Here's the evidence from each session."

**Why it wins**: This is the "wow" closer. AI that identifies its own blind spots. Only possible with Opus 4.6's 50K thinking budget.

**Technical approach**:

1. MetacognitionEngine already built — gathers nodes, builds context, uses tool calls
2. NEW: Build MetacogInsights UI — tabbed display of patterns, biases, improvements
3. NEW: Each insight links back to the specific reasoning nodes that are evidence
4. IMPORTANT: Pre-seed 3-4 reasoning sessions before demo so there's enough data

---

## DAY-BY-DAY EXECUTION

### Day 1 (Monday Feb 10): Backend Complete

**Morning (4 hrs)**:

- [ ] Build ThinkForkEngine (`packages/core/src/think-fork.ts`)
  - 3 concurrent Opus calls with `Promise.allSettled`
  - Post-process convergence/divergence with a 4th call
  - Store each branch as a `fork_branch` node in ThinkGraph
- [ ] Fix API `/api/think` route — full implementation calling ThinkingEngine + ThinkGraph
- [ ] Verify streaming SSE route works end-to-end

**Afternoon (4 hrs)**:

- [ ] Wire up API `/api/fork` → ThinkForkEngine (route exists, just needs the engine)
- [ ] Wire up API `/api/insights` → MetacognitionEngine (POST route partially built)
- [ ] Add API route for graph queries: `GET /api/reasoning/:sessionId/nodes`
- [ ] Add API route for human checkpoint: `POST /api/reasoning/:nodeId/checkpoint`
- [ ] Test all API routes with curl/httpie

**Exit criteria**: All 3 features work at the API level. You can call every endpoint and get correct JSON back.

### Day 2 (Tuesday Feb 11): Core UI — Streaming + Graph

**Morning (4 hrs)**:

- [ ] Build Dashboard layout (3-panel: stream | graph | inspector)
- [ ] Build ThinkingStream component — SSE connection, live token rendering
  - Typewriter effect for thinking tokens
  - Visual separator when thinking ends and response begins
  - Auto-scroll with scroll-lock on user interaction

**Afternoon (4 hrs)**:

- [ ] Build ReasoningGraph component with react-flow
  - Node types: `analysis`, `hypothesis`, `evaluation`, `conclusion`
  - Edge types: `influences`, `supports`, `contradicts`
  - Color coding by confidence score (green → yellow → red)
  - Animated build: nodes appear sequentially after stream completes
- [ ] Build NodeInspector panel — click a node to see full reasoning text

**Exit criteria**: You can ask a question, watch thinking stream, and see the reasoning graph build. Clicking nodes shows details.

### Day 3 (Wednesday Feb 12): Human-in-the-Loop + ThinkFork UI

**Morning (4 hrs)**:

- [ ] Add Human Checkpoint to NodeInspector
  - ✓ Verified / ⚠ Questionable / ✗ Disagree buttons
  - Correction text input when flagging
  - "Re-reason from here" action → calls API with correction context
  - New reasoning branch appears on graph as alternate path
- [ ] Store human annotations as `human_annotation` nodes in ThinkGraph

**Afternoon (4 hrs)**:

- [ ] Build ThinkForkViewer UI
  - Trigger button: "Explore Divergent Paths"
  - 3-column layout showing concurrent branch results
  - Convergence highlights (green) and divergence highlights (red)
  - "Choose this assumption" interaction on divergence points
- [ ] Loading states for concurrent branch execution

**Exit criteria**: Full human-in-the-loop loop works. ThinkFork shows 3 branches with divergence highlighted.

### Day 4 (Thursday Feb 13): Metacognition UI + Polish

**Morning (4 hrs)**:

- [ ] Build MetacogInsights UI
  - "Analyze My Reasoning" button
  - Loading state with progress indicator (this takes ~60-90 seconds)
  - Tabbed display: Patterns | Biases | Improvements
  - Each insight card links to evidence nodes (click to navigate in graph)
- [ ] Pre-seed demonstration data — run 4-5 reasoning sessions on business strategy topics

**Afternoon (4 hrs)**:

- [ ] Visual polish pass
  - Consistent color palette (dark theme works best for this type of tool)
  - Smooth transitions and animations
  - Responsive layout
  - Loading skeletons everywhere
- [ ] Fix the critical bugs from the CLAUDE_AUDIT:
  - JSON parse silent failure in `use-thinking-stream.ts`
  - Compaction node persistence failure
  - N+1 edge query in session nodes route

**Exit criteria**: All 3 features work beautifully. The app looks professional.

### Day 5-6 (Friday–Sunday Feb 14–16): Demo + Submit

**Friday**:

- [ ] Record demo video (7 minutes)
- [ ] Write demo script (see below)
- [ ] Do 3 complete run-throughs, pick the best

**Saturday**:

- [ ] Edge case testing — what happens with short questions? API errors? Slow responses?
- [ ] Fix any issues from demo recording
- [ ] Write submission description

**Sunday (submit by 3pm EST)**:

- [ ] Final test on production (Vercel)
- [ ] Submit to Cerebral Valley portal
- [ ] Celebrate 🎉

---

## DEMO SCRIPT (7 Minutes)

### Opening (30 seconds)

"Every AI system treats its most valuable output — the reasoning process — as disposable. You get an answer, but you can never audit how it got there. For high-stakes decisions, that's not good enough. Opus Nx makes AI reasoning auditable, verifiable, and honest."

### Scene 1: Live Reasoning Archaeology (2.5 min)

*Action*: Ask Opus — "Should a Series A startup with $3M ARR and 40% churn pivot from B2C SaaS to B2B enterprise?"

*Show*:

1. Thinking tokens streaming live — the audience watches Opus genuinely wrestle with the problem
2. Stream ends → reasoning graph builds in react-flow, node by node
3. Click a decision point node: "Here Opus assumed customer acquisition cost stays constant during pivot. That's a big assumption."
4. Flag it as ⚠ Questionable. Type: "CAC typically increases 3-5x during B2C to B2B transition."
5. Hit "Re-reason" → new reasoning branch appears, incorporating the correction
6. "This is human-in-the-loop reasoning. Not just chatting with AI — actually auditing and correcting the logical chain."

### Scene 2: Divergence Detection (2.5 min)

*Action*: Same question, but trigger "Explore Divergent Paths"

*Show*:

1. Three reasoning branches running concurrently (show loading spinners)
2. Results appear: all three agree on market timing but diverge on team readiness
3. Highlight the divergence: "Branch 1 assumes you can reskill the existing team. Branch 3 assumes you need to hire enterprise sales from scratch. That disagreement tells you where the real uncertainty is."
4. Click "Choose assumption" on the divergence point
5. "When independent reasoning chains agree, you can be confident. When they disagree, that's exactly where a human needs to make the call."

### Scene 3: Metacognitive Self-Audit (1.5 min)

*Action*: Show 4-5 past sessions. Trigger "Analyze My Reasoning."

*Show*:

1. Opus reviews its own reasoning history using the full 50K thinking token budget
2. Results: "Pattern detected — in 4 of 5 business strategy sessions, I consistently anchored on revenue metrics before considering operational feasibility. This may lead to recommendations that are financially attractive but operationally risky."
3. Click the evidence — it links directly to the specific reasoning nodes
4. "This is AI metacognition. Only possible with Opus 4.6's 50,000-token thinking budget. The AI doesn't just think — it thinks about how it thinks."

### Closing (30 seconds)

"Opus 4.6 has the deepest reasoning capability of any AI model. But deep reasoning without transparency is just a more convincing black box. Opus Nx makes that reasoning persistent, auditable, and self-correcting. Because the most creative use of extended thinking isn't making AI smarter — it's making AI trustworthy."

---

## API CREDIT BUDGET ($500)

At Opus 4.6 pricing ($5/M input, $25/M output):

| Activity               | Est. Input   | Est. Output (incl thinking) | Cost |
| ---------------------- | ------------ | --------------------------- | ---- |
| Dev/testing (Days 1-4) | ~5M tokens   | ~10M tokens                 | $275 |
| Demo recording (Day 5) | ~1M tokens   | ~3M tokens                  | $80  |
| Pre-seeded sessions    | ~500K tokens | ~2M tokens                  | $53  |
| Buffer                 | —            | —                           | ~$92 |

**Cost-saving tactics**:

- Use `effort: "medium"` during dev, `effort: "max"` only for demo
- Cache responses locally during iterative UI development
- Don't run ThinkFork (3x cost) during basic UI testing
- Pre-seed metacognition demo data once, then reuse

---

## TECHNICAL IMPLEMENTATION NOTES

### ThinkForkEngine (The Key Missing Piece)

```typescript
// packages/core/src/think-fork.ts
export class ThinkForkEngine {
  private thinkingEngine: ThinkingEngine;

  async fork(query: string, options: ForkOptions): Promise<ForkResult> {
    // 1. Generate 3 branch prompts with different assumption frames
    const branchPrompts = this.generateBranchPrompts(query, options.styles);

    // 2. Execute concurrently
    const branches = await Promise.allSettled(
      branchPrompts.map(prompt => this.executeBranch(prompt, query, options.effort))
    );

    // 3. Analyze convergence/divergence with a synthesis call
    const analysis = await this.analyzeConvergenceDivergence(
      branches.filter(b => b.status === 'fulfilled').map(b => b.value),
      query
    );

    return { branches: [...], convergencePoints: analysis.convergence,
             divergencePoints: analysis.divergence, ... };
  }
}
```

### Human Checkpoint API

```typescript
// POST /api/reasoning/:nodeId/checkpoint
// Body: { verdict: "verified"|"questionable"|"disagree", correction?: string }
//
// 1. Store human annotation as a node linked to the flagged node
// 2. If correction provided, re-invoke Opus with:
//    - Original conversation context
//    - The reasoning chain up to the flagged point
//    - Human correction injected: "The previous reasoning assumed X, but the user
//      corrects: [correction]. Re-reason from this point."
// 3. Store new reasoning branch linked to the checkpoint
// 4. Return new branch for UI to render
```

### Streaming Architecture

```
Browser ←SSE→ Next.js API Route ←Stream→ Anthropic SDK
  │                                          │
  │  event: thinking                         │  content_block_delta
  │  data: {"token": "Let me think..."}      │  (thinking_delta)
  │                                          │
  │  event: text                             │  content_block_delta
  │  data: {"token": "Based on my..."}       │  (text_delta)
  │                                          │
  │  event: complete                         │  message_stop
  │  data: {"nodeId": "uuid", ...}           │
```

---

## KNOWN RISKS & MITIGATIONS

| Risk                                        | Impact                      | Mitigation                                                       |
| ------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| ThinkGraph parsing quality varies           | Reasoning graphs look messy | Fallback: split by paragraph, label as generic "reasoning" steps |
| MetaCog needs volume you won't have in demo | Insights feel shallow       | Pre-seed 4-5 carefully chosen sessions on same domain            |
| API costs exceed budget                     | Can't finish demo           | Track costs daily, use medium effort during dev                  |
| react-flow learning curve                   | UI takes too long           | Start with basic nodes/edges, polish last                        |
| Streaming JSON parse errors (known bug)     | Silent failures             | Fix Day 1 — add try-catch with fallback text display             |
| Demo question produces boring graph         | Judges aren't impressed     | Test 10 questions, pick the one with richest reasoning chain     |

---

## WINNING PSYCHOLOGY

The judges have seen hundreds of AI apps. What makes them lean forward:

1. **Live streaming thinking tokens** — Most people have never seen this. It's inherently captivating.
2. **A human actually correcting AI reasoning** — Not just prompting, but surgically modifying a logical step.
3. **Three reasoning chains disagreeing** — The "aha" moment when you realize disagreement reveals uncertainty.
4. **AI admitting its own biases** — This is what Anthropic's mission is about. When Opus says "I have a pattern of anchoring on revenue metrics," every judge in the room will feel that.

Don't oversell. Let the product speak. The demo should feel like a tool someone would actually use, not a tech demo. Quiet confidence beats hype.

---

*Built with Claude Code. Built to win.*
