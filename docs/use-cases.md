# Use Cases

## 1. Solo Researcher

Goal: study reasoning behavior across repeated analytical tasks.

Flow:

1. Bootstrap local env with `pnpm setup`.
2. Configure personal provider credentials.
3. Run workspace sessions and inspect graph artifacts.
4. Promote and rerun hypotheses.
5. Retain winning policies with experiment history.

## 2. Open-Source Contributor

Goal: add or improve a reasoning module and validate no regression.

Flow:

1. Follow local setup runbook.
2. Implement targeted module or UX changes.
3. Add tests for behavior change.
4. Run lint, typecheck, unit tests, and agent tests.
5. Submit PR with evidence and docs updates.

## 3. Team Deployment

Goal: deploy a reproducible internal research stack using team-owned accounts.

Flow:

1. Provision team Supabase and provider keys.
2. Configure web and agents environments.
3. Deploy Next.js app and swarm backend.
4. Verify health and auth path behavior.
5. Track metrics through eval harness and runbooks.

## 4. Reasoning Quality Improvement Sprint

Goal: improve verifier score and reduce contradiction rate on a benchmark set.

Flow:

1. Baseline with existing policy.
2. Generate structured hypotheses from weak runs.
3. Execute rerun experiments with controlled interventions.
4. Compare deltas and retain best policy.
5. Document findings and next hypothesis set.
