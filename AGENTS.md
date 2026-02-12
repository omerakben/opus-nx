# Repository Guidelines

## Project Structure & Module Organization

- `apps/web`: Next.js 16 dashboard (`src/app`, `src/components`, `src/styles`), plus e2e specs in `apps/web/e2e`.
- `packages/core`: TypeScript reasoning engines and unit tests in `src/*.test.ts`.
- `packages/db`: Supabase client code, generated DB types, and migration scripts.
- `packages/shared`: shared schemas, config loaders, and utilities.
- `packages/agents`: TypeScript agent package used by the workspace.
- `agents/`: Python FastAPI swarm backend (`src/`, `tests/`).
- `configs/` and `supabase/migrations/`: prompts/config and canonical SQL migrations.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies (Node `>=22`, pnpm `9.x`).
- `pnpm dev`: run Turborepo dev tasks (web app at `http://localhost:3000`).
- `pnpm build`: build all apps/packages.
- `pnpm lint`: run lint checks across the monorepo.
- `pnpm typecheck`: run strict TypeScript checks.
- `pnpm test`: run migration drift check and Turbo test pipeline.
- `pnpm db:migrate`: apply Supabase migrations.
- `pnpm check:migrations`: verify migration metadata sync.
- `cd agents && uv run pytest`: run Python backend tests.
- `cd agents && uv run uvicorn src.main:app --reload --port 8000`: run the swarm service locally.

## Coding Style & Naming Conventions

- TypeScript is ESM + strict mode; keep public APIs typed and avoid `any`.
- Match existing file naming: React components in `PascalCase.tsx`, utility modules in `kebab-case.ts`.
- Test files use `*.test.ts` (TS) and `test_*.py` (Python).
- Follow `apps/web/eslint.config.js` rules: prefix intentional unused params with `_`; use `console.warn/error` instead of unrestricted `console.log`.

## Testing Guidelines

- Unit tests: Vitest in `packages/core/src/**/*.test.ts`.
- Python tests: `pytest` in `agents/tests/` (async enabled).
- Add or update tests for every behavior change; include a regression test for bug fixes.
- For UI flow changes, add/update Playwright coverage in `apps/web/e2e`.

## Commit & Pull Request Guidelines

- Follow Conventional Commit style seen in history: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`, `release: ...`.
- Keep commits focused and imperative (example: `fix(core): handle empty thought graph`).
- PRs should include a clear summary, linked issue, test evidence (`pnpm test`, and `uv run pytest` when backend changes), and screenshots/GIFs for UI updates.
- Explicitly call out environment-variable, migration, or schema impacts.
