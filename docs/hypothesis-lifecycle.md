# Hypothesis Lifecycle Contract

## Purpose

Capture the API/DB/UI changes required to treat improvement hypotheses as first-class experiments. The goal is to let analysts `promote` an alternative path, `rerun` with that alternative, `compare` rerun results to the original reasoning, and then `retain` (or discard) the new policy. This document summarizes the minimal backend surface, data model, and frontend hooks necessary to make those stages visible, actionable, and auditable without over‑engineering.

## Lifecycle Overview

| Stage                  | Trigger                                                         | Backend effect                                                                                                           | Dashboard view                                                           |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1. Promote Alternative | User promotes a candidate node/insight as an experiment         | Persist `hypothesis_experiments` row, tag involved reasoning nodes, emit `hypothesis_experiment_updated` event           | Hypothesis lifecycle panel shows new experiment card in `promoted` state |
| 2. Rerun               | Analyst requests rerun after providing scoped prompt/correction | Invoke `SwarmManager` rerun path scoped to experiment, link generated nodes/agent runs to experiment row                 | Card enters `rerunning` state; timeline highlights rerun nodes           |
| 3. Compare             | Once rerun completes, UI requests a comparison summary          | Backend computes deltas between baseline vs rerun run metadata, stores comparison outcome in experiment row, emit update | Card surfaces comparison summary with recommended action                 |
| 4. Retain policy       | Analyst chooses retain/defer/archive based on comparison        | Persist retention decision, fire final lifecycle event, optionally archive graph material                                | Card transitions to final state with decision badge                      |

## Data Model Additions

### Table `hypothesis_experiments`

```sql
CREATE TABLE hypothesis_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  hypothesis_node_id UUID NOT NULL,
  promoted_by TEXT NOT NULL DEFAULT 'human',
  alternative_summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('promoted','checkpointed','rerunning','comparing','retained','deferred','archived')),
  preferred_run_id UUID REFERENCES agent_runs(id),
  rerun_run_id UUID REFERENCES agent_runs(id),
  comparison_result JSONB,
  retention_decision TEXT CHECK (retention_decision IN ('retain','defer','archive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ON hypothesis_experiments (session_id, status);
```

`preferred_run_id` typically points to the original synthesis/verification run that generated the promoted alternative; `rerun_run_id` references the rerun that executed the promoted guidance. `comparison_result` stores `{baseline:{run_id,metrics}, rerun:{run_id,metrics}, verdict:{text,strength}}` for UI rendering.

### Table `hypothesis_experiment_actions`

```sql
CREATE TABLE hypothesis_experiment_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES hypothesis_experiments(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('promote','rerun','compare','retain')),
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX ON hypothesis_experiment_actions (experiment_id, action);
```

Captures a lightweight audit trail for every user command so the UI can show step history without replaying the entire reasoning graph.

## API Surface

Each endpoint requires the existing `Authorization: Bearer <HMAC>` header. All responses follow the envelope `{status: 'ok'|'error', data?: {...}, error?: string}` where `status` maps to HTTP 200/4xx.

### `GET /api/hypothesis/{session_id}/experiments`

Purposes:

- hydrate the lifecycle panel on page load.
- surface experiment metadata after a reload.

Response payload:

```json
{
  "status": "ok",
  "data": {
    "experiments": [
      {
        "id": "...",
        "hypothesisNodeId": "...",
        "alternativeSummary": "...",
        "status": "promoted",
        "retentionDecision": null,
        "comparisonResult": null,
        "createdAt": "2025-02-12T15:00:00Z",
        "lastUpdated": "2025-02-12T15:05:00Z"
      }
    ]
  }
}
```

### `POST /api/hypothesis/{session_id}/experiments` (Promote)

Request:

```json
{
  "hypothesisNodeId": "<node UUID>",
  "alternativeSummary": "Focus on error boundary reasoning",
  "preferredRunId": "<agent_runs.id>"
}
```

Response:

```json
{
  "status": "ok",
  "data": {
    "experimentId": "<generated UUID>",
    "status": "promoted"
  }
}
```

Effects:

- Creates `hypothesis_experiments` row with `status = promoted`.
- Tags the reasoning node (via `SharedReasoningGraph.tag_node_experiment(node_id, experiment_id)`).
- Emits `HypothesisExperimentUpdated` event via `EventBus` with payload `{experimentId, sessionId, status: 'promoted', alternativeSummary}`.

### `POST /api/hypothesis/experiments/{experiment_id}/rerun`

Request:

```json
{
  "correction": "Include distribution of state and transition costs",
  "engineQuery": "Re-run query with the promoted policy emphasis",
  "agents": ["deep_thinker","contrarian"],
  "metadata": {"editor": "author@example.com"}
}
```

Response:

```json
{
  "status": "ok",
  "data": {
    "experimentId": "...",
    "rerunRunId": "<agent_runs.id>",
    "status": "rerunning"
  }
}
```

Effects:

- Updates experiment row with `status = rerunning`, `rerun_run_id`, `last_updated`.
- Creates a `hypothesis_experiment_actions` entry with action `rerun`.
- Calls `SwarmManager.run()` or the dedicated rerun helper, passing `engineQuery` + `metadata.correction`.
- `SwarmManager` publishes a new event once rerun finishes so UI can fetch comparison.

### `POST /api/hypothesis/experiments/{experiment_id}/compare`

Request:

```json
{
  "baselineRunId": "<agent_runs.id>",
  "candidateRunId": "<rerun_run_id>",
  "metrics": ["confidence","consensus","tokens"]
}
```

Response:

```json
{
  "status": "ok",
  "data": {
    "experimentId": "...",
    "comparisonResult": {
      "baseline": {"runId": "...", "metrics": {"confidence": 0.68}},
      "candidate": {"runId": "...", "metrics": {"confidence": 0.74}},
      "verdict": {"text": "Candidate increases confidence", "strength": 0.82},
      "suggestedAction": "retain"
    },
    "status": "comparing"
  }
}
```

Effects:

- Stores `comparison_result`, updates `status` to `comparing`, updates timestamp.
- Emits lifecycle event with payload including `comparisonResult` so card can render summary.
- Optionally persists derived insights into `hypothesis_experiment_actions` for timeline.

### `POST /api/hypothesis/experiments/{experimentId}/retain`

Request:

```json
{
  "decision": "retain",
  "notes": "New policy coherent with verifier output",
  "metadata": {"owner": "analyst@example.com"}
}
```

Response:

```json
{
  "status": "ok",
  "data": {
    "experimentId": "...",
    "status": "retained",
    "retentionDecision": "retain"
  }
}
```

Effects:

- Updates `status`/`retention_decision` in `hypothesis_experiments`.
- Records final action row in `hypothesis_experiment_actions`.
- Emits final `HypothesisExperimentUpdated` event with `status: 'retained'` and `decision` metadata.

## Backend Hooks

| Area                                       | Action                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/agents/src/server.py`                    | Add the new endpoints above, reuse `require_auth`, return consistent envelopes, and delegate heavy lifting to service helpers (e.g., `HypothesisLifecycleService`). Maintain current `checkpoint` functionality untouched.                                                   |
| `/agents/src/swarm.py`                     | Expose helpers such as `run_experiment(experiment_id, query, agents)` and `rerun_with_correction` variants that tag generated nodes with `hypothesis_experiment_id`. Emit `HypothesisExperimentUpdated` events after rerun completion, comparison generation, and retention. |
| `/agents/src/graph/reasoning_graph.py`     | Add metadata methods to tag nodes/edges with `experiment_id`, e.g. `attach_experiment_to_node(node_id, experiment_id, role)`. Return nodes filtered by experiment so UI can highlight rerun reasoning.                                                                       |
| `/agents/src/events/types.py`              | Define `HypothesisExperimentUpdated(SwarmEvent)` carrying `{experiment_id, status, comparisonResult?, retentionDecision?, metadata?}` so WebSocket clients get live lifecycle updates.                                                                                       |
| `/agents/src/persistence/supabase_sync.py` | Add a `sync_hypothesis_experiment` helper to upsert `hypothesis_experiments` rows and `hypothesis_attempts` if needed. Call it whenever the experiment state changes so the Supabase mirror stays consistent.                                                                |
| `/agents/src/persistence/neo4j_client.py`  | (If Neo4j is used) add minimal support for writing experiment metadata in the `thinking_nodes` or separate `HypothesisExperiment` node label, keeping indexes to minimal.                                                                                                    |
| `/agents/src/events/bus.py`                | Already accepts dicts; no changes except ensuring `HypothesisExperimentUpdated` events are publishable.                                                                                                                                                                      |

## UI Contract & Component Hooks

Interface additions live under `/apps/web`.

### Data contracts

Define TypeScript interfaces in `apps/web/src/lib/api.ts` and `apps/web/src/lib/hooks/use-swarm.ts`:

```ts
interface HypothesisExperiment {
  id: string;
  sessionId: string;
  hypothesisNodeId: string;
  alternativeSummary: string;
  status: 'promoted' | 'checkpointed' | 'rerunning' | 'comparing' | 'retained' | 'deferred' | 'archived';
  retentionDecision?: 'retain' | 'defer' | 'archive';
  comparisonResult?: {
    baseline: { runId: string; metrics: Record<string, number> };
    candidate: { runId: string; metrics: Record<string, number> };
    verdict: { text: string; strength: number };
    suggestedAction: 'retain' | 'defer' | 'archive';
  };
  createdAt: string;
  lastUpdated: string;
}
```

Expose API helpers: `fetchHypothesisExperiments(sessionId)`, `promoteHypothesis(sessionId, payload)`, `rerunHypothesis(experimentId, payload)`, `compareHypothesis(experimentId, payload)`, and `retainHypothesis(experimentId, payload)` (all returning typed data). Hook these into `apps/web/src/lib/hooks/use-swarm.ts` (alongside `startSwarm`). That hook should maintain experiment list, subscribe to WebSocket events (`hypothesis_experiment_updated`), and expose `refreshExperiments()` for manual compare polling.

### `ReasoningDetail` actions (`apps/web/src/components/thinking/ReasoningDetail.tsx`)

Add a contextual dropdown/button when the node is the root of an `improvement_hypothesis` or `hypothesis` step. Text: `Promote as hypothesis experiment`. When clicked, open a modal (new component) where the analyst can edit the `alternativeSummary` and pick a `preferredRunId` from recent synthesis nodes (maybe reused from existing timeline). On submit, call `promoteHypothesis` and show immediate optimistic state in `HypothesisLifecyclePanel` via the shared hook.

### Hypothesis Lifecycle Panel (`apps/web/src/components/insights/InsightsPanel.tsx` + new `/components/hypothesis/HypothesisLifecyclePanel.tsx`)

- Add a new tab or card area called `Experiments` with a `HypothesisLifecyclePanel` component.
- Panel responsibilities:
  - Render experiment cards (`HypothesisExperimentCard.tsx`) showing stage, timestamps, alternative summary, and comparison highlights.
  - Provide per-stage action buttons (Promote -> `Rerun`, `Compare`, `Retain`). Buttons call the new hook methods.
  - Show loading/failure states per action and handle websocket updates so cards animate between states without a full reload.
  - Display comparison metrics in a `HypothesisComparisonSummary` subcomponent when `comparisonResult` exists. This summary highlights `baseline` vs `candidate` by metric and surfaces `verdict.text`/`suggestedAction`.
  - Use badges (Stage Chip) referencing `colors.ts` or introduce new palette entry such as `colors.hypothesis`.

### Compare & Retain workflows

- After a rerun completes, fetch comparison data via `compareHypothesis` and show the `HypothesisComparisonSummary`. If the backend `comparisonResult.suggestedAction` equals `retain`, highlight the `Retain` button.
- The `Retain` action opens a lightweight panel allowing the analyst to select `retain`, `defer`, or `archive` plus optional notes. Submitting calls `retainHypothesis`.
- Final status badges and notes should appear in the card, along with `lastUpdated` relative time.

### Timeline and Graph highlights

- Highlight nodes that belong to experiments by coloring edges/nodes when `SharedReasoningGraph` emits extra metadata. Optionally show `experiment_id` as a tooltip.

## Event Stream & State Synchronization

1. WebSocket event `hypothesis_experiment_updated` includes `(experimentId, status, comparisonResult?, retentionDecision?, metadata?)`. `useSwarm` listens to this event and updates `experiments` state without reloading the full graph.
2. When the UI triggers rerun/compare/retain, show spinner and rely on event arrival to transition card state.
3. `HypothesisLifecyclePanel` also exposes `refreshExperiments` to re-fetch after long pauses or manual compare.

## Migration Runbook (Supabase CLI)

`db:migrate` now uses Supabase CLI directly (no `exec_sql` RPC dependency).

### Local development

1. Start local Supabase stack: `supabase start`
2. Apply canonical migrations: `pnpm db:migrate:local`
3. Regenerate local types when schema changes: `pnpm db:generate`

`db:migrate:local` runs `supabase db reset --local --yes` to rebuild the local database from migration files.

### Linked environments (dev/staging/prod)

1. Ensure project is linked and authenticated: `supabase link` and `supabase login`
2. Apply pending migrations: `pnpm db:migrate:linked`

`db:migrate:linked` runs `supabase db push` against the linked project.

### Drift gate (CI and pre-release)

Run `pnpm check:migrations` to enforce that:

1. `supabase/migrations/*.sql` and `packages/db/migrations/*.sql` contain the same files
2. canonical and mirror files have identical content

### Failure recovery

1. If linked push fails, inspect CLI output and fix migration SQL, then rerun `pnpm db:migrate:linked`.
2. If local reset fails, run `supabase db reset --local --debug` for details, fix migration, rerun `pnpm db:migrate:local`.
3. If PostgREST schema cache lags after migration apply, run a no-op query against the affected table/function and retry the API call; if needed, restart local Supabase (`supabase stop && supabase start`) to refresh cache.
4. If partial apply is suspected, run `supabase migration list` and compare applied versions against `supabase/migrations/`; then rerun `pnpm db:migrate:linked` until the latest version is applied.
5. If drift check fails, copy the canonical migration into `packages/db/migrations/` and rerun `pnpm check:migrations`.
6. Never hot-edit production schema outside migrations; create a new migration for all fixes.

## Next Steps

1. Add Supabase migration file (`supabase/migrations/00X_hypothesis_experiments.sql`) and regenerate `packages/db` types.
2. Implement new FastAPI endpoints in `agents/src/server.py` and hook them into a lightweight `HypothesisLifecycleService` that orchestrates `SwarmManager`, `SharedReasoningGraph`, and persistence.
3. Extend `apps/web/src/lib/api.ts` + `hooks/use-swarm.ts` with the typed helpers described above and wire them into UI components.
4. Build the UI surfaces under `apps/web/src/components/hypothesis/` and update `InsightsPanel` + `ReasoningDetail` to surface actions.
5. Verify WebSocket event emission by adding `HypothesisExperimentUpdated` to both the backend `EventBus` publication points and the front-end event union.

This design keeps the new workflow scoped to just a few files while letting analysts treat hypotheses as experiments with clear API, data, and UI contracts.
