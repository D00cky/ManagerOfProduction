# ManagerOfProduction

## Local verification

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Render.com deployment

This repository includes a Render Blueprint in `render.yaml` for a Node Web Service. The service runs the custom `server.ts` process, uses `/api/health` for health checks, and seeds an ephemeral SQLite database for free-tier test deploys.

Required Render setup:

1. Create a Blueprint deploy from this repository.
2. Set `NEXTAUTH_URL` to the public service URL, for example `https://manager-of-production.onrender.com`.
3. Let Render generate `NEXTAUTH_SECRET`.
4. Keep the default `DATABASE_URL=file:./prod.db` only for throwaway/free-tier testing.

For persistent production data, move `DATABASE_URL` to a persistent disk path such as `file:/var/data/prod.db` on a paid Render service, or migrate Prisma to PostgreSQL and use `prisma migrate deploy`.
