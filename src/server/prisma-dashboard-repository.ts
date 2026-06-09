import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DashboardPeriodo,
  DashboardRepository,
  FiscalProgressRow,
  HierarquiaLinha
} from "@/server/dashboard-service";

export const prismaDashboardRepository: DashboardRepository = {
  async countByStatus(where: Prisma.OrdemServicoWhereInput) {
    const rows = await prisma.ordemServico.groupBy({
      by: ["status"],
      where,
      _count: { _all: true }
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  },
  async progressoPorFiscal(where: Prisma.OrdemServicoWhereInput) {
    const rows = await prisma.ordemServico.groupBy({
      by: ["fiscalId", "status"],
      where: { ...where, fiscalId: { not: null } },
      _count: { _all: true }
    });
    const byFiscal = new Map<string, FiscalProgressRow>();
    for (const row of rows) {
      if (!row.fiscalId) continue;
      const cur =
        byFiscal.get(row.fiscalId) ??
        { fiscalId: row.fiscalId, total: 0, concluidas: 0, pendentes: 0, emExecucao: 0 };
      const count = row._count._all;
      cur.total += count;
      if (row.status === "Concluida") cur.concluidas += count;
      if (row.status === "Pendente") cur.pendentes += count;
      if (row.status === "EmExecucao") cur.emExecucao += count;
      byFiscal.set(row.fiscalId, cur);
    }
    return [...byFiscal.values()];
  },
  findOsParadas(where: Prisma.OrdemServicoWhereInput, updatedBefore: Date, limit: number) {
    return prisma.ordemServico.findMany({
      where: {
        ...where,
        status: { notIn: ["Concluida", "Cancelada"] },
        updatedAt: { lt: updatedBefore }
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
      select: { id: true, numero: true, status: true, updatedAt: true, fiscalId: true, poloId: true }
    });
  },
  contarEntradas(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo) {
    return prisma.ordemServico.count({
      where: { ...where, createdAt: { gte: periodo.from, lte: periodo.to } }
    });
  },
  contarConcluidas(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo) {
    return prisma.ordemServico.count({
      where: { ...where, concluidaEm: { gte: periodo.from, lte: periodo.to } }
    });
  },
  contarAnalisadas(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo) {
    return prisma.tabulacao.count({
      where: { ordemServico: where, createdAt: { gte: periodo.from, lte: periodo.to } }
    });
  },
  async agruparPorRegiao(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo) {
    const [entradas, concluidas] = await Promise.all([
      prisma.ordemServico.groupBy({
        by: ["regiaoAdministrativa"],
        where: { ...where, createdAt: { gte: periodo.from, lte: periodo.to } },
        _count: { _all: true }
      }),
      prisma.ordemServico.groupBy({
        by: ["regiaoAdministrativa"],
        where: { ...where, concluidaEm: { gte: periodo.from, lte: periodo.to } },
        _count: { _all: true }
      })
    ]);
    const byRegiao = new Map<string | null, HierarquiaLinha>();
    for (const row of entradas) {
      const cur = byRegiao.get(row.regiaoAdministrativa) ?? { chave: row.regiaoAdministrativa, entradas: 0, concluidas: 0 };
      cur.entradas += row._count._all;
      byRegiao.set(row.regiaoAdministrativa, cur);
    }
    for (const row of concluidas) {
      const cur = byRegiao.get(row.regiaoAdministrativa) ?? { chave: row.regiaoAdministrativa, entradas: 0, concluidas: 0 };
      cur.concluidas += row._count._all;
      byRegiao.set(row.regiaoAdministrativa, cur);
    }
    return [...byRegiao.values()];
  },
  async desempenhoPorFiscal(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo) {
    const [concluidas, analisadas] = await Promise.all([
      prisma.ordemServico.groupBy({
        by: ["fiscalId"],
        where: { ...where, fiscalId: { not: null }, concluidaEm: { gte: periodo.from, lte: periodo.to } },
        _count: { _all: true }
      }),
      prisma.tabulacao.groupBy({
        by: ["fiscalId"],
        where: { ordemServico: where, createdAt: { gte: periodo.from, lte: periodo.to } },
        _count: { _all: true }
      })
    ]);
    const byFiscal = new Map<string, { fiscalId: string; concluidas: number; analisadas: number }>();
    for (const row of concluidas) {
      if (!row.fiscalId) continue;
      const cur = byFiscal.get(row.fiscalId) ?? { fiscalId: row.fiscalId, concluidas: 0, analisadas: 0 };
      cur.concluidas += row._count._all;
      byFiscal.set(row.fiscalId, cur);
    }
    for (const row of analisadas) {
      const cur = byFiscal.get(row.fiscalId) ?? { fiscalId: row.fiscalId, concluidas: 0, analisadas: 0 };
      cur.analisadas += row._count._all;
      byFiscal.set(row.fiscalId, cur);
    }
    return [...byFiscal.values()];
  },
  async contarFiscaisAtivos(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo) {
    const [concluiram, analisaram] = await Promise.all([
      prisma.ordemServico.findMany({
        where: { ...where, fiscalId: { not: null }, concluidaEm: { gte: periodo.from, lte: periodo.to } },
        select: { fiscalId: true },
        distinct: ["fiscalId"]
      }),
      prisma.tabulacao.findMany({
        where: { ordemServico: where, createdAt: { gte: periodo.from, lte: periodo.to } },
        select: { fiscalId: true },
        distinct: ["fiscalId"]
      })
    ]);
    const ativos = new Set<string>();
    for (const row of concluiram) if (row.fiscalId) ativos.add(row.fiscalId);
    for (const row of analisaram) ativos.add(row.fiscalId);
    return ativos.size;
  },
  findRecentLogs(where: Prisma.OrdemServicoWhereInput) {
    return prisma.logAtividade.findMany({
      where: {
        OR: [{ ordemServico: where }, { ordemServicoId: null }]
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
