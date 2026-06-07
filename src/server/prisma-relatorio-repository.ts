import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RelatorioRepository } from "@/server/relatorio-service";

export const prismaRelatorioRepository: RelatorioRepository = {
  findTabulacoes(scope: Prisma.OrdemServicoWhereInput) {
    return prisma.tabulacao.findMany({
      where: { ordemServico: scope },
      select: { conceito: true, percentual: true, fiscalId: true }
    });
  }
};
