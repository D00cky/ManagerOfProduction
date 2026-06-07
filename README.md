# ManagerOfProduction

## Local verification

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Operational scripts

```bash
npm run backup
```

The backup worker copies the SQLite database from `DATABASE_URL` to `ConfigSync.caminhoRede`, or to `BACKUP_LOCAL_DIR`/`./backups` when no configured path exists. Automatic runs respect `ConfigSync.autoBackup`; manual sync through `POST /api/configuracoes/sync` is supervisor-only.

## API additions

- `POST /api/tabulacoes/[id]/avaliacoes`: supervisor-only tabulation review with `nota` from 1 to 5 and optional `comentario`.
- `GET /api/relatorios/exportar`: CSV export of the scoped FFR report.
- `POST /api/configuracoes/sync`: supervisor-only manual backup trigger.
- `GET /api/health`: unauthenticated Render health check.

## Render.com deployment

This repository includes a Render Blueprint in `render.yaml` for a Node Web Service. The service runs the custom `server.ts` process, uses `/api/health` for health checks, and seeds an ephemeral SQLite database at runtime for free-tier test deploys.

Required Render setup:

1. Create a Blueprint deploy from this repository.
2. Set `NEXTAUTH_URL` to the public service URL, for example `https://manager-of-production.onrender.com`.
3. Let Render generate `NEXTAUTH_SECRET`.
4. Keep the default `DATABASE_URL=file:./prod.db` only for throwaway/free-tier testing. `npm run start:render` will reset the demo SQLite DB, create the schema, and seed the test users and example OS on startup.
5. For demo-only login without relying on database users, keep `DEMO_AUTH_ENABLED=true` and use `DEMO_AUTH_PASSWORD=senha123`.
6. `RESET_DEMO_DB_ON_START=true` keeps the free-tier deployment clean after Render restarts. Changes made in the app persist only while that instance is running.

Demo OS rows are documented in `Example/demo-os.csv`.

For persistent production data, move `DATABASE_URL` to a persistent disk path such as `file:/var/data/prod.db` on a paid Render service, or migrate Prisma to PostgreSQL and use `prisma migrate deploy`.
