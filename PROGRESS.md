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
