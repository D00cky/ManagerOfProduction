import type { Prisma } from "@prisma/client";
import type { RespostasFfr } from "@/lib/ffr";
import { prisma } from "@/lib/prisma";
import type {
  OrdemRelatorioRow,
  RelatorioContratadaFacetsRepository,
  RelatorioExportRepository
} from "@/server/relatorio-export-service";

export const prismaRelatorioExportRepository: RelatorioExportRepository = {
  async listOrdensParaRelatorio(where: Prisma.OrdemServicoWhereInput): Promise<OrdemRelatorioRow[]> {
    const rows = await prisma.ordemServico.findMany({
      where,
      select: {
        id: true,
        numero: true,
        dataFimExecucao: true,
        cidade: true,
        regiaoAdministrativa: true,
        tipoServico: true,
        descricaoTss: true,
        codigoContrato: true,
        descricaoContrato: true,
        unidadeExecutante: true,
        status: true,
        polo: { select: { nome: true } },
        fiscal: { select: { name: true } },
        tabulacao: { select: { respostas: true, conceito: true, percentual: true } }
      },
      orderBy: [{ dataFimExecucao: "asc" }, { numero: "asc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      numero: row.numero,
      dataFimExecucao: row.dataFimExecucao,
      cidade: row.cidade,
      regiaoAdministrativa: row.regiaoAdministrativa,
      tipoServico: row.tipoServico,
      descricaoTss: row.descricaoTss,
      poloNome: row.polo?.nome ?? null,
      fiscalNome: row.fiscal?.name ?? null,
      codigoContrato: row.codigoContrato,
      descricaoContrato: row.descricaoContrato,
      unidadeExecutante: row.unidadeExecutante,
      status: row.status,
      tabulacao: row.tabulacao
        ? {
            respostas: (row.tabulacao.respostas ?? {}) as RespostasFfr,
            conceito: row.tabulacao.conceito,
            percentual: row.tabulacao.percentual
          }
        : null
    }));
  }
};

export const prismaRelatorioContratadaFacetsRepository: RelatorioContratadaFacetsRepository = {
  async listFacetsContratadas(scope: Prisma.OrdemServicoWhereInput) {
    const [contratos, unidades] = await Promise.all([
      prisma.ordemServico.findMany({
        where: { ...scope, OR: [{ codigoContrato: { not: null } }, { descricaoContrato: { not: null } }] },
        select: { codigoContrato: true, descricaoContrato: true },
        distinct: ["codigoContrato", "descricaoContrato"],
        orderBy: [{ descricaoContrato: "asc" }, { codigoContrato: "asc" }]
      }),
      prisma.ordemServico.findMany({
        where: { ...scope, unidadeExecutante: { not: null } },
        select: { unidadeExecutante: true },
        distinct: ["unidadeExecutante"],
        orderBy: { unidadeExecutante: "asc" }
      })
    ]);
    return {
      contratos: contratos.map((c) => ({ codigo: c.codigoContrato, descricao: c.descricaoContrato })),
      unidades: unidades.map((u) => u.unidadeExecutante).filter((u): u is string => u != null)
    };
  }
};
