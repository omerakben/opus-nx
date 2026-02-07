# Reliability-First Folder Audit Pack (2026-02-07)

## Scope
- In-scope: `apps`, `packages`, `configs`, `scripts`, `supabase`, root docs/config.
- Out-of-scope: generated/vendor folders (`node_modules`, `.turbo`, build outputs).
- Priority lens: risk reduction first.

## Inputs Reviewed
- Docs: `README.md`, `ARCHITECTURE.md`, `PRD.md`, `ROADMAP.md`
- Runtime/API: `apps/web/src/app/api/**`, hooks, graph transforms
- Core/DB/Shared/Agents packages and migrations
- Env templates and local env key names

## Deliverables
1. `folder-scorecards.md`: per-folder scorecards with enhancement ideas and evidence.
2. `relationship-maps.md`: package, runtime, data, and config/prompt maps.
3. `silent-failure-matrix.md`: silent/degraded behavior inventory with severity and fixes.
4. `missing-feature-gap-map.md`: doc-vs-code capability gap map.
5. `prioritized-backlog.md`: reliability-first epic/issue backlog with acceptance criteria.
6. `traceability.md`: mapping from findings to backlog to tests.

## Current High-Risk Findings Snapshot
- `SC-01`: API error envelope is inconsistent across routes.
- `SC-06`: Persistence partial-failure paths often return success without degraded-state metadata.
- `SC-09`: `nodeType` exists in core/UI types but is not durably persisted in DB schema/types.
- `SC-10`: Dual migration directories create schema ownership drift risk.
- `SC-12`: Docs/API contract drift (`/api/think` and `/api/stream/:sessionId` vs implemented routes).

## How to Use
1. Start with `relationship-maps.md` for architecture context.
2. Read `silent-failure-matrix.md` and `missing-feature-gap-map.md` for concrete risk/gap evidence.
3. Execute `prioritized-backlog.md` in P0, then P1, then P2 order.
4. Use `traceability.md` to verify each backlog item closes mapped findings and test scenarios.
