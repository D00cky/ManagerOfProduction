# ManagerOfProduction

## Local verification

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Demo credentials

Use either email or matricula with password `senha123`.

| Perfil | Email | Matricula |
|---|---|---|
| Supervisor | `supervisor@example.com` | `S0001` |
| Monitor | `monitor@example.com` | `M0001` |
| Fiscal | `fiscal@example.com` | `F0001` |

## Demo OS and import/export simulation

- `Example/demo-os.xlsx` can be uploaded on **Importar Excel** to simulate an OS import.
- `Example/demo-os.csv` is the readable reference copy of the same demo records.
- `prisma/seed.ts` seeds 8 demo OS on startup for Render/free-tier demos.
- With `RESET_DEMO_DB_ON_START=true`, Render restarts clean the SQLite database and seed those examples again.
- Changes made in the app persist only while the Render instance remains online.

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

## Architecture roadmap

`ARQUITETURA_FFR_PLANEJAMENTO.md` describes the target architecture for the full FFR platform. Today’s app covers the Gerenciador FFR core and basic reports. Future roadmap items include the Central de Conformidade, D3/GeoJSON map, PostgreSQL analytics, materialized views, Redis/cache, ExcelJS formatted exports, PDF export, and Docker Compose corporate deployment.

## VPS deployment (Contabo)

Current target VPS IP: `13.140.148.134`.

This setup uses Docker Compose with:

- `manager-of-production-app`: Next.js custom server on internal port 3000
- `manager-of-production-caddy`: reverse proxy on public port 80
- persistent SQLite volume mounted at `/data`
- backup volume mounted at `/backups`

### First deploy on the VPS

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo systemctl enable --now docker

git clone <repo-url> ManagerOfProduction
cd ManagerOfProduction
cp .env.vps.example .env.vps
nano .env.vps   # set NEXTAUTH_SECRET to a long random value

docker compose up -d --build
```

Create demo users and OS once on the persistent VPS database:

```bash
docker compose exec app npm run db:seed
```

Open:

```txt
http://13.140.148.134
```

### VPS notes

- The VPS config does **not** reset the database on startup by default.
- `DATABASE_URL=file:/data/prod.db` persists in Docker volume `mop_sqlite_data`.
- Use `DEMO_AUTH_ENABLED=true` only if you want demo login fallback without database users.
- When a domain is available, point it to `13.140.148.134`, update `NEXTAUTH_URL`, and replace the Caddy host from `:80` to the domain for automatic HTTPS.
