import type { Prisma, StatusOS } from "@prisma/client";
import { differenceInCalendarDays, startOfDay, startOfMonth } from "date-fns";
import { buildOsScope, type SessionUserScope } from "@/lib/scope";
import { REGIOES_SP } from "@/data/regioes-sp";

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
  regiao: string | null;
};

export type DashboardMonitor = {
  id: string;
  name: string;
  matricula: string;
  regiao: string | null;
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

/** Per-fiscal output within the time window. */
export type FiscalDesempenhoRow = { fiscalId: string; concluidas: number; analisadas: number };

/** Throughput totals over a single fixed window (today / this month). */
export type ProgressoPeriodo = { entradas: number; analisadas: number; concluidas: number };

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
  desempenhoPorFiscal(
    where: Prisma.OrdemServicoWhereInput,
    periodo: DashboardPeriodo
  ): Promise<FiscalDesempenhoRow[]>;
  /** Distinct fiscais who concluded or analyzed at least one OS in the window. */
  contarFiscaisAtivos(
    where: Prisma.OrdemServicoWhereInput,
    periodo: DashboardPeriodo
  ): Promise<number>;
  findGeoFacets(where: Prisma.OrdemServicoWhereInput): Promise<GeoFacet[]>;
  findFiscais(ids: string[]): Promise<DashboardFiscal[]>;
  /** All monitors (with the região each oversees) for the Monitor→Fiscal tree. */
  findMonitores(): Promise<DashboardMonitor[]>;
};

export type DashboardResumo = {
  periodo: DashboardPeriodo;
  funnel: {
    entradas: number;
    analisadas: number;
    concluidas: number;
    percentualConclusao: number;
  };
  /** Progresso fixo de hoje, independente do filtro de período. */
  progressoHoje: ProgressoPeriodo;
  /** Progresso fixo do mês corrente, independente do filtro de período. */
  progressoMes: ProgressoPeriodo;
  porRegiao: Array<{ regiao: string | null; entradas: number; concluidas: number }>;
  fiscaisAtivos: number;
  desempenhoFiscais: Array<{
    fiscalId: string;
    name: string;
    matricula: string;
    concluidas: number;
    analisadas: number;
  }>;
  /** Desempenho organizado em árvore Região → Monitores → Fiscais alocados. */
  arvoreDesempenho: Array<{
    regiao: string | null;
    monitores: Array<{ name: string; matricula: string }>;
    fiscais: Array<{
      fiscalId: string;
      name: string;
      matricula: string;
      concluidas: number;
      analisadas: number;
    }>;
  }>;
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
  // Janelas fixas independentes do filtro: progresso de hoje e do mês corrente.
  const janelaHoje: DashboardPeriodo = { from: startOfDay(now), to: now };
  const janelaMes: DashboardPeriodo = { from: startOfMonth(now), to: now };
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
    desempenhoRows,
    fiscaisAtivos,
    facets,
    progressoHoje,
    progressoMes
  ] = await Promise.all([
    repository.countByStatus(where),
    repository.progressoPorFiscal(where),
    repository.findOsParadas(where, updatedBefore, OS_PARADAS_LIMIT),
    repository.contarEntradas(where, periodo),
    repository.contarConcluidas(where, periodo),
    repository.contarAnalisadas(where, periodo),
    repository.agruparPorRegiao(where, periodo),
    repository.desempenhoPorFiscal(where, periodo),
    repository.contarFiscaisAtivos(where, periodo),
    // Geo filter options stay on the access scope (not narrowed by the geo filter)
    // so they don't collapse as the user narrows.
    repository.findGeoFacets(scope),
    contarProgresso(repository, where, janelaHoje),
    contarProgresso(repository, where, janelaMes)
  ]);

  // Resolve names once for every fiscal referenced by progress or performance.
  const fiscalIds = [
    ...new Set([
      ...progressoBase.map((item) => item.fiscalId),
      ...desempenhoRows.map((item) => item.fiscalId)
    ])
  ];
  const [fiscais, monitores] = await Promise.all([
    repository.findFiscais(fiscalIds),
    repository.findMonitores()
  ]);
  const fiscalPorId = new Map(fiscais.map((fiscal) => [fiscal.id, fiscal]));
  const nomeDe = (id: string) => fiscalPorId.get(id)?.name ?? id;
  const matriculaDe = (id: string) => fiscalPorId.get(id)?.matricula ?? "";

  const progressoPorFiscal = progressoBase
    .map((item) => ({
      ...item,
      name: nomeDe(item.fiscalId),
      matricula: matriculaDe(item.fiscalId),
      percentualConclusao: item.total > 0 ? item.concluidas / item.total : 0
    }))
    .sort((a, b) => a.fiscalId.localeCompare(b.fiscalId));

  const desempenhoFiscais = desempenhoRows
    .map((item) => ({
      ...item,
      name: nomeDe(item.fiscalId),
      matricula: matriculaDe(item.fiscalId)
    }))
    .sort((a, b) => b.concluidas - a.concluidas || b.analisadas - a.analisadas);

  const arvoreDesempenho = buildArvoreDesempenho(desempenhoFiscais, fiscalPorId, monitores);

  return {
    periodo,
    funnel: {
      entradas,
      analisadas,
      concluidas,
      percentualConclusao: entradas > 0 ? concluidas / entradas : 0
    },
    progressoHoje,
    progressoMes,
    porRegiao: mapRegiao(regiaoRows),
    fiscaisAtivos,
    desempenhoFiscais,
    arvoreDesempenho,
    metricas: calculateMetricas(statusCounts),
    progressoPorFiscal,
    osParadas: calculateOsParadas(parariasRows, now),
    filtros: { regiao: filtros.regiao, municipio: filtros.municipio },
    opcoesGeograficas: buildOpcoesGeograficas(facets)
  };
}

function resolvePeriodo(filtros: DashboardFiltros, now: Date): DashboardPeriodo {
  return { from: filtros.from ?? startOfDay(now), to: filtros.to ?? now };
}

/** Throughput totals (entradas/analisadas/concluídas) over one fixed window. */
async function contarProgresso(
  repository: DashboardRepository,
  where: Prisma.OrdemServicoWhereInput,
  periodo: DashboardPeriodo
): Promise<ProgressoPeriodo> {
  const [entradas, analisadas, concluidas] = await Promise.all([
    repository.contarEntradas(where, periodo),
    repository.contarAnalisadas(where, periodo),
    repository.contarConcluidas(where, periodo)
  ]);
  return { entradas, analisadas, concluidas };
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

/**
 * Agrupa o desempenho dos fiscais por região (a região do polo de cada fiscal) e
 * pendura o(s) monitor(es) responsável(is) por aquela região — a árvore
 * Região → Monitores → Fiscais alocados pedida no dashboard.
 */
function buildArvoreDesempenho(
  desempenho: DashboardResumo["desempenhoFiscais"],
  fiscalPorId: Map<string, DashboardFiscal>,
  monitores: DashboardMonitor[]
): DashboardResumo["arvoreDesempenho"] {
  const monitoresPorRegiao = new Map<string | null, Array<{ name: string; matricula: string }>>();
  for (const monitor of monitores) {
    const chave = monitor.regiao ?? null;
    const lista = monitoresPorRegiao.get(chave) ?? [];
    lista.push({ name: monitor.name, matricula: monitor.matricula });
    monitoresPorRegiao.set(chave, lista);
  }

  const fiscaisPorRegiao = new Map<string | null, DashboardResumo["desempenhoFiscais"]>();
  for (const fiscal of desempenho) {
    const chave = fiscalPorId.get(fiscal.fiscalId)?.regiao ?? null;
    const lista = fiscaisPorRegiao.get(chave) ?? [];
    lista.push(fiscal);
    fiscaisPorRegiao.set(chave, lista);
  }

  return [...fiscaisPorRegiao.entries()]
    .map(([regiao, fiscais]) => ({
      regiao,
      monitores: monitoresPorRegiao.get(regiao) ?? [],
      fiscais
    }))
    .sort((a, b) => (a.regiao ?? "").localeCompare(b.regiao ?? "", "pt-BR"));
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
