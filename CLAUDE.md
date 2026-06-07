# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ManagerOfProduction is a Next.js 15 (App Router, React 19) internal tool for managing field service orders ("Ordens de Serviço" / OS). Data lives in SQLite via Prisma. Auth is NextAuth credentials (matrícula or email + password). Domain language is Portuguese — keep new identifiers, enums, and DB fields in Portuguese to match (`ordens`, `tabulacao`, `fiscal`, `polo`, `conceito`).

## Commands

- `npm run dev` — dev server (`tsx server.ts`, a custom server wiring Socket.IO). Use `npm run dev:next` for plain `next dev` when the custom server isn't needed.
- `npm run build` — runs `prisma generate` then `next build`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — `next lint`.
- `npm test` — Vitest run (unit + API route tests under `tests/`).
- `npx vitest run tests/unit/ffr.test.ts` — run a single test file.
- `npx vitest run -t "name"` — run tests matching a name.
- `npm run test:e2e` — Playwright E2E.
- `npm run db:migrate` / `npm run db:generate` / `npm run db:seed` — Prisma migrate / client gen / seed.

Env vars (see `.env.example`): `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `BACKUP_LOCAL_DIR`.

## Demo / Render context

The current Render/free-tier deployment is a demo sandbox, not production persistence.

- Demo credentials: `supervisor@example.com` / `S0001`, `monitor@example.com` / `M0001`, `fiscal@example.com` / `F0001`; password `senha123`.
- `DEMO_AUTH_ENABLED=true` allows those demo users to log in even if the SQLite user table is empty.
- `RESET_DEMO_DB_ON_START=true` makes `npm run start:render` remove the demo SQLite file before schema push + seed, so Render restarts return to clean examples.
- `Example/demo-os.xlsx` is the import demo workbook; the same 8 OS are also seeded by `prisma/seed.ts`.
- Changes made through the app persist while the Render instance is online. With reset enabled, restart/cold start cleans the demo database.

## Current implementation vs roadmap

The app currently implements the Gerenciador FFR core (Bloco A) plus basic dashboard/reporting/export. The architecture file `ARQUITETURA_FFR_PLANEJAMENTO.md` describes the future target for the full platform, including Central de Conformidade, geographic dashboard, PostgreSQL analytics, materialized views, Redis/cache, ExcelJS formatted reports, PDF export, and Docker Compose corporate deployment. Do not present those roadmap items as already complete unless they are implemented and tested in this repo.

## Architecture: service / repository split

The core pattern is that **business logic lives in pure functions that take a repository interface as their first argument**, so logic is unit-tested without a database. Do not put domain logic directly in API routes or call Prisma from them.

- `src/server/*-service.ts` — pure domain functions (e.g. `os-service.ts`, `tabulacao-service.ts`, `dashboard-service.ts`, `importacao-service.ts`). Each defines its own `*Repository` type (the data interface it needs) and operates on `SessionUserScope`.
- `src/server/prisma-*-repository.ts` — the concrete Prisma implementations of those repository interfaces. The only place Prisma talks to the DB.
- `src/app/api/**/route.ts` — thin. They authenticate (`getCurrentUser`), return 401 if absent, then call a service with the matching `prisma*Repository`. Keep them small.
- Tests in `tests/unit/*` exercise services with hand-written in-memory repositories; `tests/unit/api/*` test routes with mocked services/sessions.

When adding a feature: extend the service's repository type with the data access it needs, implement it in the Prisma repository, write the logic as a pure service function, and wire it from a route.

## Permissions and data scope (security-critical)

Two distinct layers, both must be respected:

- **Capability**: `src/lib/permissions.ts` — `rolePermissions` maps each `Perfil` (`fiscal` | `monitor` | `supervisor`) to `Permission` strings. Use `hasPermission(perfil, permission)`. The same `navigation` table drives the sidebar, so UI and API authorization share one source of truth.
- **Row scope**: `src/lib/scope.ts` — `buildOsScope(user)` returns the Prisma `where` filter per role; `allowedPoloIds(user)` / `isOrdemInUserScope` enforce visibility. Rules: `fiscal` sees only OS with their own `fiscalId`; `monitor` sees their authorized polos (`polosPermitidos`, defaulting to own `poloId`); `supervisor` sees everything. Every query that returns OS data must be scoped this way.

`canTransitionStatus(from, to, hasTabulacao)` in `permissions.ts` is the single authority for OS status changes. Notable rules: `Cancelada`/`Concluida` are terminal; moving to `Concluida` requires a saved tabulation; cancellation is a logical status change (`Cancelada`), never a physical delete of a normal OS.

## FFR scoring

`src/lib/ffr.ts` computes the quality score from tabulation answers, using question groups defined in `src/data/grupos-ffr.ts` (selected per `TipoServico`). Critical rule (regression-tested): answers of `"X"`, `null`/`undefined`, text-type items, and items with weight `0` are excluded from **both** `somaObtida` and `somaPossivel`. `conceitoPorPercentual` maps the ratio to `Conceito` A/B/C/D, or `NaoAvaliado` when nothing is possible.

## Working agreement (from AGENTS.md)

This repo follows strict TDD/XP. Before changing production behavior, add or update a failing test first; implement the minimal change; refactor only when green. New domain logic needs unit tests; permission/scope rules must be tested for both allowed and denied access; bug fixes need a regression test. A change isn't complete until relevant tests and `npm run typecheck` pass (or the reason they couldn't run is reported), and completed changes should be committed with a clear message. See `AGENTS.md` for the full agreement.
