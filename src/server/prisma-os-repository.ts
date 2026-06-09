import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createLogAtividade } from "@/server/log";
import type { LogInput, OrdemRepository, OrdemStatusUpdate } from "@/server/os-service";

type LogWriter = (input: LogInput) => Promise<void>;

export function createPrismaOrdemRepository(
  client: PrismaClient,
  logWriter: LogWriter = createLogAtividade
): OrdemRepository {
  return {
    findMany(where: Prisma.OrdemServicoWhereInput) {
      return client.ordemServico.findMany({
        where,
        orderBy: [{ dataProgramada: "asc" }, { createdAt: "desc" }],
        include: { polo: true, fiscal: true, tabulacao: true }
      });
    },
    async claimNextAvailable(poloId, fiscalId) {
      return client.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`
            SELECT pg_advisory_xact_lock(hashtextextended(${fiscalId}, 0))::text AS "lockResult"
          `
        );
        const claimed = await transaction.$queryRaw<
          Array<{ id: string; numero: string; poloId: string; fiscalId: string }>
        >(Prisma.sql`
          WITH candidate AS (
            SELECT "id"
            FROM "OrdemServico"
            WHERE "poloId" = ${poloId}
              AND "status" = 'NaFila'::"StatusOS"
              AND "fiscalId" IS NULL
              AND NOT EXISTS (
                SELECT 1
                FROM "OrdemServico" AS open_work
                WHERE open_work."fiscalId" = ${fiscalId}
                  AND open_work."status" IN (
                    'NaFila'::"StatusOS",
                    'EmExecucao'::"StatusOS",
                    'Pendente'::"StatusOS"
                  )
              )
            ORDER BY
              "dataProgramada" ASC NULLS LAST,
              "createdAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE "OrdemServico" AS ordem
          SET "fiscalId" = ${fiscalId}
          FROM candidate
          WHERE ordem."id" = candidate."id"
            AND ordem."fiscalId" IS NULL
            AND ordem."status" = 'NaFila'::"StatusOS"
            AND NOT EXISTS (
              SELECT 1
              FROM "OrdemServico" AS open_work
              WHERE open_work."fiscalId" = ${fiscalId}
                AND open_work."status" IN (
                  'NaFila'::"StatusOS",
                  'EmExecucao'::"StatusOS",
                  'Pendente'::"StatusOS"
                )
            )
          RETURNING ordem."id", ordem."numero", ordem."poloId", ordem."fiscalId"
        `);
        return claimed[0] ?? null;
      });
    },
    findById(id: string) {
      return client.ordemServico.findUnique({ where: { id } });
    },
    async hasTabulacao(ordemServicoId: string) {
      // ordemServicoId is @unique; an existence lookup avoids counting.
      const found = await client.tabulacao.findUnique({
        where: { ordemServicoId },
        select: { id: true }
      });
      return found !== null;
    },
    updateStatus(id: string, data: OrdemStatusUpdate) {
      return client.ordemServico.update({ where: { id }, data });
    },
    findFiscalById(id: string) {
      return client.user.findUnique({
        where: { id },
        select: { id: true, perfil: true, poloId: true }
      });
    },
    async hasOpenWork(fiscalId: string, excludeOrdemId?: string) {
      // Existence check stops at the first matching row instead of counting all.
      const found = await client.ordemServico.findFirst({
        where: {
          fiscalId,
          status: { in: ["NaFila", "EmExecucao", "Pendente"] },
          ...(excludeOrdemId ? { id: { not: excludeOrdemId } } : {})
        },
        select: { id: true }
      });
      return found !== null;
    },
    async updateFiscal(id: string, fiscalId: string) {
      try {
        return await client.ordemServico.update({ where: { id }, data: { fiscalId } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new Error("Fiscal ja possui OS aberta");
        }
        throw error;
      }
    },
    async log(input: LogInput) {
      await logWriter(input);
    }
  };
}

export const prismaOrdemRepository = createPrismaOrdemRepository(prisma);
