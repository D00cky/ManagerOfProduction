# Progress / Handoff

Status as of 2026-06-09.

## Implemented

### Persistence and scale foundation

- Prisma uses PostgreSQL exclusively.
- A committed PostgreSQL baseline migration creates the complete schema and queue indexes.
- Automatic FIFO claiming uses `FOR UPDATE SKIP LOCKED`, preserving one open OS per fiscal under concurrent requests.
- PostgreSQL partial indexes cover available OS by polo and open work by fiscal.
- Redis backs the Socket.IO adapter for event fan-out across app instances; PostgreSQL remains authoritative.
- PostgreSQL backups run through `pg_dump` custom format.

### Deployment

- Docker Compose includes app, PostgreSQL 17, Redis 7, Caddy, persistent database/cache volumes, and health checks.
- Render Blueprint includes a persistent PostgreSQL database, private Render Key Value service, migration pre-deploy command, and Node web service.
- The runtime image includes PostgreSQL client tools for backups.

### Application

- Existing authentication, permission scopes, imports, OS queue, automatic assignment, status transitions, FFR tabulation, dashboard, reports, users, equipe, polos, and configuration flows remain implemented.
- `supervisor` remains the technical enum and is displayed as `Coordenação`.
- **Executive report export (PDF + Excel).** From `/relatorios`, an "Exportação de Relatório" card builds a consolidated report with KPI cards (Total OS, Inspecionadas, Pendentes, Não Avaliada, Atende, Não Atende, IQES), a "Situação das Inspeções" chart, a top-10 ranking of FFR non-conformities (criteria answered `"0"`, excluding `"1"`/`"X"`/null/text/weight-0 items), per-OS detailing, and analytical breakdowns by região, polo, município, tipo de serviço, contrato and unidade executante (contratada fiscalizada). Available as on-screen preview, PDF and Excel.
  - Period filter: **mensal** (`YYYY-MM`), **semanal** (ISO 8601 week, Monday→Sunday, matching `<input type="week">`), or **personalizado** (from/to). The period always filters by `OrdemServico.dataFimExecucao` (real execution date).
  - Access gate: requires `relatorios:read`, so only `monitor` and `supervisor` reach it. Row scope (`buildOsScope`) still applies — monitors are limited to their authorized polos and supervisors see everything; the fiscal-only scope is enforced by `buildOsScope` even though fiscais lack the capability to open the report.
  - Architecture: pure dataset service `relatorio-export-service.ts` (`buildRelatorioExportDataset`) over `prisma-relatorio-export-repository.ts`; file generators `relatorio-excel.ts` (exceljs) and `relatorio-pdf.ts` (jspdf, charts drawn deterministically — no screenshots); routes `GET /api/relatorios/export/{preview,pdf,excel}`.
- **Não Conformidades por Contratada.** A "Por Contratada" view on `/relatorios` extends the executive report: filter by contrato (`codigoContrato`/`descricaoContrato`), unidade executante, conceito FFR and critério de NC (on top of período/região/polo/município/tipo). Shows the contractor's resumo (KPIs + distribuição por conceito A/B/C/D/Não Avaliado), ranking de NC and a **paginated** per-NC detalhamento (one row per OS×critério não conforme). Each NC carries a derived `descricaoNaoConformidade` = critério + ": " + observação (or just the critério when there is no observação). Exports reuse the same Excel/PDF endpoints (Excel detalhamento now includes Descrição NC, Código/Descrição contrato and Status).
  - Reuses the export dataset/extraction (no parallel architecture). New JSON route `GET /api/relatorios/contratadas` (resumo + rankings + agrupamentos + paginated detalhamento + facets de contrato/unidade). Same `relatorios:read` gate and `buildOsScope` row scope.
  - Indexes added (migration `20260628000000_relatorio_contratada_indexes`): `OrdemServico(dataFimExecucao)`, `(codigoContrato)`, `(unidadeExecutante)`.

### Validation

- Unit tests run without external infrastructure; PostgreSQL repository integration tests activate with `TEST_DATABASE_URL`.
- Playwright manages an isolated PostgreSQL test database and covers all existing critical workflows.

## Demo-only

- Seeded users and OS in `prisma/seed.ts`.
- `Example/demo-os.xlsx`.
- Built-in demo authentication when explicitly enabled.

## Migration note

The baseline migration creates PostgreSQL structures but does not copy SQLite data. Any SQLite environment with retained data requires a reviewed ETL before traffic is switched. The prior documented SQLite deployments were demo/test conveniences.

## Future roadmap

- Load testing for approximately 150,000 OS/month across São Paulo municipalities.
- Capacity measurements for imports, queue claims, dashboard aggregation, and concurrent fiscais.
- PostGIS and geographic analytics.
- Materialized analytical views/read models when measured query plans justify them.
- Redis response caching only for identified high-read bottlenecks.
- High availability, monitoring, retention policies, and restore drills.

## Commands

```bash
npm run typecheck
npm test
TEST_DATABASE_URL=postgresql://... npx vitest run tests/unit/prisma-os-repository.test.ts
npm run build
npm run test:e2e
npm run backup
```
