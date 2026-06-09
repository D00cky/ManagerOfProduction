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
      const claimed = await client.$queryRaw<
        Array<{ id: string; numero: string; poloId: string; fiscalId: string }>
      >(Prisma.sql`
        UPDATE OrdemServico
        SET fiscalId = ${fiscalId}
        WHERE id = (
          SELECT candidate.id
          FROM OrdemServico AS candidate
          WHERE candidate.poloId = ${poloId}
            AND candidate.status = 'NaFila'
            AND candidate.fiscalId IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM OrdemServico AS open_work
              WHERE open_work.fiscalId = ${fiscalId}
                AND open_work.status IN ('NaFila', 'EmExecucao', 'Pendente')
            )
          ORDER BY
            candidate.dataProgramada IS NULL ASC,
            candidate.dataProgramada ASC,
            candidate.createdAt ASC
          LIMIT 1
        )
          AND fiscalId IS NULL
          AND status = 'NaFila'
          AND NOT EXISTS (
            SELECT 1
            FROM OrdemServico AS open_work
            WHERE open_work.fiscalId = ${fiscalId}
              AND open_work.status IN ('NaFila', 'EmExecucao', 'Pendente')
          )
        RETURNING id, numero, poloId, fiscalId
      `);
      return claimed[0] ?? null;
    },
    findById(id: string) {
      return client.ordemServico.findUnique({ where: { id } });
    },
    async hasTabulacao(ordemServicoId: string) {
      const count = await client.tabulacao.count({ where: { ordemServicoId } });
      return count > 0;
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
    async log(input: LogInput) {
      await logWriter(input);
    }
  };
}

export const prismaOrdemRepository = createPrismaOrdemRepository(prisma);
