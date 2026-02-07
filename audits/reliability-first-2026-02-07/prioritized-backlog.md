# Prioritized Backlog (Risk Reduction First)

## Priority Bands
- `P0`: reliability/data integrity blockers.
- `P1`: material reliability and visibility improvements.
- `P2`: capability completion and long-tail hardening.

## Epic REL-01: Contracts and Data Integrity (P0)

| Backlog ID | Title | Owner Folder(s) | Effort | Risk Reduction Impact | Linked Finding IDs | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| `BL-001` | Standardize API error envelope with correlation IDs | `apps/web`, `packages/shared` | M | High | `SC-01`, `SC-12` | All API routes return `{ error: { code, message, recoverable, correlationId } }`; contract tests pass (`T-01`, `T-04`). |
| `BL-002` | Add degraded-state metadata for partial persistence paths | `packages/core`, `apps/web` | M | High | `SC-06`, `SF-03`, `SF-04`, `SF-05` | Orchestrator and routes surface `degraded=true` and failure details when any graph sub-step fails; regression tests cover each branch (`T-01`, `T-04`). |
| `BL-003` | Make `nodeType` durable across DB schema/types/API/UI | `supabase`, `packages/db`, `packages/core`, `apps/web` | L | High | `SC-09`, `GAP-06` | `node_type` column exists, db types updated, API returns/stores it, UI round-trips all node types (`T-07`). |
| `BL-004` | Declare canonical migration source and add drift CI gate | `supabase`, `packages/db`, root CI | M | High | `SC-10`, `GAP-08` | Single migration directory is canonical; CI fails when mirror diverges (`T-08`). |
| `BL-005` | Enforce env fail-fast and template completeness (`AUTH_SECRET`) | root config, `packages/shared`, `apps/web` | S | High | `SC-13`, `GAP-07` | Startup validation fails fast when required vars are missing; `.env.example` includes `AUTH_SECRET` (`T-09`). |
| `BL-006` | Harden migration runner to fail on any statement error | `packages/db`, `scripts` | S | High | `SC-15`, `SF-11` | Migration command exits non-zero on any failed statement and reports failed SQL index/file (`T-08`). |

## Epic REL-02: Observability and UX Correctness (P1)

| Backlog ID | Title | Owner Folder(s) | Effort | Risk Reduction Impact | Linked Finding IDs | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| `BL-007` | Surface recoverable stream parse errors | `apps/web` | S | Medium | `SC-02`, `SF-01` | Client state captures parse anomalies and logs telemetry; no silent chunk drop (`T-02`). |
| `BL-008` | Add session enrichment status contract | `apps/web`, `packages/db` | S | Medium | `SC-03`, `SF-02` | `GET /api/sessions` includes `displayNameStatus`; fallback path logged with correlation ID (`T-03`). |
| `BL-009` | Version and instrument prompt fallback behavior | `configs`, `packages/core` | M | Medium | `SC-07`, `SF-08`, `SF-09` | Prompt loaders emit structured fallback metrics and include fallback flags in API-level metadata (`T-05`). |
| `BL-010` | Expose search quality when FTS falls back to ILIKE | `packages/db`, `apps/web` | M | Medium | `SC-08`, `SF-10` | Search response includes `searchMode` and `quality`; dashboard shows degraded badge when applicable (`T-06`). |
| `BL-011` | Preserve server edge timestamps in graph hook | `apps/web` | S | Medium | `SC-04`, `SF-12` | `use-graph` uses API timestamp parsing; timeline assertions pass (`T-04`). |
| `BL-012` | Persist annotation actions or relabel as local-only | `apps/web`, `packages/db` | M | Medium | `SC-05`, `SF-13` | Annotation action either persists and reloads or is explicitly marked transient in UI copy (`T-12`). |
| `BL-013` | Agent registry readiness checks and failing tests | `packages/agents`, `packages/core` | M | Medium | `SC-11`, `GAP-01`, `GAP-09` | Build/test fails when roadmap-declared agents are absent from registry (`T-11`). |

## Epic REL-03: Capability Completion and Contract Alignment (P2)

| Backlog ID | Title | Owner Folder(s) | Effort | Risk Reduction Impact | Linked Finding IDs | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| `BL-014` | Implement contradiction resolver module and integration plan | `packages/core`, `packages/db` | L | Medium | `GAP-02` | Resolver module exists with typed inputs/outputs and integration entrypoint, plus initial tests (`T-11`). |
| `BL-015` | Add doc-contract checker for routes/env/features | root docs/config, CI | M | Medium | `SC-12`, `GAP-03`, `GAP-04`, `GAP-05` | CI validates documented endpoints/env vars against source and fails on drift (`T-10`). |
| `BL-016` | Make clean scripts cross-platform | root + package manifests | S | Low | `SC-14` | `clean` scripts work on Windows and Unix in CI smoke run (`T-12`). |
| `BL-017` | Implement baseline specialized agents (MVP set) | `packages/agents`, `packages/core` | L | Medium | `GAP-01`, `GAP-09` | Research/code/knowledge/planning/communication agents execute through orchestrator task lifecycle (`T-11`). |

## Execution Order
1. Complete `REL-01` fully before enabling new capability work.
2. Execute `REL-02` in listed order to remove silent/degraded blind spots.
3. Start `REL-03` after doc-contract gates are in CI.
