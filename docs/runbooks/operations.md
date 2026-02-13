# Runbook: Operations and Maintenance

## Purpose

Operate Opus Nx reliably in ongoing research and contribution cycles.

## Daily Checks

1. Confirm app and agent service health.
2. Check Supabase connectivity and query error rates.
3. Review recent failed swarm runs and checkpoint outcomes.

## Incident Triage

1. Authentication issues:
   - Verify `AUTH_SECRET` consistency across services.
   - Confirm middleware is applied to protected routes.
2. Persistence issues:
   - Validate Supabase keys and migration state.
   - Inspect failing table operations in API logs.
3. Swarm issues:
   - Validate swarm service availability.
   - Check websocket auth token generation path.

## Quality Monitoring

1. Track verifier score trend by experiment cohort.
2. Track contradiction-rate trend.
3. Track rerun cost and time-to-retained-policy.

## Contributor Operations

1. Require test evidence with every behavior-changing PR.
2. Keep docs updates coupled with interface/flow changes.
3. Archive superseded strategy docs under `docs/archive/` rather than deleting context.
