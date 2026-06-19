import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DashboardPeriodo,
  DashboardRepository,
  FiscalProgressRow,
  HierarquiaLinha
} from "@/server/dashboard-service";

/**
 * "Backlog parado": OS com execução concluída (dataFimExecucao preenchida) que
 * ainda não foi Concluída/Cancelada e está sem movimento (updatedAt) há 2+ dias.
 */
function paradaWhere(
  where: Prisma.OrdemServicoWhereInput,
  updatedBefore: Date
): Prisma.OrdemServicoWhereInput {
  return {
    ...where,
    dataFimExecucao: { not: null },
    status: { notIn: ["Concluida", "Cancelada"] },
    updatedAt: { lt: updatedBefore }
  };
}

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
  async paradasPorPolo(where: Prisma.OrdemServicoWhereInput, updatedBefore: Date) {
    const rows = await prisma.ordemServico.groupBy({
      by: ["regiaoAdministrativa", "poloId"],
      where: paradaWhere(where, updatedBefore),
      _count: { _all: true },
      _min: { updatedAt: true }
    });
    return rows.map((row) => ({
      regiao: row.regiaoAdministrativa,
      poloId: row.poloId,
      total: row._count._all,
      // _min.updatedAt is non-null because the group has at least one matching row.
      oldestUpdatedAt: row._min.updatedAt ?? updatedBefore
    }));
  },
  async paradasDetalhe(
    where: Prisma.OrdemServicoWhereInput,
    updatedBefore: Date,
    pagination: { skip: number; take: number }
  ) {
    const paradas = paradaWhere(where, updatedBefore);
    const [rows, total] = await prisma.$transaction([
      prisma.ordemServico.findMany({
        where: paradas,
        orderBy: { updatedAt: "asc" },
        skip: pagination.skip,
        take: pagination.take,
        select: { id: true, numero: true, status: true, updatedAt: true, dataFimExecucao: true }
      }),
      prisma.ordemServico.count({ where: paradas })
    ]);
    return { rows, total };
  },
  findPolos(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.polo.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } });
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
  async findGeoFacets(where: Prisma.OrdemServicoWhereInput) {
    const rows = await prisma.ordemServico.findMany({
      where,
      select: { regiaoAdministrativa: true, cidade: true, poloId: true, polo: { select: { nome: true } } },
      distinct: ["regiaoAdministrativa", "poloId", "cidade"]
    });
    return rows.map((row) => ({
      regiaoAdministrativa: row.regiaoAdministrativa,
      cidade: row.cidade,
      poloId: row.poloId,
      poloNome: row.polo?.nome ?? null
    }));
  },
  async mesesDisponiveis(where: Prisma.OrdemServicoWhereInput) {
    const rows = await prisma.ordemServico.findMany({ where, select: { createdAt: true } });
    return rows.map((row) => row.createdAt);
  },
  async findFiscais(ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, matricula: true, regiao: true, polo: { select: { regiao: true } } }
    });
    // A região do fiscal vem do polo onde está alocado (com fallback ao campo do usuário).
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      matricula: row.matricula,
      regiao: row.polo?.regiao ?? row.regiao ?? null
    }));
  },
  findMonitores() {
    return prisma.user.findMany({
      where: { perfil: "monitor" },
      select: { id: true, name: true, matricula: true, regiao: true },
      orderBy: { name: "asc" }
    });
  }
};
