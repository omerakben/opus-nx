---
Please prepare well-designed documentation for this project, including Markdown files, a PRD, an Architecture document, research mindset docs, runbooks, stories, use cases, and a README. We updated the structure with many new approaches and implementations, but we have not yet updated the scope. What changed? We designed this project for a hackathon, but we did not join due to limited seats. Now we are shifting direction toward research and open-source applications, and we are happy to accept contributions. Let's get viral with this project. Please prepare the landing page with the new scope, keeping the existing content. We should find a way for people to use this application with their credentials, not my personal accounts like my Antropich API or my Supabase. We should change the structure so people can use their accounts and API keys with an easy setup for those who want to use it.

# Opus Nx Repositioning Plan: Research + Open Source Docs, Public Landing, and BYO Credentials Setup

## Summary

1. Reframe the project from hackathon-deliverable language to research-platform + open-source contributor language while preserving current technical content.
2. Ship a complete documentation set (PRD, architecture, research mindset, runbooks, stories, use cases, README, contribution docs) as new canonical docs; keep legacy hackathon docs in archive.
3. Restructure web routes so `/` is public landing and `/workspace` is the authenticated app, with graceful setup mode for missing env keys and a CLI bootstrap for BYO credentials.

## Implementation Plan

1. Create canonical docs structure and keep historical docs untouched.
   - Add `/Users/ozzy-mac/Projects/opus-nx/docs/README.md` as docs index and source-of-truth map.
   - Add `/Users/ozzy-mac/Projects/opus-nx/docs/prd.md` as the new active PRD focused on research + OSS scope.
   - Update `/Users/ozzy-mac/Projects/opus-nx/docs/architecture.md` to include the new product scope and deployment/credential ownership model.
   - Add `/Users/ozzy-mac/Projects/opus-nx/docs/research-mindset.md` for hypotheses, methodology, evaluation loop, and publication posture.
   - Add `/Users/ozzy-mac/Projects/opus-nx/docs/stories.md` for prioritized user stories aligned to researchers and contributors.
   - Add `/Users/ozzy-mac/Projects/opus-nx/docs/use-cases.md` for practical flows (solo researcher, OSS contributor, team deployment).
   - Add runbooks: `/Users/ozzy-mac/Projects/opus-nx/docs/runbooks/local-setup.md`, `/Users/ozzy-mac/Projects/opus-nx/docs/runbooks/deployment.md`, `/Users/ozzy-mac/Projects/opus-nx/docs/runbooks/operations.md`.
   - Keep `/Users/ozzy-mac/Projects/opus-nx/docs/archive/` as historical-only and add links from new docs index.

2. Rewrite root project narrative for contributors while preserving existing substance.
   - Update `/Users/ozzy-mac/Projects/opus-nx/README.md` to keep current feature/research sections, but change scope framing to open-source research platform.
   - Keep existing core messaging and feature content, but replace hackathon/outdated framing and “future scope” ambiguity with clear “current capabilities / active research / roadmap”.
   - Make primary CTA “Run locally with your keys”; keep demo as optional (`DEMO_MODE`) rather than default.

3. Add open-source contributor governance docs.
   - Add `/Users/ozzy-mac/Projects/opus-nx/CONTRIBUTING.md` with contribution flow, branch/commit conventions, test requirements, and doc standards.
   - Add `/Users/ozzy-mac/Projects/opus-nx/CODE_OF_CONDUCT.md` with contribution behavior expectations and reporting path.
   - Link both from `/Users/ozzy-mac/Projects/opus-nx/README.md` and `/Users/ozzy-mac/Projects/opus-nx/docs/README.md`.

4. Restructure app routing for a public landing and authenticated workspace.
   - Change `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/app/page.tsx` to render a new public landing page that preserves current visual/content motifs from the existing login hero and feature cards.
   - Add `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/app/workspace/page.tsx` to render the existing `Dashboard`.
   - Keep `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/app/login/page.tsx` as access page for workspace auth.
   - Update `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/proxy.ts` to protect `/workspace` and protected APIs while leaving `/` public.
   - Update hardcoded redirects/links in `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/components/layout/Header.tsx`, `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/app/share/[token]/page.tsx`, and `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/app/not-found.tsx`.

5. Implement graceful setup mode and BYO credential onboarding.
   - Remove global fail-fast env validation from `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/app/layout.tsx` so landing/docs can load without full secrets.
   - Refactor `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/lib/server-env.ts` and `/Users/ozzy-mac/Projects/opus-nx/packages/shared/src/config.ts` into scoped validation: public-safe startup vs workspace-required env validation.
   - Keep access-code auth (`AUTH_SECRET`) for `/workspace`; do not introduce full multi-tenant auth in this phase.
   - Keep demo optional by env flag and document default-off behavior.
   - Add bootstrap CLI script `/Users/ozzy-mac/Projects/opus-nx/scripts/bootstrap.ts` that initializes `.env` and `agents/.env`, generates secure `AUTH_SECRET`, and prints next actions.
   - Add npm scripts in `/Users/ozzy-mac/Projects/opus-nx/package.json`: `setup` and `setup:verify` (reuse `/Users/ozzy-mac/Projects/opus-nx/scripts/test-connections.ts`).

6. Align tests and QA with new structure.
   - Update `/Users/ozzy-mac/Projects/opus-nx/apps/web/e2e/swarm.spec.ts` route expectations from `/` to `/workspace` (or add auth/session setup fixture).
   - Add targeted tests for route protection behavior and env setup mode behavior.
   - Run baseline checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `cd /Users/ozzy-mac/Projects/opus-nx/agents && uv run pytest`.
   - Verify manual flow: first-time clone with missing keys can open `/`, read setup docs, run `pnpm setup`, configure credentials, sign in, and access `/workspace`.

## Important Public API / Interface / Type Changes

1. Route interface changes:
   - `GET /` becomes public landing page.
   - New authenticated app entry at `GET /workspace`.
   - `/login` remains access-code auth entrypoint.
2. Middleware/auth behavior changes:
   - `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/proxy.ts` matcher/allowlist updated to public-first routing.
3. Environment contract changes:
   - Split env validation into scoped contracts (public startup vs workspace runtime requirements) in `/Users/ozzy-mac/Projects/opus-nx/packages/shared/src/config.ts` and `/Users/ozzy-mac/Projects/opus-nx/apps/web/src/lib/server-env.ts`.
4. Developer CLI interface additions:
   - `pnpm setup` and `pnpm setup:verify` documented as canonical onboarding commands.

## Test Cases and Scenarios

1. Public landing availability: app boots and `/` renders even when `ANTHROPIC_API_KEY`/Supabase vars are missing.
2. Workspace protection: unauthenticated access to `/workspace` redirects to `/login`; authenticated flow enters `/workspace`.
3. Auth continuity: logout returns user to public landing/login path without broken links.
4. Setup flow: fresh clone + `pnpm setup` creates expected env files and secure secret, then `pnpm setup:verify` reports missing/valid credentials accurately.
5. Docs navigability: README links correctly to PRD, architecture, runbooks, stories, use cases, and contribution docs.
6. Regression checks: existing reasoning routes still function after route and env-validation refactor.

## Assumptions and Defaults

1. Primary audience is researchers and OSS contributors.
2. Primary CTA is “run locally with your own credentials”.
3. Authentication remains access-code based in this phase; full user/tenant auth is deferred.
4. Demo capability stays in code but is disabled by default unless explicitly enabled.
5. Legacy hackathon docs remain archived, not deleted.
6. Existing uncommitted file `/Users/ozzy-mac/Projects/opus-nx/apps/web/next-env.d.ts` is left untouched.

---
