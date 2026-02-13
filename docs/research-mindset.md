# Research Mindset and Operating Model

## 1. Principle

Treat reasoning as an artifact lifecycle, not a one-shot response stream.

## 2. Core Research Loop

1. Observe: capture structured reasoning artifacts per run.
2. Hypothesize: identify candidate policy improvements.
3. Intervene: rerun with controlled corrections or prompts.
4. Evaluate: compare quality and efficiency deltas.
5. Retain: promote winning policies and archive weak alternatives.

## 3. Experimental Discipline

### 3.1 What We Track

1. Quality metrics: verifier score, contradiction rate, synthesis confidence.
2. Efficiency metrics: time-to-policy, reruns, token cost.
3. Retrieval metrics: precision@k, MRR, cross-session hit rate.
4. Human impact metrics: checkpoint acceptance and correction uptake.

### 3.2 What Counts as Evidence

1. Repeatable improvement across benchmark tasks.
2. Measured tradeoff, not single-metric optimization.
3. Clear attribution between intervention and quality lift.

## 4. Repository Ground Rules

1. Preserve historical context in archive docs.
2. Keep canonical docs current with implementation changes.
3. Require tests for behavioral changes.
4. Prefer explicit assumptions and measurable acceptance criteria.

## 5. Contribution Mindset

Contributions should improve at least one of:

1. Reasoning quality
2. Reproducibility
3. Inspectability
4. Setup and contributor ergonomics

## 6. Publication-Ready Thinking

When proposing major changes, frame them as:

1. Why this matters scientifically or operationally.
2. What mechanism is changing.
3. How it will be evaluated.
4. So what impact we expect.
