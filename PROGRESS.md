# Progress / Handoff

Status as of 2026-06-07. All work below is committed; `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` are green.

## Done

### Demo de amanhã (funciona hoje)
Use esta seção para apresentar o estado atual sem confundir com o roadmap de arquitetura.
- Deploy Render: app roda como Node Web Service com health check em `/api/health`.
- Login demo: `supervisor@example.com`/`S0001`, `monitor@example.com`/`M0001`, `fiscal@example.com`/`F0001`; senha `senha123`.
- Banco demo: SQLite efêmero em Render; `RESET_DEMO_DB_ON_START=true` limpa e recria a base quando o serviço reinicia.
- Dados demo: 8 OS são semeadas no startup; `Example/demo-os.xlsx` pode ser importado na tela **Importar Excel** para simular importação.
- Fluxos demonstráveis: fila de OS, atribuição fiscal, transições de status, tabulação FFR, finalização com tabulação salva, dashboard básico, relatório CSV, sync/backup manual e escopo por perfil.
- Enquanto a instância Render está online, alterações feitas no app ficam gravadas no SQLite; ao reiniciar com reset habilitado, a base volta aos exemplos limpos.

### Backend (service / repository / route per AGENTS.md)
Every capability in `src/lib/permissions.ts` has a service + scoped API route, plus polo CRUD:
- OS: list, status transitions (`PATCH /api/ordens/[id]`), fiscal assignment (`POST /api/ordens/[id]/atribuir`, os:write + polo scope), FFR tabulation (`PUT /api/ordens/[id]/tabulacao`, with `getTabulacaoEdicao` read).
- Excel import preview/confirm, dashboard, equipe roster, user management (usuarios:write), FFR reports (relatorios:read + CSV export), supervisor tabulation reviews (avaliacoes:write), sync/backup settings and manual backup trigger, polo management.
- All permission-gated routes return **403** for "Sem permissao" denials, 400 for other errors.

### Frontend (Next 15 App Router, NextAuth credentials)
All navigation pages + login built and verified end-to-end against a live server:
`/login`, `/dashboard`, `/fila` (with status + assign actions and a Tabular link), `/usuarios`, `/equipe`, `/relatorios`, `/configuracoes`, `/tabulacao/[id]` (live FFR scoring).
- Foundation: NextAuth handler `src/app/api/auth/[...nextauth]/route.ts`, root `layout.tsx` + `globals.css` theme, `Providers` (SessionProvider), role-redirect root page.
- shadcn-style UI primitives in `src/components/ui` (button/input/label/card/badge/status-badge/select/textarea).

### E2E
Playwright is configured with an isolated seeded SQLite database (`file:./e2e.db`) and a Chromium project.
- Covered: supervisor login -> dashboard -> fila assignment, tabulation save -> status finalization, XLSX browser import -> confirm -> fila visibility, and fiscal/monitor role-scoped navigation.

### Render.com
Render Blueprint support is configured in `render.yaml` for a Node Web Service with `/api/health` health checks, generated `NEXTAUTH_SECRET`, required `NEXTAUTH_URL`, and free-tier ephemeral SQLite defaults. `README.md` documents the setup and persistent storage options.

### VPS Contabo
A Docker Compose deployment is available for the Contabo VPS at `13.140.148.134`: app container, Caddy reverse proxy on port 80, persistent SQLite volume at `/data`, and backup volume at `/backups`. This VPS path does not reset the DB by default; seed demo users/OS once with `docker compose exec app npm run db:seed`.

### Roadmap baseado em `ARQUITETURA_FFR_PLANEJAMENTO.md`
O arquivo de arquitetura descreve a direção futura da plataforma, não o que deve ser apresentado como completo hoje.
- Bloco B / Central de Conformidade: dashboard analítico de conformidade, KPIs por período/polo/município/tipo/fiscal, tabela de não conformidades e tendências.
- Mapa geográfico: D3 + GeoJSON/TopoJSON de SP, começando preferencialmente por polos/zonas antes de evoluir para todos os municípios.
- Produção analítica: migrar de SQLite demo para PostgreSQL, com possibilidade futura de PostGIS, views materializadas e Redis/cache.
- Exportação profissional: ExcelJS para relatórios diário/semanal/mensal formatados e Puppeteer para PDF do dashboard.
- Infra corporativa: Docker Compose com app + PostgreSQL + Redis + volume/caminho de rede para backups e exports.

### Conventions for new pages (follow these)
- Page = Server Component: `getCurrentUser()` → `redirect("/login")` if null; guard with `hasPermission(perfil, ...)` → `redirect(defaultRedirect(perfil))`; then call the **service + Prisma repo directly** (no HTTP hop).
- Interactive bits are `"use client"` components that hit the `/api/*` routes, then `router.refresh()`.
- `listOrdens` is typed as scalar `OrdemServico[]` (relations are included at runtime but not in the type).

## Remaining work
No known local implementation items remain. Future product work should start from new requirements.

## Run / verify locally
```
cp .env.example .env            # set NEXTAUTH_SECRET; DATABASE_URL=file:./dev.db
npx prisma db push              # create schema
npm run db:seed                 # seed test users (supervisor/monitor/fiscal @example.com, senha123)
npm run dev                     # custom server.ts (Next + Socket.IO) on PORT (default 3000)
npm run typecheck && npm test
npm run build
npm run test:e2e                # uses seeded prisma/e2e.db unless DATABASE_URL is provided
npm run backup                  # copies sqlite DATABASE_URL to BACKUP_LOCAL_DIR or ConfigSync.caminhoRede
```
Deployment: `render.yaml` is set up for a free-tier ephemeral-SQLite test deploy; storage is driven by `DATABASE_URL` (swap to a persistent disk or Postgres later). See comments in `render.yaml`.
