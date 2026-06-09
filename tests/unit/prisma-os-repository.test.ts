import { rmSync } from "node:fs";
import { PrismaClient, type StatusOS } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaOrdemRepository } from "@/server/prisma-os-repository";

const databasePath = "/tmp/manager-of-production-claim.test.db";
const databaseUrl = `file:${databasePath}`;
rmSync(databasePath, { force: true });
rmSync(`${databasePath}-journal`, { force: true });
const prismaA = new PrismaClient({ datasourceUrl: databaseUrl });
const prismaB = new PrismaClient({ datasourceUrl: databaseUrl });
const repositoryA = createPrismaOrdemRepository(prismaA, async () => undefined);
const repositoryB = createPrismaOrdemRepository(prismaB, async () => undefined);

type OrdemInput = {
  id: string;
  numero: string;
  poloId?: string;
  fiscalId?: string | null;
  status?: StatusOS;
  dataProgramada?: string | null;
  createdAt?: string;
};

async function insertOrdem({
  id,
  numero,
  poloId = "p1",
  fiscalId = null,
  status = "NaFila",
  dataProgramada = null,
  createdAt = "2026-06-01T10:00:00.000Z"
}: OrdemInput) {
  await prismaA.$executeRaw`
    INSERT INTO OrdemServico (id, numero, poloId, fiscalId, status, dataProgramada, createdAt)
    VALUES (${id}, ${numero}, ${poloId}, ${fiscalId}, ${status}, ${dataProgramada}, ${createdAt})
  `;
}

beforeAll(async () => {
  await prismaA.$executeRawUnsafe(`
    CREATE TABLE OrdemServico (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      poloId TEXT NOT NULL,
      fiscalId TEXT,
      status TEXT NOT NULL,
      dataProgramada TEXT,
      createdAt TEXT NOT NULL
    )
  `);
  await prismaA.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
  await prismaB.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
});

beforeEach(async () => {
  await prismaA.$executeRawUnsafe("DELETE FROM OrdemServico");
});

afterAll(async () => {
  await Promise.all([prismaA.$disconnect(), prismaB.$disconnect()]);
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-journal`, { force: true });
});

describe("claimNextAvailable", () => {
  it("claims the oldest scheduled unassigned OS from the requested polo, with unscheduled OS last", async () => {
    await insertOrdem({ id: "unscheduled", numero: "1000", dataProgramada: null, createdAt: "2026-05-01" });
    await insertOrdem({ id: "newer", numero: "1002", dataProgramada: "2026-06-03", createdAt: "2026-05-01" });
    await insertOrdem({ id: "oldest", numero: "1001", dataProgramada: "2026-06-02", createdAt: "2026-06-01" });
    await insertOrdem({ id: "other-polo", numero: "2001", poloId: "p2", dataProgramada: "2026-01-01" });
    await insertOrdem({ id: "assigned", numero: "1003", fiscalId: "f2", dataProgramada: "2026-01-01" });

    const claimed = await repositoryA.claimNextAvailable("p1", "f1");

    expect(claimed).toEqual({
      id: "oldest",
      numero: "1001",
      poloId: "p1",
      fiscalId: "f1"
    });
  });

  it.each(["NaFila", "EmExecucao", "Pendente"] as StatusOS[])(
    "does not claim another OS while the fiscal has open work in status %s",
    async (status) => {
      await insertOrdem({ id: "open", numero: "1001", fiscalId: "f1", status, poloId: "old-polo" });
      await insertOrdem({ id: "available", numero: "1002", poloId: "new-polo" });

      await expect(repositoryA.claimNextAvailable("new-polo", "f1")).resolves.toBeNull();
    }
  );

  it.each(["Concluida", "Cancelada"] as StatusOS[])(
    "allows the next claim when previous work is %s",
    async (status) => {
      await insertOrdem({ id: "closed", numero: "1001", fiscalId: "f1", status });
      await insertOrdem({ id: "available", numero: "1002" });

      await expect(repositoryA.claimNextAvailable("p1", "f1")).resolves.toMatchObject({
        id: "available",
        fiscalId: "f1"
      });
    }
  );

  it("assigns an available OS to only one fiscal under concurrent claims", async () => {
    await insertOrdem({ id: "available", numero: "1001" });

    const results = await Promise.all([
      repositoryA.claimNextAvailable("p1", "f1"),
      repositoryB.claimNextAvailable("p1", "f2")
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const stored = await prismaA.$queryRaw<Array<{ fiscalId: string | null }>>`
      SELECT fiscalId FROM OrdemServico WHERE id = 'available'
    `;
    expect(["f1", "f2"]).toContain(stored[0]?.fiscalId);
  });
});
