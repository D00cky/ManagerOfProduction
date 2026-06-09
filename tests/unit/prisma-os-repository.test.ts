import { PrismaClient, type StatusOS } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaOrdemRepository } from "@/server/prisma-os-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

type OrdemInput = {
  id: string;
  numero: string;
  poloId?: string;
  fiscalId?: string | null;
  status?: StatusOS;
  dataProgramada?: Date | null;
  createdAt?: Date;
};

describePostgres("claimNextAvailable on PostgreSQL", () => {
  const prismaA = new PrismaClient({ datasourceUrl: databaseUrl });
  const prismaB = new PrismaClient({ datasourceUrl: databaseUrl });
  const repositoryA = createPrismaOrdemRepository(prismaA, async () => undefined);
  const repositoryB = createPrismaOrdemRepository(prismaB, async () => undefined);

  async function insertOrdem({
    id,
    numero,
    poloId = "p1",
    fiscalId = null,
    status = "NaFila",
    dataProgramada = null,
    createdAt = new Date("2026-06-01T10:00:00.000Z")
  }: OrdemInput) {
    return prismaA.ordemServico.create({
      data: {
        id,
        numero,
        enderecoCompleto: `Rua ${numero}`,
        tipoServico: "Vistoria",
        poloId,
        fiscalId,
        status,
        dataProgramada,
        createdAt
      }
    });
  }

  beforeEach(async () => {
    await prismaA.logAtividade.deleteMany();
    await prismaA.tabulacao.deleteMany();
    await prismaA.ordemServico.deleteMany();
    await prismaA.userPoloAccess.deleteMany();
    await prismaA.user.deleteMany();
    await prismaA.polo.deleteMany();
    await prismaA.polo.createMany({
      data: [
        { id: "p1", nome: "Polo 1", codigo: "P1" },
        { id: "p2", nome: "Polo 2", codigo: "P2" },
        { id: "old-polo", nome: "Polo Antigo", codigo: "OLD" },
        { id: "new-polo", nome: "Polo Novo", codigo: "NEW" }
      ]
    });
    await prismaA.user.createMany({
      data: [
        {
          id: "f1",
          name: "Fiscal 1",
          email: "f1@example.com",
          matricula: "F1",
          passwordHash: "hash",
          perfil: "fiscal",
          poloId: "p1"
        },
        {
          id: "f2",
          name: "Fiscal 2",
          email: "f2@example.com",
          matricula: "F2",
          passwordHash: "hash",
          perfil: "fiscal",
          poloId: "p1"
        }
      ]
    });
  });

  afterAll(async () => {
    await Promise.all([prismaA.$disconnect(), prismaB.$disconnect()]);
  });

  it("claims the oldest scheduled unassigned OS from the requested polo, with unscheduled OS last", async () => {
    await insertOrdem({
      id: "unscheduled",
      numero: "1000",
      dataProgramada: null,
      createdAt: new Date("2026-05-01")
    });
    await insertOrdem({
      id: "newer",
      numero: "1002",
      dataProgramada: new Date("2026-06-03"),
      createdAt: new Date("2026-05-01")
    });
    await insertOrdem({
      id: "oldest",
      numero: "1001",
      dataProgramada: new Date("2026-06-02"),
      createdAt: new Date("2026-06-01")
    });
    await insertOrdem({
      id: "other-polo",
      numero: "2001",
      poloId: "p2",
      dataProgramada: new Date("2026-01-01")
    });
    await insertOrdem({
      id: "assigned",
      numero: "1003",
      fiscalId: "f2",
      dataProgramada: new Date("2026-01-01")
    });

    await expect(repositoryA.claimNextAvailable("p1", "f1")).resolves.toEqual({
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
    const stored = await prismaA.ordemServico.findUnique({
      where: { id: "available" },
      select: { fiscalId: true }
    });
    expect(["f1", "f2"]).toContain(stored?.fiscalId);
  });

  it("assigns only one open OS when the same fiscal refreshes concurrently", async () => {
    await insertOrdem({ id: "available-1", numero: "1001" });
    await insertOrdem({ id: "available-2", numero: "1002" });

    const results = await Promise.all([
      repositoryA.claimNextAvailable("p1", "f1"),
      repositoryB.claimNextAvailable("p1", "f1")
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(
      prismaA.ordemServico.count({
        where: {
          fiscalId: "f1",
          status: { in: ["NaFila", "EmExecucao", "Pendente"] }
        }
      })
    ).resolves.toBe(1);
  });
});
