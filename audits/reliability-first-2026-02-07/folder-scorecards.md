# Folder Scorecards

## Scoring Rubric
- `1`: Critical gaps and repeated operational risk.
- `2`: Material gaps; works but fragile under failure or change.
- `3`: Functional baseline with notable hardening needed.
- `4`: Strong implementation with minor gaps.
- `5`: Production-grade with clear reliability and observability controls.

## apps/web
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 2 | Core flows work, but several degraded paths are silent or inconsistently surfaced. |
| Observability | 2 | Route-level logging exists but no shared correlation ID or degraded-state contract. |
| Testability | 2 | No route-level regression tests for partial-success and streaming edge cases. |
| Doc-Code Alignment | 2 | Implemented route names differ from architecture/roadmap API contracts. |

- Purpose: Next.js dashboard and API layer for thinking, streaming, forking, insights, and sessions.
- Dependencies: `@opus-nx/core`, `@opus-nx/db`, `@opus-nx/shared`, Next.js runtime.
- Evidence:
- `apps/web/package.json:14`
- `apps/web/src/app/api/thinking/route.ts:12`
- `apps/web/src/app/api/thinking/stream/route.ts:13`
- `apps/web/src/lib/hooks/use-thinking-stream.ts:251`
- `apps/web/src/lib/hooks/use-graph.ts:66`

### Key Risks
- `SC-01`: Inconsistent error envelopes between routes (`apps/web/src/app/api/thinking/route.ts:97`, `apps/web/src/app/api/insights/route.ts:106`).
- `SC-02`: SSE JSON parse errors are silently dropped (`apps/web/src/lib/hooks/use-thinking-stream.ts:251`).
- `SC-03`: Session display-name enrichment failure is swallowed (`apps/web/src/app/api/sessions/route.ts:16`).
- `SC-04`: Edge timestamps are overwritten with `new Date()` (`apps/web/src/lib/hooks/use-graph.ts:66`).
- `SC-05`: Annotation actions are local-only and non-persistent (`apps/web/src/components/graph/ThinkingNode.tsx:110`, `apps/web/src/components/graph/ThinkingNode.tsx:208`).

### Enhancement Ideas
1. Introduce a shared API error/degraded envelope (`code`, `message`, `recoverable`, `correlationId`, `status`).
2. Emit explicit `recoverable_parse_error` stream events instead of silent chunk drops.
3. Return `displayNameStatus: ok|degraded|failed` from `GET /api/sessions`.
4. Preserve API-provided edge timestamps in `use-graph`.
5. Add a minimal annotation API and persistence path for graph node actions.

## packages/core
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 3 | Strong core logic, but partial persistence failures can become false-success responses. |
| Observability | 3 | Logger usage is good; correlation propagation and degraded contracts are missing. |
| Testability | 3 | Has executable tests, but sparse coverage for degraded/error branches. |
| Doc-Code Alignment | 3 | Core features mostly present, but contradiction resolver claims are not implemented. |

- Purpose: Thinking engine, graph persistence orchestration, metacognition, ThinkFork.
- Dependencies: `@opus-nx/db`, `@opus-nx/shared`.
- Evidence:
- `packages/core/package.json:22`
- `packages/core/src/orchestrator.ts:256`
- `packages/core/src/think-graph.ts:629`
- `packages/core/src/thinkfork.ts:832`
- `packages/core/src/metacognition.ts:540`

### Key Risks
- `SC-06`: Orchestrator continues after ThinkGraph persistence failure without user-visible degraded status (`packages/core/src/orchestrator.ts:280`).
- `SC-06`: ThinkGraph continues after decision-point and edge persistence failures (`packages/core/src/think-graph.ts:680`, `packages/core/src/think-graph.ts:705`).
- `SC-07`: Prompt fallback can mask prompt/config drift (`packages/core/src/thinkfork.ts:839`, `packages/core/src/metacognition.ts:558`).
- `SC-11`: Orchestrator references specialized agents in planning, but no concrete agent execution wiring (`packages/core/src/orchestrator.ts:106`, `packages/core/src/orchestrator.ts:647`).

### Enhancement Ideas
1. Add typed `PartialPersistenceError` and return degraded metadata to API callers.
2. Add correlation IDs through engine to db calls and log contexts.
3. Add strict mode to fail on missing prompt files in non-dev environments.
4. Add agent execution interface and registry integration points in orchestrator.

## packages/db
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 3 | CRUD layer is mostly fail-fast, but fallback behavior can hide quality degradation. |
| Observability | 2 | Warnings exist; no standardized telemetry for fallback/degraded query quality. |
| Testability | 2 | Limited automated checks for RPC fallback behavior and migration integrity. |
| Doc-Code Alignment | 3 | Table/query coverage is broad, but type/schema drift exists for node type. |

- Purpose: Supabase client and data access for sessions, graph, insights.
- Dependencies: `@opus-nx/shared`, Supabase.
- Evidence:
- `packages/db/package.json:23`
- `packages/db/src/thinking-nodes.ts:31`
- `packages/db/src/metacognition.ts:304`
- `packages/db/run-migrations.ts:41`

### Key Risks
- `SC-08`: Full-text search falls back to ILIKE with warn-only behavior (`packages/db/src/metacognition.ts:307`).
- `SC-09`: `ThinkingNode` DB type omits durable `nodeType` (`packages/db/src/thinking-nodes.ts:31`).
- `SC-10`: Migration ownership duplicated between `packages/db/migrations` and `supabase/migrations`.
- `SC-15`: Migration runner can skip statement failures yet still report completion (`packages/db/run-migrations.ts:47`, `packages/db/run-migrations.ts:56`).

### Enhancement Ideas
1. Add quality-degradation metadata for search fallback paths.
2. Add `node_type` column and TS types end-to-end.
3. Declare single migration source of truth and CI drift gate.
4. Replace ad hoc `exec_sql` strategy with deterministic migration tooling and non-zero failure exit.

## packages/shared
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 3 | Config parsing is strict where used, but env contract is not consistently enforced at startup. |
| Observability | 2 | Logger exists but no request-level correlation primitives. |
| Testability | 2 | No dedicated tests for env schema and logger behavior. |
| Doc-Code Alignment | 4 | Utility intent largely matches implementation. |

- Purpose: shared logger and config/env validation helpers.
- Dependencies: `zod`, `yaml`.
- Evidence:
- `packages/shared/src/config.ts:44`
- `packages/shared/src/logger.ts:43`

### Key Risks
- `SC-13`: `AUTH_SECRET` is required by runtime auth route but missing in shared env contract and `.env.example` (`apps/web/src/app/api/auth/route.ts:11`, `packages/shared/src/config.ts:44`, `.env.example:1`).
- `SC-01`: No shared error/degraded schema used by API routes.

### Enhancement Ideas
1. Extend shared env schema to include `AUTH_SECRET` and validate at app boot.
2. Add a shared response/error schema package used by all web routes.
3. Add correlation ID utility for consistent structured logs.

## packages/agents
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 1 | Package is mostly placeholders; no production behavior to validate. |
| Observability | 1 | No concrete runtime agent instrumentation because agents are unimplemented. |
| Testability | 1 | No functional tests for specialized agent workflows. |
| Doc-Code Alignment | 2 | Docs and orchestrator imply agent capabilities not shipped in package exports. |

- Purpose: specialized sub-agents for research/code/knowledge/planning/communication.
- Dependencies: core/db/shared + langchain stack.
- Evidence:
- `packages/agents/src/index.ts:1`
- `packages/agents/package.json:26`

### Key Risks
- `SC-11`: Agent exports are placeholders only (`packages/agents/src/index.ts:4`).

### Enhancement Ideas
1. Introduce `AgentRegistry` with required agent interfaces and readiness checks.
2. Implement minimal stubs for all planned agent types with explicit unsupported behavior.
3. Add agent contract tests tied to roadmap declarations.

## configs
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 2 | Prompt/config files exist, but versioning and strict validation strategy are incomplete. |
| Observability | 1 | Prompt fallback events are warn-only and not aggregated. |
| Testability | 1 | No config/prompt schema tests or compatibility checks in CI. |
| Doc-Code Alignment | 3 | Prompt inventory mostly matches usage, with fallback masking missing-file drift. |

- Purpose: prompt files and YAML configs for runtime behavior.
- Dependencies: consumed by core prompt loaders.
- Evidence:
- `configs/prompts/thinkfork/conservative.md`
- `packages/core/src/thinkfork.ts:33`
- `packages/core/src/metacognition.ts:542`

### Key Risks
- `SC-07`: Missing prompt files silently trigger fallback behavior.

### Enhancement Ideas
1. Add prompt manifest with required files and versions.
2. Add CI check that all referenced prompts exist and pass schema checks.
3. Add environment-based strict mode for prompt loading.

## scripts
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 2 | Helpful scripts exist, but failure semantics and portability are inconsistent. |
| Observability | 2 | Scripts log status but do not return structured machine-readable diagnostics. |
| Testability | 1 | No script-level regression checks in CI. |
| Doc-Code Alignment | 3 | Scripts broadly match described setup/testing intent. |

- Purpose: connectivity checks and db migration helper script.
- Dependencies: env vars, Supabase RPC.
- Evidence:
- `scripts/test-connections.ts:26`
- `packages/db/run-migrations.ts:41`

### Key Risks
- `SC-15`: Migration script can under-report failures.
- `SC-14`: Root/package clean scripts use Unix `rm -rf` in a Windows dev context (`package.json:11`, `packages/core/package.json:17`, `packages/db/package.json:17`, `packages/shared/package.json:17`, `packages/agents/package.json:17`).

### Enhancement Ideas
1. Replace shell-dependent delete commands with cross-platform alternatives.
2. Make scripts exit non-zero on any failed migration statement.
3. Emit JSON output mode for CI parsing.

## supabase
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 3 | Core schema and RPCs are present; ownership/duplication and type gaps remain. |
| Observability | 2 | DB structure is solid but lacks explicit migration drift controls. |
| Testability | 2 | No automated schema drift detection against package migration mirror. |
| Doc-Code Alignment | 3 | Schema generally aligns with graph features except node type durability. |

- Purpose: database schema, indexes, and RPC functions.
- Dependencies: consumed by `@opus-nx/db`.
- Evidence:
- `supabase/migrations/002_thinking_graph.sql:17`
- `supabase/migrations/002_thinking_graph.sql:156`

### Key Risks
- `SC-09`: `thinking_nodes` schema lacks `node_type` despite core/UI reliance (`supabase/migrations/002_thinking_graph.sql:17`, `packages/core/src/types/thinking.ts:73`).
- `SC-10`: Duplicate migration directories with no enforced sync.

### Enhancement Ideas
1. Add `node_type` column with default and index strategy.
2. Enforce one migration directory as canonical.
3. Add migration drift check command in CI.

## root docs/config
| Dimension | Score | Notes |
| --- | --- | --- |
| Reliability | 2 | Runtime config templates are incomplete for current auth behavior. |
| Observability | 2 | Project-level contracts are not auto-validated against implementation. |
| Testability | 1 | No doc-contract validation checks in CI. |
| Doc-Code Alignment | 1 | Multiple architecture/roadmap API and feature claims diverge from source. |

- Purpose: architecture, roadmap, PRD, onboarding env templates, workspace config.
- Dependencies: source-of-truth for delivery intent and onboarding.
- Evidence:
- `ARCHITECTURE.md:806`
- `ROADMAP.md:1192`
- `README.md:181`
- `.env.example:1`
- `apps/web/src/app/api/thinking/route.ts:12`

### Key Risks
- `SC-12`: Route contract drift (`/api/think`, `/api/stream/:sessionId`) vs implemented `/api/thinking`, `/api/thinking/stream`.
- `SC-11`: Contradiction resolver and agent capability claims exceed current implementation.
- `SC-13`: `.env.example` omits `AUTH_SECRET` required by auth route.

### Enhancement Ideas
1. Add doc-contract test that compares documented endpoints with route files.
2. Add feature-status badges tied to code ownership and test evidence.
3. Update `.env.example` and startup docs to include full required runtime vars.
