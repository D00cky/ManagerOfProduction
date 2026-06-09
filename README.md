# ManagerOfProduction

## Implemented architecture

- PostgreSQL 17 is the only application database and the source of truth.
- Redis is used by the Socket.IO adapter for cross-instance event fan-out. OS state is never stored only in Redis.
- Prisma migrations are committed under `prisma/migrations` and production uses `prisma migrate deploy`.
- Automatic OS claiming uses PostgreSQL row locking with `FOR UPDATE SKIP LOCKED`.
- Queue and open-work access paths have dedicated indexes, including PostgreSQL partial indexes.
- PostgreSQL backups use `pg_dump` custom format.

This architecture supports the planned volume of approximately 150,000 OS/month, but production sizing still requires load tests using realistic import, dashboard, and concurrency patterns.

## Local development

Start PostgreSQL and Redis:

```bash
cp .env.vps.example .env.vps
# Replace all secrets in .env.vps.
docker compose --env-file .env.vps up -d postgres redis
```

Configure `.env` from `.env.example`, then:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` manages an isolated PostgreSQL container on port `55432`, resets only that test database, applies migrations, and seeds demo data.

## Deployment

### Docker Compose / VPS

The main `docker-compose.yml` includes:

- `app`: Next.js and Socket.IO server.
- `postgres`: persistent PostgreSQL 17 database.
- `redis`: persistent Redis 7 service.
- `caddy`: reverse proxy.

Deploy with:

```bash
cp .env.vps.example .env.vps
# Replace all placeholder secrets.
docker compose --env-file .env.vps up -d --build
```

The app waits for PostgreSQL and Redis health checks. `npm run start:vps` applies pending Prisma migrations before starting the server.

### Render

`render.yaml` provisions a persistent PostgreSQL database, a private Render Key Value service, and a paid web service. The pre-deploy command applies Prisma migrations.

Set `NEXTAUTH_URL` and `DEMO_AUTH_PASSWORD` in Render. Keep `DEMO_AUTH_ENABLED=false` for non-demo environments.

## Backups

```bash
npm run backup
```

The backup worker runs `pg_dump --format=custom` and writes a `.dump` file to `ConfigSync.caminhoRede`, or `BACKUP_LOCAL_DIR` when no configured path exists. The runtime image includes `postgresql-client`.

Restore with PostgreSQL tooling, for example:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" /backups/manager-of-production-*.dump
```

## Existing SQLite data

The PostgreSQL baseline migration creates a new PostgreSQL schema; it does not copy an existing SQLite file. The previous repository setup was demo-only. If an environment contains data that must be retained, keep an immutable copy of the SQLite database and perform a reviewed ETL/import before switching traffic.

## Demo conveniences

- `prisma/seed.ts` creates demo users and eight demo OS.
- `Example/demo-os.xlsx` simulates an OS import.
- Demo credentials use password `senha123` unless overridden.

These are test/demo conveniences and are not production analytics or compliance guarantees.

## Future roadmap

- Load tests and capacity tuning using realistic municipality and fiscal concurrency.
- PostgreSQL read replicas or analytical projections if dashboard traffic requires them.
- PostGIS for geographic analysis.
- Materialized views and Redis response caching for measured reporting bottlenecks.
- Production observability, retention policy, restore drills, and high-availability validation.
