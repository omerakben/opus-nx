# Runbook: Deployment

## Purpose

Deploy Opus Nx with organization-owned credentials and reproducible configuration.

## Reference Topology

1. Web app: Next.js deployment platform (for example Vercel).
2. Swarm backend: FastAPI deployment platform (for example Fly.io).
3. Database: Supabase project owned by your team.

## Deployment Steps

1. Provision secrets in web environment:
   - `ANTHROPIC_API_KEY`
   - `AUTH_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SWARM_URL`
2. Provision secrets in agents environment:
   - `ANTHROPIC_API_KEY`
   - `AUTH_SECRET` (must match web)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Apply migrations:

```bash
pnpm db:migrate
```

4. Deploy web and agents services.
5. Validate with health endpoints and workspace smoke tests.

## Post-Deploy Checks

1. `/` is public.
2. `/workspace` is auth-gated.
3. `/api/health` reports expected service status.
4. Swarm runs and WebSocket events stream correctly.

## Security Notes

1. Do not use maintainer personal keys in shared deployments.
2. Rotate `AUTH_SECRET` with coordinated rollout across services.
3. Restrict service-role key access to backend runtime only.
