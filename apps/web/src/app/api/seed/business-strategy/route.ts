import { cookies } from "next/headers";
import {
  createSession,
  updateSessionPlan,
  createThinkingNode,
  createReasoningEdge,
  createDecisionPoint,
  createMetacognitiveInsights,
} from "@/lib/db";
import { getCorrelationId, jsonError, jsonSuccess } from "@/lib/api-response";

/**
 * POST /api/seed/business-strategy
 * Seed 5 related business strategy sessions for metacognition pattern detection.
 * Theme: Series A startup decision-making (pivot, growth, scaling)
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  // Verify authentication
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return jsonError({
      status: 500,
      code: "AUTH_MISCONFIGURED",
      message: "Server misconfiguration",
      correlationId,
    });
  }

  const cookieStore = await cookies();
  const authCookie = cookieStore.get("opus-nx-auth");
  if (!authCookie?.value) {
    return jsonError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authentication required",
      correlationId,
    });
  }

  const { verifyAuthSignature } = await import("@/lib/auth");
  if (!verifyAuthSignature(authCookie.value, secret)) {
    return jsonError({
      status: 401,
      code: "INVALID_AUTH",
      message: "Invalid authentication",
      correlationId,
    });
  }

  try {
    const sessions = await Promise.all([
      seedPivotSession(),
      seedGrowthSession(),
      seedProductFocusSession(),
      seedScalingSession(),
      seedFundingSession(),
    ]);

    return jsonSuccess(
      {
        success: true,
        sessions: sessions.map((s) => ({ id: s.id, name: s.name })),
        totalSessions: sessions.length,
        message: "Business strategy sessions seeded for metacognition analysis",
      },
      { correlationId }
    );
  } catch (error) {
    console.error("[API] Business strategy seeding failed:", { correlationId, error });
    return jsonError({
      status: 500,
      code: "SEED_FAILED",
      message: error instanceof Error ? error.message : "Seeding failed",
      correlationId,
    });
  }
}

// Session 1: The main demo question - B2C to B2B pivot
async function seedPivotSession() {
  const session = await createSession();
  await updateSessionPlan(session.id, {
    isDemo: true,
    displayName: "B2C to B2B Pivot Analysis",
  });

  const node1 = await createThinkingNode({
    sessionId: session.id,
    reasoning: `Analyzing the pivot decision for a Series A startup with $3M ARR and 40% churn. This is a critical strategic inflection point.

Initial assessment:
- $3M ARR is respectable for Series A but 40% churn is alarming
- B2C SaaS typically has higher churn than B2B, but 40% is extreme even for B2C
- The question isn't just "should we pivot" but "can we survive if we don't"

Key factors to analyze:
1. Root cause of churn - is it product-market fit or B2C market dynamics?
2. CAC payback period at 40% churn - likely unprofitable
3. Unit economics trajectory - improving or worsening?
4. Team composition - do we have enterprise sales DNA?
5. Product architecture - can it support enterprise requirements?

My initial instinct is that 40% churn is unsustainable regardless of revenue. But I need to understand WHY churn is so high before recommending a pivot.`,
    confidenceScore: 0.72,
    inputQuery: "Should a Series A startup with $3M ARR and 40% churn pivot from B2C SaaS to B2B enterprise?",
  });

  const node2 = await createThinkingNode({
    sessionId: session.id,
    parentNodeId: node1.id,
    reasoning: `Deep dive on unit economics at 40% churn:

LTV calculation with 40% annual churn:
- Average customer lifetime = 1/0.40 = 2.5 years
- If ARPU is $100/month: LTV = $3,000
- If CAC is typical B2C SaaS at $500-800: LTV/CAC = 4-6x (actually decent)
- But at $3M ARR needing growth: CAC likely much higher

The real problem emerges with growth math:
- Need to acquire (0.40 * customers) + growth just to stay flat
- At $3M ARR with $100 ARPU: ~2,500 customers
- Losing 1,000 customers/year to churn
- Just to grow 30%: need to acquire 1,750 new customers annually
- That's 70% of base acquired every year - unsustainable CAC pressure

My confidence is increasing that a pivot is necessary. But B2B isn't automatically the answer - enterprise sales cycles are 6-12 months and require different skills entirely.

Key question: Is the product solving a real problem that enterprises would pay 10-50x more for? If not, pivot to B2B is just delaying failure.`,
    confidenceScore: 0.78,
    inputQuery: "Analyze unit economics at 40% churn rate",
  });

  const node3 = await createThinkingNode({
    sessionId: session.id,
    parentNodeId: node2.id,
    reasoning: `Examining the B2B enterprise opportunity more carefully. This is where I need to be honest about the challenges.

Enterprise B2B advantages:
- Lower churn (10-15% typical vs 40%)
- Higher ARPU ($10k-100k/year vs $1.2k/year)
- Stickier relationships (multi-year contracts)
- More predictable revenue (annual billing)

But the pivot challenges are significant:
1. Sales cycle: 6-12 months vs B2C self-serve
2. Team: Need enterprise AEs, SEs, CS - expensive hires
3. Product: Need SSO, RBAC, audit logs, compliance (SOC2, HIPAA)
4. Support: SLAs, dedicated CSMs, on-call rotations
5. Runway: Pivot takes 12-18 months to show results

Critical decision point: Can the company survive 12-18 months with declining B2C metrics while building B2B?

With Series A funding, likely have 18-24 months runway. But investors expect growth, not strategic pivots that delay metrics.

I'm going to recommend a hybrid approach: start B2B motion now with existing product, use B2C revenue to fund transition, but cut B2C acquisition spend immediately.`,
    confidenceScore: 0.81,
    inputQuery: "Evaluate B2B enterprise opportunity",
  });

  const node4 = await createThinkingNode({
    sessionId: session.id,
    parentNodeId: node3.id,
    reasoning: `Final synthesis and recommendation:

RECOMMENDATION: Execute controlled pivot to B2B enterprise with hybrid transition.

Phase 1 (Months 1-3): Foundation
- Stop B2C paid acquisition immediately (preserve cash)
- Identify 10-20 B2C customers who "look" like enterprises (teams, business email)
- Convert 3-5 to pilot enterprise deals at 5x pricing
- Begin SOC2 compliance process

Phase 2 (Months 4-9): Validation
- If pilots convert to paid: proceed aggressively
- If pilots fail: either product doesn't solve enterprise problem OR execution issues
- Build minimum enterprise features (SSO, basic admin)
- Hire first enterprise AE

Phase 3 (Months 10-18): Scale or Die
- If 10+ enterprise customers: raise Series B on new trajectory
- If <5 enterprise customers: consider acqui-hire or wind down

Confidence: 85% that this is the right framework. The key risk is execution - most B2C teams struggle with enterprise sales discipline.

Critical insight: The 40% churn is a gift - it's forcing a decision that should have been made earlier. Companies often limp along with 25% churn for years before facing reality.`,
    confidenceScore: 0.85,
    inputQuery: "What is the recommended pivot strategy?",
  });

  // Create edges and decision points
  await Promise.all([
    createReasoningEdge({ sourceId: node1.id, targetId: node2.id, edgeType: "influences", weight: 0.9 }),
    createReasoningEdge({ sourceId: node2.id, targetId: node3.id, edgeType: "influences", weight: 0.85 }),
    createReasoningEdge({ sourceId: node3.id, targetId: node4.id, edgeType: "influences", weight: 0.9 }),
    createReasoningEdge({ sourceId: node1.id, targetId: node4.id, edgeType: "refines", weight: 0.7 }),
  ]);

  await createDecisionPoint({
    thinkingNodeId: node4.id,
    stepNumber: 1,
    description: "B2C to B2B pivot strategy",
    chosenPath: "Controlled hybrid pivot - stop B2C acquisition, start enterprise pilots",
    alternatives: [
      { path: "Double down on B2C with retention focus", reasonRejected: "40% churn is structural, not fixable with retention tactics" },
      { path: "Immediate full pivot to B2B only", reasonRejected: "Too risky - need B2C revenue during 12-18 month transition" },
      { path: "Seek acqui-hire now", reasonRejected: "Premature - enterprise opportunity not yet validated" },
    ],
    confidence: 0.85,
    reasoningExcerpt: "Execute controlled pivot to B2B enterprise with hybrid transition.",
  });

  // Add metacognitive insights for this session
  await createMetacognitiveInsights([
    {
      sessionId: session.id,
      thinkingNodesAnalyzed: [node1.id, node2.id, node3.id, node4.id],
      insightType: "bias_detection",
      insight: "Growth Optimism Bias — The analysis exhibits a recurring pattern of assuming successful execution of challenging pivots. The 85% confidence in the hybrid approach may underweight organizational inertia and the cultural difficulty of B2C→B2B transitions.",
      evidence: [
        { nodeId: node3.id, excerpt: "most B2C teams struggle with enterprise sales discipline", relevance: 0.92 },
        { nodeId: node4.id, excerpt: "Confidence: 85% that this is the right framework", relevance: 0.88 },
      ],
      confidence: 0.86,
      metadata: { actionability: "high" },
    },
    {
      sessionId: session.id,
      thinkingNodesAnalyzed: [node1.id, node2.id, node4.id],
      insightType: "pattern",
      insight: "Phased Approach Preference — Across strategic decisions, there's a consistent pattern of recommending phased/hybrid approaches over binary choices. While often pragmatic, this may avoid necessary decisive action in time-critical situations.",
      evidence: [
        { nodeId: node4.id, excerpt: "Phase 1 (Months 1-3): Foundation", relevance: 0.95 },
        { nodeId: node3.id, excerpt: "hybrid approach: start B2B motion now with existing product", relevance: 0.9 },
      ],
      confidence: 0.91,
      metadata: { actionability: "medium" },
    },
    {
      sessionId: session.id,
      thinkingNodesAnalyzed: [node2.id, node3.id],
      insightType: "improvement_hypothesis",
      insight: "Missing Founder Psychology Analysis — The reasoning focuses on metrics and execution but doesn't analyze founder/team psychology. B2C→B2B pivots often fail not from strategy but from founder identity attachment to original vision.",
      evidence: [
        { nodeId: node3.id, excerpt: "Need enterprise AEs, SEs, CS - expensive hires", relevance: 0.78 },
        { nodeId: node2.id, excerpt: "enterprise sales cycles are 6-12 months and require different skills", relevance: 0.82 },
      ],
      confidence: 0.79,
      metadata: { actionability: "high" },
    },
  ]);

  return { id: session.id, name: "B2C to B2B Pivot Analysis", nodeIds: [node1.id, node2.id, node3.id, node4.id] };
}

// Session 2: Growth optimization
async function seedGrowthSession() {
  const session = await createSession();
  await updateSessionPlan(session.id, {
    isDemo: true,
    displayName: "Growth vs Profitability Tradeoff",
  });

  const node1 = await createThinkingNode({
    sessionId: session.id,
    reasoning: `Analyzing the classic startup dilemma: grow fast with negative unit economics or grow slower with sustainable margins?

Context: Series A startup burning $300k/month with 18 months runway.

The conventional VC wisdom says "grow at all costs" - but that playbook was written for 2021 ZIRP markets. In 2024+, capital efficiency matters again.

Key metrics to consider:
- Burn multiple: Net burn / Net new ARR
- CAC payback: Months to recover customer acquisition cost
- Gross margin: Does the core product make money?
- NRR: Are existing customers expanding?

I'm noticing a pattern in my reasoning: I tend to favor growth over profitability. Let me steelman the profitability argument.

Arguments for prioritizing profitability:
1. Default alive > default dead (reduces existential risk)
2. Better negotiating position for Series B
3. Forces product discipline (only build what customers pay for)
4. Market downturns can't kill you
5. Team morale - layoffs are toxic

Arguments for prioritizing growth:
1. Winner-take-most markets require speed
2. VCs want growth, not profits at early stage
3. Category creation requires investment
4. Top talent wants fast-growing companies
5. Growth compounds; efficiency doesn't`,
    confidenceScore: 0.68,
    inputQuery: "How should a Series A startup balance growth vs profitability?",
  });

  const node2 = await createThinkingNode({
    sessionId: session.id,
    parentNodeId: node1.id,
    reasoning: `After deeper analysis, I'm updating my framework. The answer depends heavily on market position.

If you're clearly #1 or #2: Prioritize growth
- Land grab matters more than efficiency
- Market leadership compounds
- Can raise to fund growth

If you're #3+: Prioritize efficiency
- Can't out-spend leaders
- Need differentiated wedge
- Must prove model before scaling

The insight here is that growth vs efficiency isn't a philosophical choice - it's a strategic positioning decision.

For our hypothetical startup:
- $300k/month burn, 18 months runway = $5.4M remaining
- At typical Series B bar of $10M+ ARR, need to 3x+ current ARR
- If CAC payback is 12 months, math doesn't work

Recommendation: Cut burn to $200k/month (extends runway to 27 months), focus 100% on improving unit economics for 6 months, THEN reaccelerate growth with proven model.

This is the "get healthy, then sprint" approach. It requires convincing investors to accept slower growth now for sustainable growth later.`,
    confidenceScore: 0.79,
    inputQuery: "How does market position affect growth strategy?",
  });

  await createReasoningEdge({ sourceId: node1.id, targetId: node2.id, edgeType: "refines", weight: 0.85 });

  await createDecisionPoint({
    thinkingNodeId: node2.id,
    stepNumber: 1,
    description: "Growth vs efficiency prioritization",
    chosenPath: "Efficiency-first: cut burn, fix unit economics, then reaccelerate",
    alternatives: [
      { path: "Growth at all costs - raise bridge round", reasonRejected: "2024 market doesn't reward unprofitable growth" },
      { path: "Maintain current burn rate", reasonRejected: "18 months isn't enough runway to hit Series B bar" },
      { path: "Immediate profitability via layoffs", reasonRejected: "Too aggressive - loses ability to execute growth later" },
    ],
    confidence: 0.79,
    reasoningExcerpt: "Cut burn to extend runway, fix unit economics, then reaccelerate with proven model.",
  });

  return { id: session.id, name: "Growth vs Profitability Tradeoff" };
}

// Session 3: Product focus
async function seedProductFocusSession() {
  const session = await createSession();
  await updateSessionPlan(session.id, {
    isDemo: true,
    displayName: "Product Expansion Strategy",
  });

  const node1 = await createThinkingNode({
    sessionId: session.id,
    reasoning: `Evaluating when to expand product scope vs deepening core functionality.

The startup has a core product with 70% customer satisfaction but competitors are adding features rapidly.

This is the classic "mile wide, inch deep" vs "inch wide, mile deep" decision.

Signals to EXPAND:
- Core product is commoditized (no moat from depth)
- Customers explicitly asking for adjacent features
- High churn due to incomplete solution
- Platform opportunities with network effects

Signals to DEEPEN:
- Core NPS is mediocre (need to fix basics first)
- Best customers are power users of core
- Expansion features are "nice to have" not "must have"
- Resources are limited (can't do both well)

I'm noticing a bias: I tend to favor expansion because it's more exciting. But the data often supports deepening.

Analysis: With 70% satisfaction, there's still 30% unhappy. Expanding before fixing core satisfaction is building on sand. Classic mistake is "feature escape" - adding features to distract from core problems.`,
    confidenceScore: 0.74,
    inputQuery: "When should a startup expand product scope vs deepen core?",
  });

  const node2 = await createThinkingNode({
    sessionId: session.id,
    parentNodeId: node1.id,
    reasoning: `Framework for product expansion decision:

Step 1: Measure core product health
- NPS > 40: Ready to consider expansion
- NPS 20-40: Fix core first
- NPS < 20: Existential core problem

Step 2: Analyze expansion opportunities
- Retention impact: Will this reduce churn?
- Revenue impact: Will this increase ARPU?
- Competitive impact: Will this create moat?

Step 3: Resource reality check
- Can we maintain core quality AND expand?
- Do we have the right team?
- Is timeline realistic?

For the 70% satisfaction case:
- Need to understand WHY 30% are unsatisfied
- If it's missing features → expand might help
- If it's core quality → expansion will make things worse

My recommendation: Interview the 30% unsatisfied customers before making this decision. The answer will be obvious once you understand their pain.

Confidence is moderate because I don't have the customer interview data to validate the recommendation.`,
    confidenceScore: 0.71,
    inputQuery: "Framework for product expansion decision",
  });

  await createReasoningEdge({ sourceId: node1.id, targetId: node2.id, edgeType: "influences", weight: 0.8 });

  await createDecisionPoint({
    thinkingNodeId: node2.id,
    stepNumber: 1,
    description: "Product expansion vs core deepening",
    chosenPath: "Interview unsatisfied customers before deciding",
    alternatives: [
      { path: "Expand immediately to match competitors", reasonRejected: "Feature parity isn't differentiation - need to understand customer needs" },
      { path: "Focus entirely on core NPS improvement", reasonRejected: "May miss legitimate expansion opportunities" },
      { path: "Build both in parallel", reasonRejected: "Resource constraints make parallel development low quality" },
    ],
    confidence: 0.71,
    reasoningExcerpt: "Interview the 30% unsatisfied customers before making this decision.",
  });

  return { id: session.id, name: "Product Expansion Strategy" };
}

// Session 4: Team scaling
async function seedScalingSession() {
  const session = await createSession();
  await updateSessionPlan(session.id, {
    isDemo: true,
    displayName: "Remote Team Scaling Challenges",
  });

  const node1 = await createThinkingNode({
    sessionId: session.id,
    reasoning: `Analyzing remote team scaling challenges for a 25-person startup planning to grow to 50.

Key challenges I see:
1. Communication overhead grows O(n²) with team size
2. Cultural cohesion is harder to maintain remotely
3. Onboarding new hires is slower without in-person learning
4. Middle management layer becomes necessary but is often resisted
5. Timezone coordination becomes complex

The founder's instinct is often "we can stay flat until 100 people" - this almost never works beyond 30.

Dunbar's number suggests cognitive limit of ~150 relationships. But meaningful working relationships are more like 15-20. Once team exceeds this, silos emerge naturally.

I'm noticing a pattern in startup scaling: the transition from 20-50 is actually harder than 50-100. At 50-100, you've already built the management infrastructure. At 20-50, you're inventing it while running the business.

Key insight: The goal isn't to prevent hierarchy - it's to create the RIGHT hierarchy before the wrong one emerges organically.`,
    confidenceScore: 0.76,
    inputQuery: "How should a remote startup scale from 25 to 50 people?",
  });

  const node2 = await createThinkingNode({
    sessionId: session.id,
    parentNodeId: node1.id,
    reasoning: `Framework for 25→50 scaling:

Phase 1 (25-35): Create functional pods
- Engineering: 2-3 pods of 4-5 with tech leads
- Product: 1-2 PMs, design pod
- GTM: Sales pod, marketing pod
- Each pod has clear owner and scope

Phase 2 (35-45): Add middle management
- Promote internal or hire 2-3 senior leaders
- These become the "connective tissue" between pods
- CEO moves from player to coach

Phase 3 (45-50): Formalize processes
- Weekly all-hands (async-first with sync recap)
- Quarterly OKRs with pod-level goals
- 1:1 cadence documented and enforced

Critical mistake to avoid: Hiring a VP too early. VPs are for 100+ companies. At 25-50, you need senior ICs who can also lead, not executives who need teams built for them.

The remote factor adds complexity:
- Over-communicate in writing (Loom, Notion, Slack)
- Bi-annual in-person offsites (non-negotiable)
- Timezone-aware meeting policies
- Async-by-default culture

Confidence is high because this pattern repeats across hundreds of startups I've analyzed.`,
    confidenceScore: 0.82,
    inputQuery: "Framework for scaling remote teams",
  });

  await createReasoningEdge({ sourceId: node1.id, targetId: node2.id, edgeType: "influences", weight: 0.85 });

  await createDecisionPoint({
    thinkingNodeId: node2.id,
    stepNumber: 1,
    description: "Team scaling approach",
    chosenPath: "Phased pod-based structure with internal promotions",
    alternatives: [
      { path: "Stay flat until 100", reasonRejected: "Communication chaos emerges around 30 people" },
      { path: "Hire experienced VP immediately", reasonRejected: "VPs are for 100+ companies, premature at 25-50" },
      { path: "Return to office to solve coordination", reasonRejected: "Remote isn't the problem - unclear structure is" },
    ],
    confidence: 0.82,
    reasoningExcerpt: "Create functional pods with clear ownership, add middle management at 35, formalize processes at 45.",
  });

  return { id: session.id, name: "Remote Team Scaling Challenges" };
}

// Session 5: Funding timing
async function seedFundingSession() {
  const session = await createSession();
  await updateSessionPlan(session.id, {
    isDemo: true,
    displayName: "Series B Timing Considerations",
  });

  const node1 = await createThinkingNode({
    sessionId: session.id,
    reasoning: `Analyzing Series B timing for a startup with $4M ARR, 12 months runway, and 80% growth.

Standard Series B bar (2024): $10M+ ARR, 80%+ retention, efficient growth

Current position:
- $4M ARR × 1.8 (80% growth) = $7.2M in 12 months
- Still short of $10M bar
- 12 months runway is concerning

The timing question has multiple dimensions:
1. Market timing: Is now a good time to raise?
2. Metrics timing: Will metrics improve with more time?
3. Team timing: Do we have the right team to raise?
4. Competitive timing: Will waiting hurt positioning?

I'm seeing a tension: Waiting improves metrics but risks running out of runway. Raising now is easier but may result in worse terms.

Key insight: Series B is about proving scalability, not just growth. Investors want to see that each dollar invested produces predictable returns. CAC:LTV ratio matters more than topline growth at this stage.

The 80% growth sounds good, but I need to understand how it's being achieved. Paid growth vs organic growth have very different Series B implications.`,
    confidenceScore: 0.73,
    inputQuery: "When should a $4M ARR startup raise Series B?",
  });

  const node2 = await createThinkingNode({
    sessionId: session.id,
    parentNodeId: node1.id,
    reasoning: `Decision framework for Series B timing:

Option A: Raise now (Month 0)
- Pros: More runway, less pressure, hedge against market changes
- Cons: May not hit optimal metrics, potentially worse terms
- Likely raise: $15-20M at $60-80M valuation

Option B: Raise at Month 6
- Pros: Better metrics ($5.5M ARR), clearer trajectory
- Cons: Only 6 months runway when raising (risky)
- Likely raise: $20-25M at $80-100M valuation

Option C: Extend runway, raise at Month 9
- Pros: Best possible metrics, strongest position
- Cons: Requires cuts, may hurt growth, team morale risk
- Likely raise: $25-30M at $100-120M if metrics hit

My recommendation: Start Series B process now (Month 0), target close at Month 4-5.

This gives best of both worlds:
- Process takes 3-4 months anyway
- Metrics will improve during diligence
- Close with 7-8 months runway (acceptable)
- Avoid desperation dynamics

The critical insight: Never raise from a position of need. Start the process when you don't NEED the money, even if you want it.

Confidence is high on timing, moderate on specific valuations (market-dependent).`,
    confidenceScore: 0.80,
    inputQuery: "Series B timing recommendation",
  });

  await createReasoningEdge({ sourceId: node1.id, targetId: node2.id, edgeType: "influences", weight: 0.88 });

  await createDecisionPoint({
    thinkingNodeId: node2.id,
    stepNumber: 1,
    description: "Series B timing",
    chosenPath: "Start process now, target close at Month 4-5",
    alternatives: [
      { path: "Wait for $10M ARR milestone", reasonRejected: "Would require raising with <6 months runway" },
      { path: "Raise immediately with current metrics", reasonRejected: "Suboptimal terms when metrics are improving" },
      { path: "Extend runway with bridge round", reasonRejected: "Bridge rounds signal weakness to Series B investors" },
    ],
    confidence: 0.80,
    reasoningExcerpt: "Never raise from a position of need. Start the process when you don't NEED the money.",
  });

  return { id: session.id, name: "Series B Timing Considerations" };
}
