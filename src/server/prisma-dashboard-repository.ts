import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DashboardRepository } from "@/server/dashboard-service";

export const prismaDashboardRepository: DashboardRepository = {
  findOrdens(where: Prisma.OrdemServicoWhereInput) {
    return prisma.ordemServico.findMany({ where });
  },
  findRecentLogs(where: Prisma.OrdemServicoWhereInput) {
    return prisma.logAtividade.findMany({
      where: {
        OR: [
          { ordemServico: where },
          { ordemServicoId: null }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, evento: true, descricao: true, createdAt: true }
    });
  },
  findGeoFacets(where: Prisma.OrdemServicoWhereInput) {
    return prisma.ordemServico.findMany({
      where,
      select: { regiaoAdministrativa: true, cidade: true },
      distinct: ["regiaoAdministrativa", "cidade"]
    });
  },
  findFiscais(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, matricula: true }
    });
  }
};
