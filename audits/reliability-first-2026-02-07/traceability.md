# Traceability Matrix

## A. Finding to Backlog Mapping

| Finding ID | Description | Backlog IDs |
| --- | --- | --- |
| `SC-01` | Inconsistent API error envelope | `BL-001` |
| `SC-02` | Silent stream parse drops | `BL-007` |
| `SC-03` | Session enrichment failure swallowed | `BL-008` |
| `SC-04` | Edge timestamp overwritten in UI | `BL-011` |
| `SC-05` | Annotation UI appears persistent but is local-only | `BL-012` |
| `SC-06` | Partial persistence paths return success without degraded metadata | `BL-002` |
| `SC-07` | Prompt fallback masks config drift | `BL-009` |
| `SC-08` | DB fallback hides search-quality degradation | `BL-010` |
| `SC-09` | `nodeType` not durably persisted | `BL-003` |
| `SC-10` | Dual migration directories and drift risk | `BL-004`, `BL-006` |
| `SC-11` | Agent capability placeholders and missing execution path | `BL-013`, `BL-017`, `BL-014` |
| `SC-12` | Docs/API contract drift | `BL-001`, `BL-015` |
| `SC-13` | Missing `AUTH_SECRET` in env template/contract | `BL-005` |
| `SC-14` | Cross-platform script incompatibility | `BL-016` |
| `SC-15` | Migration script false-success semantics | `BL-006` |

## B. Backlog to Maps and Tests

| Backlog ID | Related Map(s) | Test Scenario IDs |
| --- | --- | --- |
| `BL-001` | `Map B`, `Map C` | `T-01`, `T-04`, `T-10` |
| `BL-002` | `Map B`, `Map C` | `T-01`, `T-04` |
| `BL-003` | `Map C`, `Map D` | `T-07` |
| `BL-004` | `Map A`, `Map D` | `T-08` |
| `BL-005` | `Map D` | `T-09` |
| `BL-006` | `Map D` | `T-08` |
| `BL-007` | `Map B` | `T-02` |
| `BL-008` | `Map B` | `T-03` |
| `BL-009` | `Map D` | `T-05` |
| `BL-010` | `Map C` | `T-06` |
| `BL-011` | `Map B`, `Map C` | `T-04` |
| `BL-012` | `Map B`, `Map C` | `T-12` |
| `BL-013` | `Map A`, `Map B` | `T-11` |
| `BL-014` | `Map A`, `Map C` | `T-11` |
| `BL-015` | `Map A`, `Map B`, `Map D` | `T-10` |
| `BL-016` | `Map A` | `T-12` |
| `BL-017` | `Map A`, `Map B` | `T-11` |

## C. Test Scenario Catalog

| Test ID | Scenario | Primary Target | Expected Outcome |
| --- | --- | --- | --- |
| `T-01` | API route returns explicit degraded response when non-critical persistence step fails | `apps/web` + `packages/core` | Response includes `degraded=true`, error code, and `correlationId` without masking root failure |
| `T-02` | Stream parser receives malformed chunk | `apps/web` hook layer | Recoverable error is surfaced and logged; stream can continue or end explicitly |
| `T-03` | Session enrichment fails for first-node lookup | `apps/web` sessions route | Session payload includes enrichment status (`degraded`) instead of silent omission |
| `T-04` | Graph edge/link persistence issue is observable and traceable | `packages/core` + `apps/web` | `linkedToParent` or edge status reported; correlated logs available |
| `T-05` | Prompt file missing | `packages/core` prompt loaders | Controlled fallback behavior emits structured telemetry and metadata |
| `T-06` | Full-text search fails and ILIKE fallback is used | `packages/db` | Response marks degraded search mode and logs fallback event |
| `T-07` | `nodeType` round-trip from API to DB to UI | `supabase` + `packages/db` + `apps/web` | Node type persists durably and renders correctly across reloads |
| `T-08` | Migration drift / failure gate | `supabase` + CI | CI fails on migration directory mismatch or failed migration statement |
| `T-09` | Startup env validation | `packages/shared` + `apps/web` | Missing required var (including `AUTH_SECRET`) fails fast before serving traffic |
| `T-10` | Doc-contract drift checker | root docs + CI | CI fails when documented routes/env vars/features diverge from implementation |
| `T-11` | Agent registry and contradiction capability readiness | `packages/agents` + `packages/core` | Tests fail if planned agent/resolver capabilities are absent |
| `T-12` | UX and script reliability hardening | `apps/web` + scripts | Annotation behavior is explicit/persistent; clean/scripts run cross-platform |

## D. Validation Summary
- Every `SC-*` finding maps to at least one backlog item.
- Every `P0` and `P1` backlog item maps to at least one concrete `T-*` test scenario.
- All backlog rows reference at least one architecture map in `relationship-maps.md`.
