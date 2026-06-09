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
    async findPage(where: Prisma.OrdemServicoWhereInput, pagination: { skip: number; take: number }) {
      const [rows, total] = await client.$transaction([
        client.ordemServico.findMany({
          where,
          orderBy: [{ dataProgramada: "asc" }, { createdAt: "desc" }],
          skip: pagination.skip,
          take: pagination.take
        }),
        client.ordemServico.count({ where })
      ]);
      return { rows, total };
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
    updateFiscal(id: string, fiscalId: string) {
      return client.ordemServico.update({ where: { id }, data: { fiscalId } });
    },
    async assignManyToFiscal(ids, fiscalId, scope) {
      const result = await client.ordemServico.updateMany({
        where: { AND: [scope, { id: { in: ids } }] },
        data: { fiscalId }
      });
      return result.count;
    },
    async deleteOrdens(where) {
      return client.$transaction(async (transaction) => {
        const ordens = await transaction.ordemServico.findMany({ where, select: { id: true } });
        const ids = ordens.map((ordem) => ordem.id);
        if (ids.length === 0) return 0;
        const tabs = await transaction.tabulacao.findMany({
          where: { ordemServicoId: { in: ids } },
          select: { id: true }
        });
        const tabIds = tabs.map((tab) => tab.id);
        // Required FKs default to Restrict: clear avaliações then tabulações
        // before the OS. LogAtividade.ordemServicoId is optional (SetNull).
        if (tabIds.length > 0) {
          await transaction.avaliacao.deleteMany({ where: { tabulacaoId: { in: tabIds } } });
          await transaction.tabulacao.deleteMany({ where: { id: { in: tabIds } } });
        }
        const deleted = await transaction.ordemServico.deleteMany({ where: { id: { in: ids } } });
        return deleted.count;
      });
    },
    async log(input: LogInput) {
      await logWriter(input);
    }
  };
}

export const prismaOrdemRepository = createPrismaOrdemRepository(prisma);
