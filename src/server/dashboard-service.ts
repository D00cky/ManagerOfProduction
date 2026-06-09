import type { EventoLog, OrdemServico, Prisma, StatusOS } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { buildOsScope, type SessionUserScope } from "@/lib/scope";
import { REGIOES_SP } from "@/data/regioes-sp";

export type DashboardLog = {
  id: string;
  evento: EventoLog;
  descricao: string;
  createdAt: Date;
};

export type DashboardFiltros = {
  regiao?: string;
  municipio?: string;
};

export type GeoFacet = {
  regiaoAdministrativa: string | null;
  cidade: string | null;
};

export type DashboardFiscal = {
  id: string;
  name: string;
  matricula: string;
};

export type DashboardRepository = {
  findOrdens(where: Prisma.OrdemServicoWhereInput): Promise<OrdemServico[]>;
  findRecentLogs(where: Prisma.OrdemServicoWhereInput): Promise<DashboardLog[]>;
  findGeoFacets(where: Prisma.OrdemServicoWhereInput): Promise<GeoFacet[]>;
  findFiscais(ids: string[]): Promise<DashboardFiscal[]>;
};

export type DashboardResumo = {
  metricas: {
    total: number;
    naFila: number;
    emExecucao: number;
    pendentes: number;
    concluidas: number;
    canceladas: number;
    percentualConclusao: number;
  };
  progressoPorFiscal: Array<{
    fiscalId: string;
    name: string;
    matricula: string;
    total: number;
    concluidas: number;
    pendentes: number;
    emExecucao: number;
    percentualConclusao: number;
  }>;
  osParadas: Array<{
    id: string;
    numero: string;
    status: StatusOS;
    diasParada: number;
    fiscalId: string | null;
    poloId: string;
  }>;
  atividades: DashboardLog[];
  filtros: DashboardFiltros;
  opcoesGeograficas: Array<{ regiao: string; municipios: string[] }>;
};

export async function getDashboardResumo(
  repository: DashboardRepository,
  user: SessionUserScope,
  now = new Date(),
  filtros: DashboardFiltros = {}
): Promise<DashboardResumo> {
  const scope = buildOsScope(user);
  const ordensWhere: Prisma.OrdemServicoWhereInput = { ...scope, ...geoWhere(filtros) };
  const [ordens, atividades, facets] = await Promise.all([
    repository.findOrdens(ordensWhere),
    // Recent activity stays on the access scope (not narrowed by the geo filter).
    repository.findRecentLogs(scope),
    // Filter options come from everything in scope, so they don't collapse as the
    // user narrows the filter.
    repository.findGeoFacets(scope)
  ]);

  const progressoBase = calculateProgressoPorFiscal(ordens);
  const fiscais = await repository.findFiscais(progressoBase.map((item) => item.fiscalId));
  const fiscalPorId = new Map(fiscais.map((fiscal) => [fiscal.id, fiscal]));
  const progressoPorFiscal = progressoBase.map((item) => {
    const fiscal = fiscalPorId.get(item.fiscalId);
    return { ...item, name: fiscal?.name ?? item.fiscalId, matricula: fiscal?.matricula ?? "" };
  });

  return {
    metricas: calculateMetricas(ordens),
    progressoPorFiscal,
    osParadas: calculateOsParadas(ordens, now),
    atividades,
    filtros,
    opcoesGeograficas: buildOpcoesGeograficas(facets)
  };
}

function geoWhere(filtros: DashboardFiltros): Prisma.OrdemServicoWhereInput {
  const where: Prisma.OrdemServicoWhereInput = {};
  if (filtros.regiao) where.regiaoAdministrativa = filtros.regiao;
  if (filtros.municipio) where.cidade = filtros.municipio;
  return where;
}

function buildOpcoesGeograficas(facets: GeoFacet[]): DashboardResumo["opcoesGeograficas"] {
  const byRegiao = new Map<string, Set<string>>();
  for (const facet of facets) {
    if (!facet.regiaoAdministrativa) continue;
    const municipios = byRegiao.get(facet.regiaoAdministrativa) ?? new Set<string>();
    if (facet.cidade) municipios.add(facet.cidade);
    byRegiao.set(facet.regiaoAdministrativa, municipios);
  }
  return REGIOES_SP.filter((regiao) => byRegiao.has(regiao)).map((regiao) => ({
    regiao,
    municipios: [...(byRegiao.get(regiao) ?? new Set<string>())].sort((a, b) => a.localeCompare(b, "pt-BR"))
  }));
}

function calculateMetricas(ordens: OrdemServico[]): DashboardResumo["metricas"] {
  const total = ordens.length;
  const naFila = countStatus(ordens, "NaFila");
  const emExecucao = countStatus(ordens, "EmExecucao");
  const pendentes = countStatus(ordens, "Pendente");
  const concluidas = countStatus(ordens, "Concluida");
  const canceladas = countStatus(ordens, "Cancelada");
  const elegiveis = total - canceladas;
  return {
    total,
    naFila,
    emExecucao,
    pendentes,
    concluidas,
    canceladas,
    percentualConclusao: elegiveis > 0 ? concluidas / elegiveis : 0
  };
}

type ProgressoBaseFiscal = {
  fiscalId: string;
  total: number;
  concluidas: number;
  pendentes: number;
  emExecucao: number;
  percentualConclusao: number;
};

function calculateProgressoPorFiscal(ordens: OrdemServico[]): ProgressoBaseFiscal[] {
  const byFiscal = new Map<string, { fiscalId: string; total: number; concluidas: number; pendentes: number; emExecucao: number }>();
  for (const ordem of ordens) {
    if (!ordem.fiscalId) continue;
    const current = byFiscal.get(ordem.fiscalId) ?? {
      fiscalId: ordem.fiscalId,
      total: 0,
      concluidas: 0,
      pendentes: 0,
      emExecucao: 0
    };
    current.total += 1;
    if (ordem.status === "Concluida") current.concluidas += 1;
    if (ordem.status === "Pendente") current.pendentes += 1;
    if (ordem.status === "EmExecucao") current.emExecucao += 1;
    byFiscal.set(ordem.fiscalId, current);
  }

  return [...byFiscal.values()]
    .map((item) => ({
      ...item,
      percentualConclusao: item.total > 0 ? item.concluidas / item.total : 0
    }))
    .sort((a, b) => a.fiscalId.localeCompare(b.fiscalId));
}

function calculateOsParadas(ordens: OrdemServico[], now: Date): DashboardResumo["osParadas"] {
  return ordens
    .filter((ordem) => ordem.status !== "Concluida" && ordem.status !== "Cancelada")
    .map((ordem) => ({
      id: ordem.id,
      numero: ordem.numero,
      status: ordem.status,
      diasParada: differenceInCalendarDays(now, ordem.updatedAt),
      fiscalId: ordem.fiscalId,
      poloId: ordem.poloId
    }))
    .filter((ordem) => ordem.diasParada >= 2)
    .sort((a, b) => b.diasParada - a.diasParada);
}

function countStatus(ordens: OrdemServico[], status: StatusOS) {
  return ordens.filter((ordem) => ordem.status === status).length;
}
