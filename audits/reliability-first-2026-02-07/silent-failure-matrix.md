# Silent Failure Matrix

## Severity Model
- `P0`: possible data loss/corruption or false-success response.
- `P1`: user-visible inconsistency or degraded behavior without explicit error.
- `P2`: observability/documentation debt with limited immediate impact.

| ID | Location | Trigger | Current Behavior | User-visible Impact | Data Risk | Detection Gap | Proposed Fix | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SF-01` | `apps/web/src/lib/hooks/use-thinking-stream.ts:251` | SSE chunk split creates partial JSON | parse error is ignored in empty `catch` | Missing thinking/compaction chunks with no signal | Medium | No metric/event for dropped chunks | Emit `recoverable_parse_error` state + telemetry counter + correlation ID | P1 |
| `SF-02` | `apps/web/src/app/api/sessions/route.ts:16` | first-node batch lookup fails | empty `catch` swallows error | session list silently loses display names | Low | no warning, no degraded field | Log with correlation ID and include `displayNameStatus: degraded` | P1 |
| `SF-03` | `packages/core/src/orchestrator.ts:280` | ThinkGraph persistence throws | logs error then continues with success response | caller sees success without persistence status | High | no typed degraded contract | Return `degraded=true` with failure codes in orchestrator result and API response | P0 |
| `SF-04` | `packages/core/src/think-graph.ts:680` | decision point insert fails | warn and continue loop | partial reasoning archaeology without notice | High | no persisted partial-failure flag | Collect failures and return `partialPersistence` metadata + alert hook | P0 |
| `SF-05` | `packages/core/src/think-graph.ts:705` | parent edge insert fails | warn and continue with node success | graph topology incomplete | High | no explicit edge-link status in API | Return `linkedToParent=false` plus degraded metadata to clients | P0 |
| `SF-06` | `apps/web/src/app/api/thinking/stream/route.ts:115` | latest node lookup fails | warn and continue without parent link | continuity gaps in streamed graph chain | Medium | only console warning | Include `parentLinkStatus` in final SSE `done` event | P1 |
| `SF-07` | `apps/web/src/app/api/thinking/stream/route.ts:145` | compaction node persist fails | warn and continue to done event | compaction history appears incomplete | Medium | no degraded flag on done event | Emit `compactionPersistStatus` and alert metric | P1 |
| `SF-08` | `packages/core/src/metacognition.ts:558` | default prompt missing | warn and fallback to embedded prompt | analysis behavior changes silently | Medium | no environment guardrails | Add strict mode in prod; attach `fallbackPromptUsed=true` in result metadata | P1 |
| `SF-09` | `packages/core/src/thinkfork.ts:839` | thinkfork prompt file read fails | warn and fallback prompt | branch style behavior drift | Medium | fallback usage not surfaced to API by default workflows | Add `fallbackPromptsUsed` propagation to route response and warning banner | P1 |
| `SF-10` | `packages/db/src/metacognition.ts:307` | FTS query fails | warn and fallback to ILIKE | relevance quality drops without consumer visibility | Medium | no quality flag in response | Return `searchMode` and `quality=degraded` markers | P1 |
| `SF-11` | `packages/db/run-migrations.ts:41` | SQL statement fails | script can skip/continue and still print completion | false confidence in migration success | High | no strict failure exit policy | fail-fast by default; track failed statements; non-zero exit on any failure | P0 |
| `SF-12` | `apps/web/src/lib/hooks/use-graph.ts:66` | edge serialization transformed | `createdAt` replaced with `new Date()` | timeline ordering appears valid even when API data is stale/wrong | Low | no integrity check against server timestamp | preserve server timestamp; add runtime assertion for timestamp parse | P2 |
| `SF-13` | `apps/web/src/components/graph/ThinkingNode.tsx:110` | user clicks annotation actions | local state changes only; no persistence call | user assumes note/agreement was saved | Medium | no UX indicator that action is local-only | persist annotations or relabel as local filters with explicit UI copy | P1 |

## Required Fix Shape (applies to all P0/P1 items)
1. Define explicit error classes (`PartialPersistenceError`, `RecoverableStreamError`, `ConfigFallbackError`).
2. Attach `correlationId` to route responses and log contexts.
3. Add API-visible degraded metadata for partial-success paths.
4. Add regression tests and alerting thresholds for each failure path.
