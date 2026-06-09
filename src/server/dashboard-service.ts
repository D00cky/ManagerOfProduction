import type { EventoLog, Prisma, StatusOS } from "@prisma/client";
import { differenceInCalendarDays, startOfDay } from "date-fns";
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
  /** Time window for the throughput funnel/series. Defaults to "today". */
  from?: Date;
  to?: Date;
};

export type DashboardPeriodo = { from: Date; to: Date };

export type GeoFacet = {
  regiaoAdministrativa: string | null;
  cidade: string | null;
};

export type DashboardFiscal = {
  id: string;
  name: string;
  matricula: string;
};

/** One status bucket from a `groupBy(status)` over the current snapshot. */
export type StatusCount = { status: StatusOS; count: number };

/** Pre-aggregated per-fiscal progress (one row per fiscal). */
export type FiscalProgressRow = {
  fiscalId: string;
  total: number;
  concluidas: number;
  pendentes: number;
  emExecucao: number;
};

/** Stalled-OS row (SQL already filtered to non-terminal + older than the cutoff). */
export type OsParadaRow = {
  id: string;
  numero: string;
  status: StatusOS;
  updatedAt: Date;
  fiscalId: string | null;
  poloId: string;
};

/** Throughput roll-up for one hierarchy key (região / polo / município). */
export type HierarquiaLinha = { chave: string | null; entradas: number; concluidas: number };

export type DashboardRepository = {
  /** Current snapshot, not time-windowed: drives the status cards. */
  countByStatus(where: Prisma.OrdemServicoWhereInput): Promise<StatusCount[]>;
  progressoPorFiscal(where: Prisma.OrdemServicoWhereInput): Promise<FiscalProgressRow[]>;
  findOsParadas(
    where: Prisma.OrdemServicoWhereInput,
    updatedBefore: Date,
    limit: number
  ): Promise<OsParadaRow[]>;
  // Time-windowed throughput funnel (scoped).
  contarEntradas(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo): Promise<number>;
  contarConcluidas(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo): Promise<number>;
  contarAnalisadas(where: Prisma.OrdemServicoWhereInput, periodo: DashboardPeriodo): Promise<number>;
  agruparPorRegiao(
    where: Prisma.OrdemServicoWhereInput,
    periodo: DashboardPeriodo
  ): Promise<HierarquiaLinha[]>;
  findRecentLogs(where: Prisma.OrdemServicoWhereInput): Promise<DashboardLog[]>;
  findGeoFacets(where: Prisma.OrdemServicoWhereInput): Promise<GeoFacet[]>;
  findFiscais(ids: string[]): Promise<DashboardFiscal[]>;
};

export type DashboardResumo = {
  periodo: DashboardPeriodo;
  funnel: {
    entradas: number;
    analisadas: number;
    concluidas: number;
    percentualConclusao: number;
  };
  porRegiao: Array<{ regiao: string | null; entradas: number; concluidas: number }>;
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
  filtros: { regiao?: string; municipio?: string };
  opcoesGeograficas: Array<{ regiao: string; municipios: string[] }>;
};

const OS_PARADAS_LIMIT = 100;
const OS_PARADA_DIAS = 2;

export async function getDashboardResumo(
  repository: DashboardRepository,
  user: SessionUserScope,
  now = new Date(),
  filtros: DashboardFiltros = {}
): Promise<DashboardResumo> {
  const scope = buildOsScope(user);
  const where = mergeScopeAndGeo(scope, filtros);
  const periodo = resolvePeriodo(filtros, now);
  // "Parada" cutoff keeps the calendar-day semantics: stalled means the last
  // update was at least OS_PARADA_DIAS calendar days ago.
  const updatedBefore = startOfDay(subDaysCal(now, OS_PARADA_DIAS - 1));

  const [
    statusCounts,
    progressoBase,
    parariasRows,
    entradas,
    concluidas,
    analisadas,
    regiaoRows,
    atividades,
    facets
  ] = await Promise.all([
    repository.countByStatus(where),
    repository.progressoPorFiscal(where),
    repository.findOsParadas(where, updatedBefore, OS_PARADAS_LIMIT),
    repository.contarEntradas(where, periodo),
    repository.contarConcluidas(where, periodo),
    repository.contarAnalisadas(where, periodo),
    repository.agruparPorRegiao(where, periodo),
    // Recent activity and geo filter options stay on the access scope (not narrowed
    // by the geo filter) so they don't collapse as the user narrows.
    repository.findRecentLogs(scope),
    repository.findGeoFacets(scope)
  ]);

  const fiscais = await repository.findFiscais(progressoBase.map((item) => item.fiscalId));
  const fiscalPorId = new Map(fiscais.map((fiscal) => [fiscal.id, fiscal]));
  const progressoPorFiscal = progressoBase
    .map((item) => {
      const fiscal = fiscalPorId.get(item.fiscalId);
      return {
        ...item,
        name: fiscal?.name ?? item.fiscalId,
        matricula: fiscal?.matricula ?? "",
        percentualConclusao: item.total > 0 ? item.concluidas / item.total : 0
      };
    })
    .sort((a, b) => a.fiscalId.localeCompare(b.fiscalId));

  return {
    periodo,
    funnel: {
      entradas,
      analisadas,
      concluidas,
      percentualConclusao: entradas > 0 ? concluidas / entradas : 0
    },
    porRegiao: mapRegiao(regiaoRows),
    metricas: calculateMetricas(statusCounts),
    progressoPorFiscal,
    osParadas: calculateOsParadas(parariasRows, now),
    atividades,
    filtros: { regiao: filtros.regiao, municipio: filtros.municipio },
    opcoesGeograficas: buildOpcoesGeograficas(facets)
  };
}

function resolvePeriodo(filtros: DashboardFiltros, now: Date): DashboardPeriodo {
  return { from: filtros.from ?? startOfDay(now), to: filtros.to ?? now };
}

function subDaysCal(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

/**
 * Combine the role access scope with the dashboard geo filter so the scope always
 * wins. A monitor is restricted to a single região (`{ regiaoAdministrativa: { in } }`);
 * a região filter may only narrow *within* that scope — never escape it — and an
 * out-of-scope região collapses to "nothing".
 */
function mergeScopeAndGeo(
  scope: Prisma.OrdemServicoWhereInput,
  filtros: DashboardFiltros
): Prisma.OrdemServicoWhereInput {
  const where: Prisma.OrdemServicoWhereInput = { ...scope };
  if (filtros.municipio) where.cidade = filtros.municipio;
  if (filtros.regiao) {
    const scoped = scope.regiaoAdministrativa as { in?: string[] } | undefined;
    const allowed = !scoped || (Array.isArray(scoped.in) ? scoped.in.includes(filtros.regiao) : true);
    where.regiaoAdministrativa = allowed ? filtros.regiao : { in: [] };
  }
  return where;
}

function mapRegiao(rows: HierarquiaLinha[]): DashboardResumo["porRegiao"] {
  return rows
    .map((row) => ({ regiao: row.chave, entradas: row.entradas, concluidas: row.concluidas }))
    .sort((a, b) => b.entradas - a.entradas);
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

function calculateMetricas(statusCounts: StatusCount[]): DashboardResumo["metricas"] {
  const byStatus = new Map<StatusOS, number>(statusCounts.map((row) => [row.status, row.count]));
  const get = (status: StatusOS) => byStatus.get(status) ?? 0;
  const concluidas = get("Concluida");
  const canceladas = get("Cancelada");
  const total = [...byStatus.values()].reduce((sum, value) => sum + value, 0);
  const elegiveis = total - canceladas;
  return {
    total,
    naFila: get("NaFila"),
    emExecucao: get("EmExecucao"),
    pendentes: get("Pendente"),
    concluidas,
    canceladas,
    percentualConclusao: elegiveis > 0 ? concluidas / elegiveis : 0
  };
}

function calculateOsParadas(rows: OsParadaRow[], now: Date): DashboardResumo["osParadas"] {
  return rows
    .map((row) => ({
      id: row.id,
      numero: row.numero,
      status: row.status,
      diasParada: differenceInCalendarDays(now, row.updatedAt),
      fiscalId: row.fiscalId,
      poloId: row.poloId
    }))
    .filter((row) => row.diasParada >= OS_PARADA_DIAS)
    .sort((a, b) => b.diasParada - a.diasParada);
}
