import { prisma } from "@/lib/prisma";
import type { FiscalRepository } from "@/server/fiscal-service";

export const prismaFiscalRepository: FiscalRepository = {
  async contarPorStatus(fiscalId: string) {
    const rows = await prisma.ordemServico.groupBy({
      by: ["status"],
      where: { fiscalId },
      _count: { _all: true }
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  },
  proximaOrdem(fiscalId: string) {
    return prisma.ordemServico.findFirst({
      where: { fiscalId, status: { in: ["NaFila", "EmExecucao", "Pendente"] } },
      orderBy: [{ dataProgramada: "asc" }, { createdAt: "asc" }],
      select: { id: true, numero: true }
    });
  }
};
