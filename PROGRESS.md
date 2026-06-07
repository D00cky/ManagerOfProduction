# Progress / Handoff

Status as of 2026-06-07. All work below is committed; `npm run typecheck` is clean and `npm test` is green (123 tests).

## Done

### Backend (service / repository / route per AGENTS.md)
Every capability in `src/lib/permissions.ts` has a service + scoped API route, plus polo CRUD:
- OS: list, status transitions (`PATCH /api/ordens/[id]`), fiscal assignment (`POST /api/ordens/[id]/atribuir`, os:write + polo scope), FFR tabulation (`PUT /api/ordens/[id]/tabulacao`, with `getTabulacaoEdicao` read).
- Excel import preview/confirm, dashboard, equipe roster, user management (usuarios:write), FFR reports (relatorios:read), sync/backup settings (ConfigSync), polo management.
- All permission-gated routes return **403** for "Sem permissao" denials, 400 for other errors.

### Frontend (Next 15 App Router, NextAuth credentials)
All navigation pages + login built and verified end-to-end against a live server:
`/login`, `/dashboard`, `/fila` (with status + assign actions and a Tabular link), `/usuarios`, `/equipe`, `/relatorios`, `/configuracoes`, `/tabulacao/[id]` (live FFR scoring).
- Foundation: NextAuth handler `src/app/api/auth/[...nextauth]/route.ts`, root `layout.tsx` + `globals.css` theme, `Providers` (SessionProvider), role-redirect root page.
- shadcn-style UI primitives in `src/components/ui` (button/input/label/card/badge/status-badge/select/textarea).

### Conventions for new pages (follow these)
- Page = Server Component: `getCurrentUser()` → `redirect("/login")` if null; guard with `hasPermission(perfil, ...)` → `redirect(defaultRedirect(perfil))`; then call the **service + Prisma repo directly** (no HTTP hop).
- Interactive bits are `"use client"` components that hit the `/api/*` routes, then `router.refresh()`.
- `listOrdens` is typed as scalar `OrdemServico[]` (relations are included at runtime but not in the type).

## Remaining work
1. **No automated E2E** — Playwright is in `package.json` but unconfigured (no `playwright.config`, no e2e dir). Core flows (login, tabulation, import, fila actions) are only manual/curl-verified. AGENTS.md wants E2E for user-critical flows.
2. The `/importar` in-browser XLSX parse is the one path no test drives (it reuses the unit-tested `src/lib/importacao` functions; the confirm endpoint is tested).
3. **Deferred (need product decisions):** `Avaliacao` review (model exists, no permission defined), backup worker (`scripts/backup-worker.ts` referenced in package.json but missing; `BackupRegistro` + `ConfigSync.autoBackup` exist), and empty placeholder API dirs `api/configuracoes/sync` + `api/relatorios/exportar`.

## Run / verify locally
```
cp .env.example .env            # set NEXTAUTH_SECRET; DATABASE_URL=file:./dev.db
npx prisma db push              # create schema
npm run db:seed                 # seed test users (supervisor/monitor/fiscal @example.com, senha123)
npm run dev                     # custom server.ts (Next + Socket.IO) on PORT (default 3000)
npm run typecheck && npm test
```
Deployment: `render.yaml` is set up for a free-tier ephemeral-SQLite test deploy; storage is driven by `DATABASE_URL` (swap to a persistent disk or Postgres later). See comments in `render.yaml`.
