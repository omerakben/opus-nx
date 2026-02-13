# Opus Nx Product Requirements Document

## 1. Product Summary

Opus Nx is an open-source research platform for persistent, analyzable AI reasoning. It turns model reasoning traces into structured artifacts that can be reviewed, compared, rerun, and improved.

The current direction is no longer hackathon-only delivery. The product is now optimized for:

1. Research teams validating reasoning quality and policy improvement.
2. Builders who want a transparent AI workspace with reproducible workflows.
3. Open-source contributors adding new reasoning strategies, evaluation loops, and UX.

## 2. Problem Statement

Most AI products expose only final answers. This creates three gaps:

1. Poor inspectability: the reasoning path is hidden or ephemeral.
2. Weak iteration loop: teams cannot systematically improve reasoning policy over time.
3. Low portability: many projects depend on maintainer-owned credentials or infra.

Opus Nx addresses these with persistent reasoning graphs, hypothesis lifecycle tooling, and bring-your-own-credentials setup.

## 3. Goals

### 3.1 Primary Goals

1. Preserve reasoning as durable artifacts, not disposable text.
2. Support repeatable quality improvement via promote -> rerun -> compare -> retain workflows.
3. Make onboarding simple for external users using their own provider accounts.
4. Increase contribution velocity with clear docs, runbooks, and contributor standards.

### 3.2 Non-Goals (Current Phase)

1. Full multi-tenant account system with hosted key vaulting.
2. Managed cloud offering with billing and per-user quotas.
3. Replacing all historical docs in archive.

## 4. Target Users

1. AI researchers studying reasoning quality, consistency, and retrieval effects.
2. Engineer-researchers building explainable AI workflows.
3. OSS contributors extending reasoning engines and swarm orchestration.

## 5. Current Scope

### 5.1 User-Facing Capabilities

1. Persistent ThinkGraph sessions with node/edge storage.
2. ThinkFork branching with style-based divergence.
3. Swarm orchestration with multi-agent event streaming.
4. PRM-style verification of reasoning steps.
5. Metacognitive insights and hypothesis lifecycle controls.
6. Session sharing and replayable context.

### 5.2 Platform Capabilities

1. Next.js workspace and API surface.
2. Python FastAPI swarm backend.
3. Supabase persistence with pgvector retrieval.
4. Evaluation harnesses for quality and retrieval metrics.

## 6. Credential Ownership Model

Users run Opus Nx with their own credentials:

1. Anthropic API key for reasoning calls.
2. Supabase project URL and keys for persistence.
3. Optional providers for extended retrieval/research paths.

Setup is documented and script-assisted (`pnpm setup`, `pnpm setup:verify`).

## 7. Success Metrics

### 7.1 Product Metrics

1. Time to first successful local run.
2. Successful setup verification rate.
3. Workspace session completion without manual support.

### 7.2 Research Metrics

1. Verifier score trend over retained policies.
2. Contradiction-rate reduction across reruns.
3. Retrieval precision and MRR across benchmark tasks.

### 7.3 OSS Metrics

1. External PR count and merge rate.
2. First-time contributor cycle time.
3. Documentation issue rate (missing or outdated guides).

## 8. Risks and Mitigations

1. Risk: setup friction from provider credentials.
   - Mitigation: bootstrap script, explicit runbooks, clear error surfaces.
2. Risk: confusion between current docs and historical docs.
   - Mitigation: canonical docs index and explicit archive labeling.
3. Risk: auth model not suitable for multi-user hosted mode.
   - Mitigation: keep scoped access-code auth now, publish roadmap for multi-tenant auth.

## 9. Near-Term Roadmap

1. Stabilize BYO setup and workspace route split.
2. Harden route/auth policy and env diagnostics.
3. Expand contributor tooling and issue templates.
4. Add deeper benchmark automation for lifecycle outcomes.
