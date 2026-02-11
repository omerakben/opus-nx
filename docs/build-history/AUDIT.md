# AUDIT REPORT — Opus Nx

Audit date: **2026-02-10**

Scope: **Full tracked repository audit** (root -> folders -> subfolders -> files).

Total tracked files reviewed: **274**.

---

## 1) Big Picture (WHY -> WHAT -> HOW -> SO WHAT)

- **WHY**: Opus Nx is building an inspectable, persistent reasoning system where model thought, verification, forking, and metacognition are first-class production objects.
- **WHAT**: Monorepo with a Next.js web surface, TypeScript reasoning core, DB module/migrations, and Python FastAPI swarm backend.
- **HOW**: User requests enter web APIs, route into core orchestration and/or Python swarm execution, and persist graph/session data through Supabase.
- **SO WHAT**: Architecture is strong for experimentation, but production-readiness depends on auth hardening, token model upgrades, and migration/observability discipline.

### High-Level Topology

- **UI + API Surface**: `apps/web`
- **Reasoning Engines + Types**: `packages/core`
- **Shared Config/Logging**: `packages/shared`
- **Database Access Layer + SQL**: `packages/db`, `supabase/migrations`
- **Swarm Runtime (FastAPI)**: `agents/src`
- **Project Governance/Docs**: root markdown + `configs`

---

## 2) Evidence Collected

- Repository inventory via `git ls-files`: **274 files**.
- Baseline quality gates:
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed (including `@opus-nx/core` test suite and web build in pipeline).
- Structural auth check: `apps/web/src/proxy.ts` exists while `apps/web/middleware.ts` and `apps/web/src/middleware.ts` are missing.

---

## 3) Critical Findings (Security + Reliability First)

| Severity | Finding                                                       | WHY/WHAT/HOW                                                                                                 | SO WHAT                                                                 | Evidence                                                                                               |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| CRITICAL | Web auth middleware likely inactive                           | Auth policy is implemented in `apps/web/src/proxy.ts`, but Next middleware entrypoint file is absent.        | Routes may be reachable without intended cookie enforcement.            | `apps/web/src/proxy.ts`, missing `apps/web/middleware.ts`                                              |
| CRITICAL | Swarm backend REST endpoints unauthenticated                  | `agents/src/server.py` exposes `POST /api/swarm` and `GET /api/graph/{session_id}` without token validation. | External callers can trigger expensive runs and read graph data.        | `agents/src/server.py:199`, `agents/src/server.py:215`                                                 |
| HIGH     | Replayable static auth token model                            | Both web and python sides use HMAC over fixed string for tokens/cookies.                                     | Tokens are replayable and not session-scoped; rotation/revocation weak. | `apps/web/src/app/api/swarm/token/route.ts:20`, `agents/src/server.py:173`                             |
| HIGH     | Stale-session pruning logic can evict active sessions         | EventBus timestamp updated on subscribe, not on publish activity.                                            | Active sessions may be cleaned up during long streams.                  | `agents/src/events/bus.py:36`, `agents/src/events/bus.py:21`                                           |
| HIGH     | Potential silent Supabase write failures in swarm persistence | Upsert execute result is not inspected before success debug logging.                                         | Data-loss conditions can be under-detected.                             | `agents/src/persistence/supabase_sync.py:43`, `agents/src/persistence/supabase_sync.py:60`             |
| HIGH     | Migration runner drift risk                                   | Custom runner executes only migrations 001..003 and depends on `exec_sql` RPC.                               | Production may miss schema updates 004..007.                            | `packages/db/run-migrations.ts:22`, `packages/db/run-migrations.ts:43`                                 |
| HIGH     | Service-role DB client misuse blast radius                    | DB client uses service key and can bypass row-level restrictions if leaked/misused.                          | Any server/client boundary error becomes high-impact compromise.        | `packages/db/src/client.ts`                                                                            |
| MEDIUM   | Embedding dependency failure propagates to orchestration      | Orchestrator path requests knowledge context without robust fallback policy.                                 | Voyage outages can degrade request reliability.                         | `packages/core/src/orchestrator.ts:240`, `packages/core/src/memory-manager.ts:67`                      |
| MEDIUM   | No explicit timeout on key external fetches                   | Swarm proxy + Voyage embedding calls rely on default fetch behavior.                                         | Hanging upstreams can consume worker capacity.                          | `apps/web/src/app/api/swarm/route.ts:30`, `packages/core/src/memory-manager.ts:67`                     |
| MEDIUM   | Edge-type consistency mismatch across DB logic                | RPC validation includes `branches_from` while edge CHECK set differs.                                        | Runtime insert/traversal behavior may diverge by path.                  | `packages/db/migrations/002_thinking_graph.sql:171`, `packages/db/migrations/007_v2_edge_types.sql:20` |
| MEDIUM   | In-memory rate limiting not production-safe                   | Demo-style in-process map cannot coordinate across replicas.                                                 | Abusive traffic control becomes inconsistent under scale.               | `apps/web/src/lib/rate-limit.ts`                                                                       |
| MEDIUM   | Config watch reload can be noisy/fragile                      | `fs.watch` callback has no debounce or structured retry semantics.                                           | Spurious parse errors and reload storms under frequent writes.          | `packages/shared/src/config.ts:24`                                                                     |

---

## 4) Strengths to Preserve

- Strong type/schema orientation with Zod/Pydantic across major boundaries.
- Passing lint/typecheck/test baseline on current branch.
- Good modular decomposition (web/core/db/agents/shared).
- ThinkGraph + verification + orchestration are test-covered and architecturally separated.
- Migration drift check script exists (good discipline foundation).

---

## 5) Silent Failure Catalog

| Area               | Silent Failure Mode                         | Current Detection Gap                               | Recommendation                                          |
| ------------------ | ------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Swarm persistence  | Upsert result not inspected                 | Warnings only on thrown exceptions                  | Validate execute result payload and emit failure metric |
| Session lifecycle  | Activity timestamp not refreshed            | Cleanup logic interprets active sessions as stale   | Update timestamp on publish/WS send                     |
| Middleware auth    | Auth guard exists without active entrypoint | Easy to assume protected routes while unprotected   | Add middleware file and auth integration test           |
| External API calls | No explicit timeout/retry in key paths      | Hanging calls look like generic slowness            | Add abort timeout + retries + latency metrics           |
| Migration rollout  | Alternate runner omits newer migrations     | Environments appear “healthy” but schema-incomplete | Standardize one migration execution path in CI/CD       |
| Rate limiting      | In-memory limiter across replicas           | Limits bypassed under horizontal scale              | Move to distributed limiter and telemetry               |

---

## 6) Pre-Production Checklist (Gate)

### Security

- [ ] Wire active Next middleware entrypoint for auth policy.
- [ ] Protect `agents/src/server.py` REST endpoints with auth checks.
- [ ] Replace static replayable tokens with short-lived signed session tokens.
- [ ] Add brute-force protection on `/api/auth`.
- [ ] Confirm no client bundle path imports service-role DB client.

### Reliability

- [ ] Add fetch timeouts/retries for swarm proxy and Voyage embedding calls.
- [ ] Fix EventBus activity tracking before stale-session cleanup.
- [ ] Harden background task error telemetry in swarm runtime.
- [ ] Add distributed rate limiter for production.

### Data & Migrations

- [ ] Use one canonical migration source and runner in deployment pipeline.
- [ ] Ensure migrations 001..007 are applied in all environments.
- [ ] Align edge-type validation and DB CHECK constraints.
- [ ] Add/verify RLS policies where Supabase API exposure is expected.

### Testing & Observability

- [ ] Add API auth coverage tests (web + python REST endpoints).
- [ ] Add SSE/WS longevity tests (heartbeat, reconnect, stale cleanup).
- [ ] Add structured metrics for persistence failures and external latency.

---

## 7) Prioritized Remediation Backlog

### P0 (Before Production)

1. Activate and verify web middleware auth path.
2. Enforce auth on python REST endpoints.
3. Replace static replayable token pattern.
4. Fix stale-session timestamp refresh bug.
5. Standardize migration rollout path and apply full set.

### P1 (Hardening Sprint)

1. Add timeout/retry wrappers for outbound network calls.
2. Replace in-memory rate limiter with distributed backend.
3. Make Supabase persistence failure detection explicit and measurable.
4. Add ownership/tenancy checks across session and graph APIs.

### P2 (Scale & Operability)

1. Expand API route and streaming reliability tests.
2. Add richer production telemetry and alert thresholds.
3. Reduce drift by consolidating duplicated migration paths.

---

## 8) Folder -> Subfolder Deep Audit (WHY -> WHAT -> HOW -> SO WHAT)

| Top-Level Path | File Count | WHY                                          | WHAT                                                             | HOW                                                         | SO WHAT                                                                    |
| -------------- | ---------: | -------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `(root)`       |         21 | Segment exists for architectural separation. | Governance, architecture docs, workspace/tooling manifests.      | Organized as workspace packages and app/service boundaries. | Clear ownership exists, but boundary security must be enforced explicitly. |
| `agents`       |         42 | Segment exists for architectural separation. | Python swarm runtime, persistence adapters, and tests.           | Organized as workspace packages and app/service boundaries. | Clear ownership exists, but boundary security must be enforced explicitly. |
| `apps`         |        125 | Segment exists for architectural separation. | Next.js app surface (UI + API routes + client hooks/components). | Organized as workspace packages and app/service boundaries. | Clear ownership exists, but boundary security must be enforced explicitly. |
| `configs`      |         14 | Segment exists for architectural separation. | Prompt/config assets guiding orchestrator and agent behavior.    | Organized as workspace packages and app/service boundaries. | Clear ownership exists, but boundary security must be enforced explicitly. |
| `packages`     |         61 | Segment exists for architectural separation. | Core logic, shared utilities, DB access, and package interfaces. | Organized as workspace packages and app/service boundaries. | Clear ownership exists, but boundary security must be enforced explicitly. |
| `scripts`      |          2 | Segment exists for architectural separation. | Operational helper scripts for drift and connectivity checks.    | Organized as workspace packages and app/service boundaries. | Clear ownership exists, but boundary security must be enforced explicitly. |
| `supabase`     |          9 | Segment exists for architectural separation. | Supabase-specific config and canonical migration tree.           | Organized as workspace packages and app/service boundaries. | Clear ownership exists, but boundary security must be enforced explicitly. |

---

## 9) Complete File-by-File Audit Matrix

Coverage target: **274/274 tracked files**.

Columns use the requested skeptical lens: **WHY -> WHAT -> HOW -> SO WHAT** plus risk and action.

### `.` (21 files)

| File                            | WHY                                                              | WHAT                                | HOW                                                        | SO WHAT                                                                  | Risk | Action                                                      |
| ------------------------------- | ---------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `.env.example`                  | Provide repository functionality for build, runtime, or tooling. | Repository file.                    | Integrated into monorepo build/runtime flows.              | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `.gitignore`                    | Provide repository functionality for build, runtime, or tooling. | Repository file.                    | Integrated into monorepo build/runtime flows.              | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `ARCHITECTURE.md`               | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `CLAUDE.md`                     | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `OPUS_NX_V2.md`                 | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `OPUS_NX_V2_SESSION2_PROMPT.md` | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `OPUS_NX_V2_SESSION3_PROMPT.md` | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `OPUS_NX_V2_SPEC.md`            | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `PRD.md`                        | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `README.md`                     | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `ROADMAP.md`                    | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `SSOT.md`                       | Document architecture, requirements, or operations.              | Narrative technical documentation.  | Expresses guidance as human-readable markdown.             | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `docker-compose.yml`            | Configure toolchain, runtime, or deployment behavior.            | Configuration declaration file.     | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `opus_nx_icon.svg`              | Deliver static branding or icon assets.                          | Static frontend asset.              | Referenced by UI/static hosting pipeline.                  | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `opus_nx_logo.svg`              | Deliver static branding or icon assets.                          | Static frontend asset.              | Referenced by UI/static hosting pipeline.                  | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `opus_nx_logo_dark.svg`         | Deliver static branding or icon assets.                          | Static frontend asset.              | Referenced by UI/static hosting pipeline.                  | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `package.json`                  | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `pnpm-lock.yaml`                | Configure toolchain, runtime, or deployment behavior.            | Configuration declaration file.     | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `pnpm-workspace.yaml`           | Configure toolchain, runtime, or deployment behavior.            | Configuration declaration file.     | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `tsconfig.json`                 | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `turbo.json`                    | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `agents` (5 files)

| File                     | WHY                                                              | WHAT                            | HOW                                                        | SO WHAT                                                                  | Risk | Action                                                      |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `agents/.python-version` | Provide repository functionality for build, runtime, or tooling. | Repository file.                | Integrated into monorepo build/runtime flows.              | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `agents/Dockerfile`      | Provide repository functionality for build, runtime, or tooling. | Repository file.                | Integrated into monorepo build/runtime flows.              | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `agents/fly.toml`        | Configure toolchain, runtime, or deployment behavior.            | Configuration declaration file. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `agents/pyproject.toml`  | Configure toolchain, runtime, or deployment behavior.            | Configuration declaration file. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `agents/uv.lock`         | Provide repository functionality for build, runtime, or tooling. | Repository file.                | Integrated into monorepo build/runtime flows.              | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `agents/src` (6 files)

| File                     | WHY                                                              | WHAT                                                      | HOW                                                                                   | SO WHAT                                                                 | Risk     | Action                                                                            |
| ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `agents/src/__init__.py` | Provide repository functionality for build, runtime, or tooling. | Python backend module.                                    | Implements async Python service logic with FastAPI/Pydantic.                          | Manageable risk but should be hardened before broad production traffic. | MEDIUM   | Schedule targeted hardening and add observability/tests.                          |
| `agents/src/config.py`   | Provide repository functionality for build, runtime, or tooling. | Python backend module.                                    | Implements async Python service logic with FastAPI/Pydantic.                          | Manageable risk but should be hardened before broad production traffic. | MEDIUM   | Schedule targeted hardening and add observability/tests.                          |
| `agents/src/main.py`     | Provide repository functionality for build, runtime, or tooling. | Python backend module.                                    | Implements async Python service logic with FastAPI/Pydantic.                          | Manageable risk but should be hardened before broad production traffic. | MEDIUM   | Schedule targeted hardening and add observability/tests.                          |
| `agents/src/server.py`   | Serve swarm start, graph fetch, and WS stream endpoints.         | FastAPI app wiring lifecycle, auth, and streaming.        | REST /api/swarm and /api/graph lack auth checks; WS token is static HMAC query param. | Unauthenticated compute/data exposure + replayable auth model.          | CRITICAL | Require auth on REST, move to expiring signed tokens, avoid query-string secrets. |
| `agents/src/swarm.py`    | Coordinate multi-agent execution lifecycle.                      | Concurrent branch runs, synthesis, and event publication. | Background tasks need stronger failure telemetry/cancellation handling.               | Orchestration errors can be hard to diagnose under load.                | MEDIUM   | Add task callbacks, cancellation propagation, and metrics.                        |
| `agents/src/utils.py`    | Provide repository functionality for build, runtime, or tooling. | Python backend module.                                    | Implements async Python service logic with FastAPI/Pydantic.                          | Manageable risk but should be hardened before broad production traffic. | MEDIUM   | Schedule targeted hardening and add observability/tests.                          |

### `agents/src/agents` (7 files)

| File                                 | WHY                                          | WHAT                   | HOW                                                          | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------ | -------------------------------------------- | ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `agents/src/agents/__init__.py`      | Implement specialized agent reasoning roles. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/agents/base.py`          | Implement specialized agent reasoning roles. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/agents/contrarian.py`    | Implement specialized agent reasoning roles. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/agents/deep_thinker.py`  | Implement specialized agent reasoning roles. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/agents/metacognition.py` | Implement specialized agent reasoning roles. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/agents/synthesizer.py`   | Implement specialized agent reasoning roles. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/agents/verifier.py`      | Implement specialized agent reasoning roles. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `agents/src/events` (3 files)

| File                            | WHY                                                              | WHAT                                               | HOW                                                                 | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `agents/src/events/__init__.py` | Provide repository functionality for build, runtime, or tooling. | Python backend module.                             | Implements async Python service logic with FastAPI/Pydantic.        | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/events/bus.py`      | Distribute live swarm events per session.                        | Async queue pub/sub with stale-session timestamps. | Timestamp set on subscribe only; publish does not refresh activity. | Active sessions can be incorrectly pruned as stale.                     | HIGH   | Touch session timestamp on publish/send activity.        |
| `agents/src/events/types.py`    | Provide repository functionality for build, runtime, or tooling. | Python backend module.                             | Implements async Python service logic with FastAPI/Pydantic.        | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `agents/src/graph` (3 files)

| File                                  | WHY                                                              | WHAT                                              | HOW                                                          | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `agents/src/graph/__init__.py`        | Provide repository functionality for build, runtime, or tooling. | Python backend module.                            | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/graph/models.py`          | Provide repository functionality for build, runtime, or tooling. | Python backend module.                            | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/graph/reasoning_graph.py` | Maintain in-memory session reasoning graph state.                | Graph mutation and change-notification mechanism. | Listener failures can be swallowed.                          | Downstream persistence failures may be under-observed.                  | MEDIUM | Log listener exceptions with session/node context.       |

### `agents/src/persistence` (3 files)

| File                                      | WHY                                               | WHAT                                           | HOW                                                            | SO WHAT                                                                 | Risk   | Action                                                        |
| ----------------------------------------- | ------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| `agents/src/persistence/__init__.py`      | Persist runtime state to external data stores.    | Python backend module.                         | Implements async Python service logic with FastAPI/Pydantic.   | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.      |
| `agents/src/persistence/neo4j_client.py`  | Persist graph to Neo4j for graph-native querying. | Async write client with retry patterns.        | Auth path may ignore configured username assumptions.          | Non-default Neo4j deployments can misconfigure silently.                | MEDIUM | Honor configured username and validate connection on startup. |
| `agents/src/persistence/supabase_sync.py` | Persist reasoning graph changes to Supabase.      | Upsert nodes/edges in background thread calls. | Upsert execute result is not inspected before success logging. | Write failures can become silent data-loss events.                      | HIGH   | Check result payload/errors and emit failure metrics.         |

### `agents/src/tools` (2 files)

| File                               | WHY                                                              | WHAT                   | HOW                                                          | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------- | ---------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `agents/src/tools/__init__.py`     | Provide repository functionality for build, runtime, or tooling. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `agents/src/tools/verification.py` | Provide repository functionality for build, runtime, or tooling. | Python backend module. | Implements async Python service logic with FastAPI/Pydantic. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `agents/tests` (13 files)

| File                                | WHY                                     | WHAT                     | HOW                                                          | SO WHAT                                                                  | Risk | Action                                                  |
| ----------------------------------- | --------------------------------------- | ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------- |
| `agents/tests/__init__.py`          | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/conftest.py`          | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_bus.py`          | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_concurrent.py`   | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_deep_thinker.py` | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_graph.py`        | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_persistence.py`  | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_retry.py`        | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_smoke_real.py`   | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_swarm.py`        | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_swarm_e2e.py`    | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_verification.py` | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |
| `agents/tests/test_websocket.py`    | Prove behavior and prevent regressions. | Automated test artifact. | Implements async Python service logic with FastAPI/Pydantic. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | Keep and expand edge-case coverage as behavior evolves. |

### `apps/web` (8 files)

| File                          | WHY                                                              | WHAT                                | HOW                                                             | SO WHAT                                                                  | Risk   | Action                                                      |
| ----------------------------- | ---------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ----------------------------------------------------------- |
| `apps/web/.env.local.example` | Provide repository functionality for build, runtime, or tooling. | Repository file.                    | Integrated into monorepo build/runtime flows.                   | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/eslint.config.js`   | Provide repository functionality for build, runtime, or tooling. | Repository file.                    | Integrated into monorepo build/runtime flows.                   | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/next-env.d.ts`      | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.      | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |
| `apps/web/next.config.ts`     | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.      | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |
| `apps/web/package.json`       | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling.      | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/postcss.config.js`  | Provide repository functionality for build, runtime, or tooling. | Repository file.                    | Integrated into monorepo build/runtime flows.                   | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/tailwind.config.ts` | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.      | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |
| `apps/web/tsconfig.json`      | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling.      | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |

### `apps/web/e2e` (1 files)

| File                         | WHY                                     | WHAT                     | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                  |
| ---------------------------- | --------------------------------------- | ------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `apps/web/e2e/swarm.spec.ts` | Prove behavior and prevent regressions. | Automated test artifact. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Keep and expand edge-case coverage as behavior evolves. |

### `apps/web/public` (5 files)

| File                                    | WHY                                     | WHAT                   | HOW                                       | SO WHAT                                                                  | Risk | Action                                                      |
| --------------------------------------- | --------------------------------------- | ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `apps/web/public/favicon.ico`           | Deliver static branding or icon assets. | Static frontend asset. | Referenced by UI/static hosting pipeline. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/public/favicon.png`           | Deliver static branding or icon assets. | Static frontend asset. | Referenced by UI/static hosting pipeline. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/public/opus_nx_icon.svg`      | Deliver static branding or icon assets. | Static frontend asset. | Referenced by UI/static hosting pipeline. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/public/opus_nx_logo.svg`      | Deliver static branding or icon assets. | Static frontend asset. | Referenced by UI/static hosting pipeline. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/public/opus_nx_logo_dark.svg` | Deliver static branding or icon assets. | Static frontend asset. | Referenced by UI/static hosting pipeline. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `apps/web/src` (1 files)

| File                    | WHY                                             | WHAT                                                     | HOW                                                          | SO WHAT                                                                   | Risk     | Action                                              |
| ----------------------- | ----------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| `apps/web/src/proxy.ts` | Gate all web and API access behind auth policy. | Edge-compatible auth guard function plus matcher config. | Verifies HMAC cookie and redirects unauthenticated requests. | Policy is currently inactive because required middleware file is missing. | CRITICAL | Create apps/web/middleware.ts re-exporting proxy(). |

### `apps/web/src/app` (5 files)

| File                           | WHY                                                              | WHAT                           | HOW                                                        | SO WHAT                                                                  | Risk   | Action                                                      |
| ------------------------------ | ---------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ----------------------------------------------------------- |
| `apps/web/src/app/error.tsx`   | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed React rendering logic in the Next.js app. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |
| `apps/web/src/app/icon.svg`    | Deliver static branding or icon assets.                          | Static frontend asset.         | Referenced by UI/static hosting pipeline.                  | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `apps/web/src/app/layout.tsx`  | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed React rendering logic in the Next.js app. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |
| `apps/web/src/app/loading.tsx` | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed React rendering logic in the Next.js app. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |
| `apps/web/src/app/page.tsx`    | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed React rendering logic in the Next.js app. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |

### `apps/web/src/app/api/auth` (1 files)

| File                                 | WHY                                            | WHAT                                                            | HOW                                             | SO WHAT                                                                       | Risk | Action                                                         |
| ------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `apps/web/src/app/api/auth/route.ts` | Authenticate users before granting app access. | Password check against AUTH_SECRET with signed cookie issuance. | Timing-safe compare and HMAC cookie generation. | No brute-force rate limiting; shared static secret weakens account isolation. | HIGH | Add limiter/lockout and migrate to per-session identity token. |

### `apps/web/src/app/api/auth/logout` (1 files)

| File                                        | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                     | Risk | Action                                      |
| ------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- | ---- | ------------------------------------------- |
| `apps/web/src/app/api/auth/logout/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | High-impact issue; likely to cause security/reliability incidents at scale. | HIGH | Address in pre-production hardening sprint. |

### `apps/web/src/app/api/demo` (1 files)

| File                                 | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------ | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/demo/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/fork` (1 files)

| File                                 | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------ | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/fork/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/fork/steer` (1 files)

| File                                       | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------ | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/fork/steer/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/fork/stream` (1 files)

| File                                        | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/fork/stream/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/got` (1 files)

| File                                | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ----------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/got/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/health` (1 files)

| File                                   | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| -------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/health/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/insights` (1 files)

| File                                     | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/insights/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/insights/search` (1 files)

| File                                            | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ----------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/insights/search/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/insights/stats` (1 files)

| File                                           | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/insights/stats/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/memory` (1 files)

| File                                   | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| -------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/memory/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/reasoning/[id]` (1 files)

| File                                           | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/reasoning/[id]/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/reasoning/[id]/checkpoint` (1 files)

| File                                                      | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| --------------------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/reasoning/[id]/checkpoint/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/reasoning/search` (1 files)

| File                                             | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------ | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/reasoning/search/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/seed` (1 files)

| File                                 | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------ | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/seed/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/seed/business-strategy` (1 files)

| File                                                   | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------------ | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/seed/business-strategy/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/sessions` (1 files)

| File                                     | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/sessions/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/sessions/[sessionId]` (1 files)

| File                                                 | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/sessions/[sessionId]/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/sessions/[sessionId]/nodes` (1 files)

| File                                                       | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/sessions/[sessionId]/nodes/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/stream/[sessionId]` (1 files)

| File                                               | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| -------------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/stream/[sessionId]/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/swarm` (1 files)

| File                                  | WHY                                            | WHAT                                             | HOW                                                         | SO WHAT                                                                        | Risk | Action                                              |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- | --------------------------------------------------- |
| `apps/web/src/app/api/swarm/route.ts` | Proxy heavy swarm workloads to Python backend. | Forwards request body and attaches bearer token. | Simple fetch proxy without timeout or explicit auth checks. | Can be abused if middleware absent; hanging upstream can tie server resources. | HIGH | Enforce route auth + fetch timeout + request quota. |

### `apps/web/src/app/api/swarm/token` (1 files)

| File                                        | WHY                              | WHAT                                              | HOW                                               | SO WHAT                                           | Risk | Action                                               |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ---- | ---------------------------------------------------- |
| `apps/web/src/app/api/swarm/token/route.ts` | Issue WS auth token to frontend. | Returns deterministic HMAC token and WS base URL. | HMAC(secret, fixed_message) with no nonce/expiry. | Replayable token design with no freshness checks. | HIGH | Use short-lived signed token with timestamp + nonce. |

### `apps/web/src/app/api/think` (1 files)

| File                                  | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/think/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/thinking` (1 files)

| File                                     | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/thinking/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/thinking/stream` (1 files)

| File                                            | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ----------------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/thinking/stream/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/api/verify` (1 files)

| File                                   | WHY                                   | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| -------------------------------------- | ------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/api/verify/route.ts` | Expose backend capability to callers. | HTTP route handler. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/app/login` (1 files)

| File                              | WHY                                                              | WHAT                           | HOW                                                        | SO WHAT                                                                 | Risk   | Action                                                   |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/app/login/page.tsx` | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed React rendering logic in the Next.js app. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/fork` (4 files)

| File                                           | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------------- | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/fork/BranchCard.tsx`  | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/fork/Convergence.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/fork/ForkPanel.tsx`   | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/fork/index.ts`        | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/got` (2 files)

| File                                       | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------ | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/got/GoTPanel.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/got/index.ts`     | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/graph` (7 files)

| File                                              | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------- | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/graph/EdgeTypes.tsx`     | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/graph/GraphControls.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/graph/GraphLegend.tsx`   | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/graph/StreamingNode.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/graph/ThinkingGraph.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/graph/ThinkingNode.tsx`  | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/graph/index.ts`          | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/insights` (3 files)

| File                                                 | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ---------------------------------------------------- | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/insights/InsightCard.tsx`   | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/insights/InsightsPanel.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/insights/index.ts`          | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/layout` (7 files)

| File                                             | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------ | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/layout/BottomPanel.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/layout/Dashboard.tsx`   | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/layout/Header.tsx`      | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/layout/LeftPanel.tsx`   | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/layout/MobileNav.tsx`   | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/layout/RightPanel.tsx`  | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/layout/index.ts`        | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/memory` (2 files)

| File                                             | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------ | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/memory/MemoryPanel.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/memory/index.ts`        | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/sessions` (4 files)

| File                                                | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| --------------------------------------------------- | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/sessions/SessionCard.tsx`  | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/sessions/SessionList.tsx`  | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/sessions/SessionStats.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/sessions/index.ts`         | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/swarm` (4 files)

| File                                              | WHY                                      | WHAT                                        | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/swarm/AgentCard.tsx`     | Render user-facing interface elements.   | React component module.                     | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/swarm/SwarmTimeline.tsx` | Render user-facing interface elements.   | React component module.                     | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/swarm/SwarmView.tsx`     | Render and control multi-agent swarm UX. | Client orchestration UI and event timeline. | Calls useSwarm with NEXT_PUBLIC_AUTH_SECRET fallback.           | Client env secret reference is unnecessary and risky pattern.           | MEDIUM | Remove public auth-secret usage from client code.        |
| `apps/web/src/components/swarm/index.ts`          | Render user-facing interface elements.   | React component module.                     | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/thinking` (5 files)

| File                                                   | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------------ | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/thinking/ReasoningDetail.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/thinking/ThinkingInput.tsx`   | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/thinking/ThinkingStream.tsx`  | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/thinking/TokenCounter.tsx`    | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/thinking/index.ts`            | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/tour` (1 files)

| File                                        | WHY                                    | WHAT                    | HOW                                                        | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------- | -------------------------------------- | ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/tour/DemoTour.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/ui` (11 files)

| File                                                  | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ----------------------------------------------------- | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/ui/badge.tsx`                | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/button.tsx`               | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/card.tsx`                 | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/dropdown-menu.tsx`        | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/index.ts`                 | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/input.tsx`                | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/neural-submit-button.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/skeleton.tsx`             | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/sonner.tsx`               | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/tabs.tsx`                 | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/ui/tooltip.tsx`              | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/components/verify` (2 files)

| File                                                   | WHY                                    | WHAT                    | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------------ | -------------------------------------- | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/components/verify/VerificationPanel.tsx` | Render user-facing interface elements. | React component module. | Implements typed React rendering logic in the Next.js app.      | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/components/verify/index.ts`              | Render user-facing interface elements. | React component module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/lib` (12 files)

| File                               | WHY                                                   | WHAT                                              | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                         |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `apps/web/src/lib/api-response.ts` | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/api.ts`          | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/auth.ts`         | Implement cookie signing and verification primitives. | HMAC helper with timing-safe-ish comparison loop. | Signs fixed message using AUTH_SECRET.                          | Single static signature represents all users/sessions.                  | HIGH   | Switch to per-user/session token with rotation and revocation. |
| `apps/web/src/lib/colors.ts`       | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/db.ts`           | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/events.ts`       | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/graph-utils.ts`  | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/rate-limit.ts`   | Throttle abusive requests and protect APIs.           | In-memory per-identifier counter window.          | Map-based window reset via setInterval.                         | Not distributed; ineffective across replicas/serverless cold starts.    | MEDIUM | Use Redis/Upstash-backed limiter for production.               |
| `apps/web/src/lib/server-env.ts`   | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/swarm-client.ts` | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/utils.ts`        | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |
| `apps/web/src/lib/validation.ts`   | Provide shared runtime helpers.                       | Library/helper module.                            | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.       |

### `apps/web/src/lib/hooks` (12 files)

| File                                             | WHY                                       | WHAT                | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------ | ----------------------------------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `apps/web/src/lib/hooks/index.ts`                | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-fork-stream.ts`      | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-graph.ts`            | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-live-graph.ts`       | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-media-query.ts`      | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-reasoning-detail.ts` | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-right-sidebar.ts`    | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-session.ts`          | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-sidebar.ts`          | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-swarm.ts`            | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-thinking-stream.ts`  | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `apps/web/src/lib/hooks/use-tour.ts`             | Coordinate client-side state and effects. | Custom hook module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `apps/web/src/styles` (1 files)

| File                              | WHY                                                              | WHAT             | HOW                                           | SO WHAT                                                                  | Risk | Action                                                      |
| --------------------------------- | ---------------------------------------------------------------- | ---------------- | --------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `apps/web/src/styles/globals.css` | Provide repository functionality for build, runtime, or tooling. | Repository file. | Integrated into monorepo build/runtime flows. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `configs` (2 files)

| File                      | WHY                                                   | WHAT                            | HOW                                                        | SO WHAT                                                                  | Risk | Action                                                      |
| ------------------------- | ----------------------------------------------------- | ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `configs/agents.yaml`     | Configure toolchain, runtime, or deployment behavior. | Configuration declaration file. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `configs/categories.yaml` | Configure toolchain, runtime, or deployment behavior. | Configuration declaration file. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `configs/prompts` (7 files)

| File                               | WHY                                                 | WHAT                               | HOW                                            | SO WHAT                                                                  | Risk   | Action                                                      |
| ---------------------------------- | --------------------------------------------------- | ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | ------ | ----------------------------------------------------------- |
| `configs/prompts/code.md`          | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/communication.md` | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/knowledge.md`     | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/metacognition.md` | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/orchestrator.md`  | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |
| `configs/prompts/planning.md`      | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/research.md`      | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |

### `configs/prompts/thinkfork` (5 files)

| File                                        | WHY                                                 | WHAT                               | HOW                                            | SO WHAT                                                                  | Risk | Action                                                      |
| ------------------------------------------- | --------------------------------------------------- | ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `configs/prompts/thinkfork/aggressive.md`   | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/thinkfork/balanced.md`     | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/thinkfork/comparison.md`   | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/thinkfork/conservative.md` | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `configs/prompts/thinkfork/contrarian.md`   | Document architecture, requirements, or operations. | Narrative technical documentation. | Expresses guidance as human-readable markdown. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `packages/agents` (2 files)

| File                            | WHY                                                   | WHAT                                | HOW                                                        | SO WHAT                                                                  | Risk | Action                                                      |
| ------------------------------- | ----------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `packages/agents/package.json`  | Configure toolchain, runtime, or deployment behavior. | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `packages/agents/tsconfig.json` | Configure toolchain, runtime, or deployment behavior. | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `packages/agents/src` (2 files)

| File                                | WHY                                                              | WHAT                           | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ----------------------------------- | ---------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `packages/agents/src/base-agent.ts` | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/agents/src/index.ts`      | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `packages/core` (3 files)

| File                             | WHY                                                              | WHAT                                | HOW                                                             | SO WHAT                                                                  | Risk   | Action                                                      |
| -------------------------------- | ---------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ----------------------------------------------------------- |
| `packages/core/package.json`     | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling.      | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `packages/core/tsconfig.json`    | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling.      | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap. |
| `packages/core/vitest.config.ts` | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.      | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.    |

### `packages/core/src` (18 files)

| File                                         | WHY                                                              | WHAT                                                       | HOW                                                             | SO WHAT                                                                  | Risk   | Action                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| `packages/core/src/got-engine.test.ts`       | Prove behavior and prevent regressions.                          | Automated test artifact.                                   | Implements typed logic for routing, domain modules, or tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | Keep and expand edge-case coverage as behavior evolves.                  |
| `packages/core/src/got-engine.ts`            | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                             | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.                 |
| `packages/core/src/index.ts`                 | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                             | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.                 |
| `packages/core/src/memory-hierarchy.test.ts` | Prove behavior and prevent regressions.                          | Automated test artifact.                                   | Implements typed logic for routing, domain modules, or tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | Keep and expand edge-case coverage as behavior evolves.                  |
| `packages/core/src/memory-hierarchy.ts`      | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                             | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.                 |
| `packages/core/src/memory-manager.ts`        | Generate embeddings and retrieve knowledge context.              | Voyage API caller + semantic retrieval wrapper.            | fetch() to Voyage without timeout/retry logic.                  | Slow/outage conditions can stall orchestration requests.                 | MEDIUM | Add abort timeout, retry/backoff, and context size caps.                 |
| `packages/core/src/metacognition.test.ts`    | Prove behavior and prevent regressions.                          | Automated test artifact.                                   | Implements typed logic for routing, domain modules, or tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | Keep and expand edge-case coverage as behavior evolves.                  |
| `packages/core/src/metacognition.ts`         | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                             | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.                 |
| `packages/core/src/orchestrator.test.ts`     | Prove behavior and prevent regressions.                          | Automated test artifact.                                   | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Keep and expand edge-case coverage as behavior evolves.                  |
| `packages/core/src/orchestrator.ts`          | Coordinate reasoning workflow and persistence path.              | Effort routing, ThinkGraph persistence, session budgeting. | Calls MemoryManager context retrieval before main think cycle.  | Embedding failures can fail request path instead of graceful fallback.   | MEDIUM | Wrap context retrieval in fallback path and continue without embeddings. |
| `packages/core/src/prm-verifier.test.ts`     | Prove behavior and prevent regressions.                          | Automated test artifact.                                   | Implements typed logic for routing, domain modules, or tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | Keep and expand edge-case coverage as behavior evolves.                  |
| `packages/core/src/prm-verifier.ts`          | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                             | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.                 |
| `packages/core/src/think-graph.test.ts`      | Prove behavior and prevent regressions.                          | Automated test artifact.                                   | Implements typed logic for routing, domain modules, or tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | Keep and expand edge-case coverage as behavior evolves.                  |
| `packages/core/src/think-graph.ts`           | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                             | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.                 |
| `packages/core/src/thinkfork.test.ts`        | Prove behavior and prevent regressions.                          | Automated test artifact.                                   | Implements typed logic for routing, domain modules, or tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | Keep and expand edge-case coverage as behavior evolves.                  |
| `packages/core/src/thinkfork.ts`             | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                             | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.                 |
| `packages/core/src/thinking-engine.test.ts`  | Prove behavior and prevent regressions.                          | Automated test artifact.                                   | Implements typed logic for routing, domain modules, or tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | Keep and expand edge-case coverage as behavior evolves.                  |
| `packages/core/src/thinking-engine.ts`       | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                             | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.                 |

### `packages/core/src/prompts` (1 files)

| File                                             | WHY                                                              | WHAT                           | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `packages/core/src/prompts/thinkfork-prompts.ts` | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `packages/core/src/types` (10 files)

| File                                       | WHY                                                              | WHAT                           | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `packages/core/src/types/agents.ts`        | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/got.ts`           | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/index.ts`         | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/knowledge.ts`     | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/memory.ts`        | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/metacognition.ts` | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/orchestrator.ts`  | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/prm.ts`           | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/thinkfork.ts`     | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/core/src/types/thinking.ts`      | Provide repository functionality for build, runtime, or tooling. | TypeScript application module. | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `packages/db` (4 files)

| File                            | WHY                                                              | WHAT                                               | HOW                                                             | SO WHAT                                                                  | Risk   | Action                                                          |
| ------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | --------------------------------------------------------------- |
| `packages/db/add-node-type.ts`  | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                     | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic.  | MEDIUM | Schedule targeted hardening and add observability/tests.        |
| `packages/db/package.json`      | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration.                | Declares static configuration consumed by runtime/tooling.      | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap.     |
| `packages/db/run-migrations.ts` | Bootstrap schema in environments without CLI migration path.     | Runs SQL statements through Supabase RPC exec_sql. | Hardcodes only 001..003 migrations.                             | Schema drift likely; 004..007 features absent if this path is used.      | HIGH   | Run full migration set or remove custom runner in favor of CLI. |
| `packages/db/tsconfig.json`     | Configure toolchain, runtime, or deployment behavior.            | Manifest or compiler configuration.                | Declares static configuration consumed by runtime/tooling.      | Low immediate risk; maintain with routine hygiene and regression checks. | LOW    | No immediate change; monitor and keep aligned with roadmap.     |

### `packages/db/migrations` (7 files)

| File                                                     | WHY                                                   | WHAT                                                              | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                            |
| -------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `packages/db/migrations/001_initial_schema.sql`          | Evolve database schema safely over time.              | Schema migration unit.                                            | Executes ordered SQL changes and stored function updates.       | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.          |
| `packages/db/migrations/002_thinking_graph.sql`          | Create core reasoning graph schema and traversal RPC. | thinking_nodes, reasoning_edges, decision_points and helper RPCs. | Initial edge constraint omits newer swarm edge types.           | Relies on later migration correctness for compatibility.                | MEDIUM | Enforce migration ordering and verify applied version at startup. |
| `packages/db/migrations/003_node_type.sql`               | Evolve database schema safely over time.              | Schema migration unit.                                            | Executes ordered SQL changes and stored function updates.       | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.          |
| `packages/db/migrations/004_insights_fts_index.sql`      | Evolve database schema safely over time.              | Schema migration unit.                                            | Executes ordered SQL changes and stored function updates.       | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.          |
| `packages/db/migrations/005_fork_analyses.sql`           | Evolve database schema safely over time.              | Schema migration unit.                                            | Executes ordered SQL changes and stored function updates.       | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.          |
| `packages/db/migrations/006_thinking_nodes_response.sql` | Evolve database schema safely over time.              | Schema migration unit.                                            | Executes ordered SQL changes and stored function updates.       | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests.          |
| `packages/db/migrations/007_v2_edge_types.sql`           | Expand edge semantics for swarm-era reasoning.        | Constraint update + agent_name addition + RPC replacement.        | Allows branches_from in RPC validation but not edge constraint. | Potential runtime mismatch between validation and insert constraints.   | MEDIUM | Align allowed edge types between RPC and CHECK constraint.        |

### `packages/db/src` (9 files)

| File                                | WHY                                                              | WHAT                                                              | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ----------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `packages/db/src/agent-runs.ts`     | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                                    | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/db/src/client.ts`         | Provide privileged database client for server operations.        | Supabase client with service-role key.                            | Reads service key from environment.                             | Any accidental client-side bundling would be catastrophic.              | HIGH   | Guarantee server-only imports and runtime guards.        |
| `packages/db/src/decisions.ts`      | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                                    | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/db/src/fork-analyses.ts`  | Store and mutate fork-analysis lifecycle data.                   | CRUD helpers for fork_analyses including steering history append. | Append implemented as read-modify-write.                        | Concurrent updates can overwrite history entries.                       | MEDIUM | Use atomic SQL append/RPC to avoid races.                |
| `packages/db/src/index.ts`          | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                                    | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/db/src/knowledge.ts`      | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                                    | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/db/src/metacognition.ts`  | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                                    | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/db/src/sessions.ts`       | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.                                    | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/db/src/thinking-nodes.ts` | Persist reasoning graph nodes and edges.                         | Insert and query helpers around thinking graph tables.            | Insert payload does not fully leverage V2 columns.              | Agent attribution fields may be incompletely persisted.                 | MEDIUM | Populate node_type and agent_name consistently.          |

### `packages/shared` (2 files)

| File                            | WHY                                                   | WHAT                                | HOW                                                        | SO WHAT                                                                  | Risk | Action                                                      |
| ------------------------------- | ----------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `packages/shared/package.json`  | Configure toolchain, runtime, or deployment behavior. | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `packages/shared/tsconfig.json` | Configure toolchain, runtime, or deployment behavior. | Manifest or compiler configuration. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `packages/shared/src` (3 files)

| File                            | WHY                                                              | WHAT                                         | HOW                                                             | SO WHAT                                                                 | Risk   | Action                                                   |
| ------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `packages/shared/src/config.ts` | Load validated YAML/env runtime configuration.                   | File loader + schema parsing + watch reload. | fs.watch callback reloads immediately on every event.           | No debounce; transient writes can spam parse errors.                    | MEDIUM | Debounce watcher and emit structured reload errors.      |
| `packages/shared/src/index.ts`  | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.               | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `packages/shared/src/logger.ts` | Provide repository functionality for build, runtime, or tooling. | TypeScript application module.               | Implements typed logic for routing, domain modules, or tooling. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |

### `scripts` (2 files)

| File                               | WHY                                                     | WHAT                                                      | HOW                                    | SO WHAT                                           | Risk   | Action                                      |
| ---------------------------------- | ------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------- | ------------------------------------------------- | ------ | ------------------------------------------- |
| `scripts/check-migration-drift.ts` | Ensure mirrored migration directories remain identical. | Diff checks between canonical and mirror migration trees. | Read-only validation script.           | Strong guard against schema drift regressions.    | MEDIUM | Keep in CI required checks.                 |
| `scripts/test-connections.ts`      | Verify external dependency connectivity before runtime. | Pings Anthropic/Supabase/Voyage/Tavily configuration.     | Env-based checks and direct API calls. | Useful preflight but should not run in prod path. | MEDIUM | Use as onboarding and CI smoke helper only. |

### `supabase` (2 files)

| File                   | WHY                                                              | WHAT                            | HOW                                                        | SO WHAT                                                                  | Risk | Action                                                      |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `supabase/.gitignore`  | Provide repository functionality for build, runtime, or tooling. | Repository file.                | Integrated into monorepo build/runtime flows.              | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |
| `supabase/config.toml` | Configure toolchain, runtime, or deployment behavior.            | Configuration declaration file. | Declares static configuration consumed by runtime/tooling. | Low immediate risk; maintain with routine hygiene and regression checks. | LOW  | No immediate change; monitor and keep aligned with roadmap. |

### `supabase/migrations` (7 files)

| File                                                  | WHY                                           | WHAT                                        | HOW                                                       | SO WHAT                                                                 | Risk   | Action                                                   |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `supabase/migrations/001_initial_schema.sql`          | Evolve database schema safely over time.      | Schema migration unit.                      | Executes ordered SQL changes and stored function updates. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `supabase/migrations/002_thinking_graph.sql`          | Evolve database schema safely over time.      | Schema migration unit.                      | Executes ordered SQL changes and stored function updates. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `supabase/migrations/003_node_type.sql`               | Evolve database schema safely over time.      | Schema migration unit.                      | Executes ordered SQL changes and stored function updates. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `supabase/migrations/004_insights_fts_index.sql`      | Evolve database schema safely over time.      | Schema migration unit.                      | Executes ordered SQL changes and stored function updates. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `supabase/migrations/005_fork_analyses.sql`           | Evolve database schema safely over time.      | Schema migration unit.                      | Executes ordered SQL changes and stored function updates. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `supabase/migrations/006_thinking_nodes_response.sql` | Evolve database schema safely over time.      | Schema migration unit.                      | Executes ordered SQL changes and stored function updates. | Manageable risk but should be hardened before broad production traffic. | MEDIUM | Schedule targeted hardening and add observability/tests. |
| `supabase/migrations/007_v2_edge_types.sql`           | Supabase canonical copy of V2 edge migration. | Same semantics as package migration mirror. | Uses brittle constraint drop by name.                     | Drifted environments may fail migration.                                | MEDIUM | Use IF EXISTS/defensive migration pattern.               |

---

## 10) Audit Assumptions

- This audit is repository-grounded and focuses on production-readiness risks, not feature ideation only.
- Report is generated from tracked files only (untracked local files excluded from formal coverage).
- Priority lens applied: **Security + Reliability**.
- Current pass is **report-only**; no remediation code changes were performed in this document generation step.

## 11) Immediate Next Implementation Order

1. Fix auth boundary gaps (web middleware wiring + python REST auth).
2. Replace replayable static token design with expiring session tokens.
3. Correct stale-session activity tracking and persistence failure telemetry.
4. Normalize migration rollout path and validate version parity in CI.
5. Add distributed rate limiting, timeout/retry wrappers, and route-level auth tests.
