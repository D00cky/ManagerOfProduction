import type { Prisma } from "@prisma/client";
import type { RespostasFfr } from "@/lib/ffr";
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
  },
  async listTabulacoesParaBreakdown(scope: Prisma.OrdemServicoWhereInput) {
    const rows = await prisma.tabulacao.findMany({
      where: { ordemServico: scope },
      select: {
        percentual: true,
        respostas: true,
        ordemServico: {
          select: {
            regiaoAdministrativa: true,
            codigoContrato: true,
            descricaoContrato: true,
            tipoServico: true,
            descricaoTss: true,
            polo: { select: { nome: true, codigo: true } }
          }
        }
      }
    });
    return rows.map((row) => ({
      percentual: row.percentual,
      respostas: (row.respostas ?? {}) as RespostasFfr,
      tipoServico: row.ordemServico.tipoServico,
      descricaoTss: row.ordemServico.descricaoTss,
      regiaoAdministrativa: row.ordemServico.regiaoAdministrativa,
      poloNome: row.ordemServico.polo?.nome ?? null,
      poloCodigo: row.ordemServico.polo?.codigo ?? null,
      codigoContrato: row.ordemServico.codigoContrato,
      descricaoContrato: row.ordemServico.descricaoContrato
    }));
  },
  async mesesComExecucao(scope: Prisma.OrdemServicoWhereInput) {
    const rows = await prisma.ordemServico.findMany({
      where: { ...scope, dataFimExecucao: { not: null } },
      select: { dataFimExecucao: true }
    });
    return rows.map((row) => row.dataFimExecucao).filter((data): data is Date => data != null);
  }
};
