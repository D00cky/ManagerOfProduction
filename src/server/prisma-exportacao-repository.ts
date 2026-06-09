import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ExportacaoRepository } from "@/server/exportacao-service";

export const prismaExportacaoRepository: ExportacaoRepository = {
  findOrdensParaExport(where: Prisma.OrdemServicoWhereInput) {
    return prisma.ordemServico.findMany({
      where,
      include: {
        tabulacao: true,
        fiscal: { select: { name: true } },
        polo: { select: { nome: true } }
      },
      orderBy: [{ tipoServico: "asc" }, { numero: "asc" }]
    });
  }
};
