import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RelatorioRepository } from "@/server/relatorio-service";

export const prismaRelatorioRepository: RelatorioRepository = {
  async overall(scope: Prisma.OrdemServicoWhereInput) {
    const aggregate = await prisma.tabulacao.aggregate({
      where: { ordemServico: scope },
      _count: { _all: true },
      _avg: { percentual: true }
    });
    return { total: aggregate._count._all, mediaPercentual: aggregate._avg.percentual ?? 0 };
  },
  async countByConceito(scope: Prisma.OrdemServicoWhereInput) {
    const rows = await prisma.tabulacao.groupBy({
      by: ["conceito"],
      where: { ordemServico: scope },
      _count: { _all: true }
    });
    return rows.map((row) => ({ conceito: row.conceito, count: row._count._all }));
  },
  async mediaPorFiscal(scope: Prisma.OrdemServicoWhereInput) {
    const rows = await prisma.tabulacao.groupBy({
      by: ["fiscalId"],
      where: { ordemServico: scope },
      _count: { _all: true },
      _avg: { percentual: true }
    });
    return rows.map((row) => ({
      fiscalId: row.fiscalId,
      total: row._count._all,
      mediaPercentual: row._avg.percentual ?? 0
    }));
  },
  async findFiscais(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, matricula: true }
    });
  }
};
