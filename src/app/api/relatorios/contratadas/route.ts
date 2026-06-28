import { NextResponse, type NextRequest } from "next/server";
import {
  buildRelatorioExportDataset,
  getContratadaFacets,
  paginarDetalhamento
} from "@/server/relatorio-export-service";
import {
  prismaRelatorioContratadaFacetsRepository,
  prismaRelatorioExportRepository
} from "@/server/prisma-relatorio-export-repository";
import { filtrosFromSearchParams } from "@/lib/relatorio-export-filtros";
import { getCurrentUser } from "@/server/session";

function parseInt0(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const filtros = filtrosFromSearchParams(params);
  const page = parseInt0(params.get("page"), 1);
  const pageSize = parseInt0(params.get("pageSize"), 20);

  try {
    const [dataset, facets] = await Promise.all([
      buildRelatorioExportDataset(prismaRelatorioExportRepository, user, filtros),
      getContratadaFacets(prismaRelatorioContratadaFacetsRepository, user)
    ]);

    const detalhamento = paginarDetalhamento(dataset.detalhesNaoConformidades, page, pageSize);

    return NextResponse.json({
      data: {
        periodo: dataset.periodo,
        filtrosAplicados: dataset.filtrosAplicados,
        resumo: {
          kpis: dataset.kpis,
          situacaoInspecoes: dataset.situacaoInspecoes,
          distribuicaoConceito: dataset.distribuicaoConceito
        },
        rankingNaoConformidades: dataset.principaisNaoConformidades,
        agrupamentoPorRegiao: dataset.quebras.porRegiao,
        agrupamentoPorMunicipio: dataset.quebras.porMunicipio,
        agrupamentoPorTipoServico: dataset.quebras.porTipoServico,
        agrupamentoPorContrato: dataset.quebras.porContrato,
        agrupamentoPorUnidadeExecutante: dataset.quebras.porUnidadeExecutante,
        detalhamento,
        facets
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar relatorio";
    const status = message.startsWith("Sem permissao") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
