# Opus Nx Architecture

## 1. Overview

Opus Nx is a two-service reasoning system with a public entry surface and an authenticated workspace.

- Public route: `/`
- Authenticated workspace route: `/workspace`
- Access-code route: `/login`

The system persists reasoning artifacts and supports iterative experiment workflows over those artifacts.

## 2. High-Level Topology

```text
Browser
  -> Next.js app (apps/web)
      -> Core reasoning modules (packages/core)
      -> DB access layer (packages/db)
      -> Supabase (Postgres + pgvector)
      -> Swarm proxy routes (/api/swarm/*)
            -> Python FastAPI swarm service (agents)
```

### 2.1 Service Responsibilities

1. Next.js service
   - Public landing and setup guidance.
   - Auth-gated workspace UI.
   - API routes for thinking, fork, verification, sessions, and swarm proxying.
2. Python swarm service
   - Multi-agent orchestration.
   - WebSocket event stream.
   - Experiment lifecycle hooks and checkpoint processing.

## 3. Route and Auth Model

## 3.1 Public Routes

1. `/`
2. `/login`
3. `/share/[token]`
4. `/api/auth*`, `/api/demo`, `/api/health`

## 3.2 Protected Routes

1. `/workspace`
2. All other `/api/*` routes

Middleware verifies the signed `opus-nx-auth` cookie for protected routes.

## 4. Credential Ownership and Configuration

Opus Nx is BYO-credentials by default.

Required for workspace features:

1. `ANTHROPIC_API_KEY`
2. `AUTH_SECRET`
3. `SUPABASE_URL`
4. `SUPABASE_SERVICE_ROLE_KEY`
5. `SUPABASE_ANON_KEY`

Optional:

1. `VOYAGE_API_KEY`
2. `TAVILY_API_KEY`
3. Neo4j values for optional graph persistence paths

## 4.1 Scoped Validation

Environment validation is intentionally split:

1. Public-safe startup allows landing and docs access without full provider keys.
2. Workspace-safe validation checks required provider and persistence values before rendering workspace capabilities.

## 5. Data Architecture

Core data entities in Supabase:

1. `sessions`
2. `thinking_nodes`
3. `reasoning_edges`
4. `decision_points`
5. `metacognitive_insights`
6. `reasoning_artifacts`
7. `structured_reasoning_steps`
8. `structured_reasoning_hypotheses`
9. `hypothesis_experiments`
10. `hypothesis_experiment_actions`

Vector retrieval uses pgvector indexes and RPC matching functions for semantic candidate selection.

## 6. Runtime Flows

### 6.1 Workspace Reasoning Flow

1. User enters query in workspace.
2. Next.js API routes invoke core reasoning modules.
3. Results and structured artifacts persist to Supabase.
4. UI renders graph updates, verification, and insights.

### 6.2 Swarm Flow

1. Workspace calls `/api/swarm`.
2. Next.js proxy signs request using `AUTH_SECRET` HMAC.
3. FastAPI swarm runs phased agents and emits events.
4. Workspace subscribes over WebSocket for live status.

### 6.3 Hypothesis Lifecycle Flow

1. Promote hypothesis from session artifacts.
2. Rerun with correction or guidance.
3. Compare baseline vs rerun metrics.
4. Retain, defer, or archive policy outcome.

## 7. Developer Interfaces

### 7.1 Bootstrap and Verification

1. `pnpm setup` creates and aligns `.env` and `agents/.env`.
2. `pnpm setup:verify` checks provider connectivity and reports optional-provider status.

### 7.2 Core Development Commands

1. `pnpm dev`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `cd agents && uv run pytest`

## 8. Operational Notes

1. Demo mode is opt-in with `DEMO_MODE=true`.
2. Access-code auth is intentionally retained in this phase.
3. Full multi-tenant auth is roadmap, not current scope.
4. Historical hackathon docs are preserved under `docs/archive/build-history/`.
