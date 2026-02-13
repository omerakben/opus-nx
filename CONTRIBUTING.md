# Contributing to Opus Nx

Thanks for contributing to Opus Nx.

## Scope

We welcome contributions across:

1. Reasoning engines and orchestration
2. Artifact persistence and retrieval
3. Research evaluation tooling
4. Workspace UX and setup ergonomics
5. Documentation and runbooks

## Contribution Workflow

1. Create a focused branch from current mainline work.
2. Implement a single logical change set.
3. Add or update tests for behavior changes.
4. Update docs when interfaces, routes, setup, or workflows change.
5. Open a PR with evidence.

## Branch and Commit Conventions

Use Conventional Commits, for example:

- `feat(web): add workspace setup state`
- `fix(core): guard empty reasoning chain`
- `docs(docs): refresh local setup runbook`

## Pull Request Requirements

Every PR should include:

1. Problem statement
2. Solution summary
3. Risk and rollback notes
4. Test evidence

Recommended test evidence:

```bash
pnpm lint
pnpm typecheck
pnpm test
cd agents && uv run pytest
```

If a subset is run, state exactly what was executed and why.

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
