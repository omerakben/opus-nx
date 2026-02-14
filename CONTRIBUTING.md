# Contributing to Opus Nx

Thanks for contributing to Opus Nx.

## Scope

We welcome contributions across:

1. Reasoning engines and orchestration
2. Artifact persistence and retrieval
3. Research evaluation tooling
4. Workspace UX and setup ergonomics
5. Documentation and runbooks

## Branching Model

```
main        — Production. Deployed to Vercel + Fly.io. Tagged releases.
  ↑ merges from
develop     — Integration branch. Vercel preview deployments.
  ↑ merges from
feature/*   — New features (from develop, PR back to develop)
fix/*       — Bug fixes (from develop, PR back to develop)
docs/*      — Documentation changes (from develop, PR back to develop)
hotfix/*    — Urgent production fixes (from main, PR to main AND develop)
```

### Rules

- **Never push directly to `main`** — always go through a PR.
- Feature branches are created from `develop` and PR back to `develop`.
- Releases: merge `develop` → `main` via PR, tag with semver (`v1.x.x`).
- Hotfixes go directly to `main` and are cherry-picked back to `develop`.

## Contribution Workflow

1. Fork the repo (external contributors) or create a branch from `develop`.
2. Name your branch: `feature/<name>`, `fix/<name>`, or `docs/<name>`.
3. Implement a single logical change set.
4. Add or update tests for behavior changes.
5. Update docs when interfaces, routes, setup, or workflows change.
6. Open a PR to `develop` using the PR template.
7. Ensure CI passes (lint, typecheck, tests).

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(web): add workspace setup state`
- `fix(core): guard empty reasoning chain`
- `docs(docs): refresh local setup runbook`

## Pull Request Requirements

All PRs use the [PR template](.github/pull_request_template.md). Every PR should include:

1. Problem statement
2. Solution summary
3. Risk and rollback notes
4. Test evidence

CI runs automatically on all PRs. PRs to `main` require at least 1 approving review.

Recommended test evidence:

```bash
pnpm lint
pnpm typecheck
pnpm test
cd agents && uv run pytest
```

If a subset is run, state exactly what was executed and why.

## Local Development

The fastest way to get started:

```bash
# Docker local setup (recommended)
./scripts/docker-start.sh

# Or with Supabase cloud
./scripts/dev-start.sh
```

See [README.md](README.md) for full setup instructions.

## Coding Standards

1. Keep TypeScript strict and avoid `any` in public interfaces.
2. Follow existing naming patterns.
3. Prefer small, composable functions and explicit error handling.
4. Keep comments concise and useful.

## Documentation Standards

When behavior changes, update the relevant docs in the same PR:

1. `README.md` for high-level usage shifts
2. `docs/architecture.md` for interface and topology shifts
3. `docs/runbooks/*` for operational flow changes

## Security and Credentials

1. Never commit secrets.
2. Use your own provider credentials for local testing.
3. Do not rely on maintainer personal accounts in examples or deployment docs.

## Need Help?

Open a draft PR or issue with:

1. Current behavior
2. Desired behavior
3. Reproduction details
4. Proposed direction
