# Runbook: Local Setup (BYO Credentials)

## Purpose

Set up Opus Nx locally using your own provider accounts and keys.

## Prerequisites

1. Node.js >= 22
2. pnpm 9.x
3. Python 3.12+
4. uv

## Steps

1. Clone and install dependencies.

```bash
git clone https://github.com/omerakben/opus-nx.git
cd opus-nx
pnpm install
```

2. Bootstrap env files.

```bash
pnpm setup
```

3. Fill `.env` and `agents/.env` with your credentials.

Required values:

1. `ANTHROPIC_API_KEY`
2. `AUTH_SECRET`
3. `SUPABASE_URL`
4. `SUPABASE_SERVICE_ROLE_KEY`
5. `SUPABASE_ANON_KEY`

4. Verify connectivity.

```bash
pnpm setup:verify
```

5. Start services.

```bash
pnpm dev
```

Optional swarm backend in a separate shell:

```bash
cd agents
uv run uvicorn src.main:app --reload --port 8000
```

## Validation Checklist

1. Public landing opens at `http://localhost:3000/`.
2. Login page opens at `http://localhost:3000/login`.
3. Workspace opens at `http://localhost:3000/workspace` after access-code login.

## Troubleshooting

1. If `/workspace` shows env issues, verify required keys and restart dev server.
2. If swarm endpoints fail, confirm `NEXT_PUBLIC_SWARM_URL` and agent service health.
3. If auth fails, ensure the same `AUTH_SECRET` is used across web and agents env files.
