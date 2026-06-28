import type { Prisma, StatusOS } from "@prisma/client";
import { differenceInCalendarDays, startOfDay, startOfMonth } from "date-fns";
import { buildOsScope, mergeScopeAndGeo, type GeoFiltros, type SessionUserScope } from "@/lib/scope";
import { REGIOES_SP } from "@/data/regioes-sp";

export type DashboardFiltros = GeoFiltros & {
  /** 1-based page for the backlog detail list (only used when `polo` is set). */
  page?: number;
  /** Time window for the throughput funnel/series. Defaults to "today". */
  from?: Date;
  to?: Date;
};

/**
 * Dimensão de data do período:
 * - `execucao`: fatia por `dataFimExecucao` (data real do serviço em campo). Usada
 *   pelo seletor de período do dashboard e pelo seletor de mês — consistente com os
 *   relatórios, que também usam a data de fim de execução.
 * - `fluxo`: fatia pelos carimbos de workflow no sistema (`createdAt` para entradas,
 *   `concluidaEm` para concluídas, `createdAt` da tabulação para analisadas). Usada
 *   pelos painéis fixos "Progresso de hoje/mês", que medem o trabalho ao vivo.
 */
export type DashboardPeriodoBase = "execucao" | "fluxo";

export type DashboardPeriodo = { from: Date; to: Date; base: DashboardPeriodoBase };

/** Um mês com serviços executados, identificado por `YYYY-MM` e rotulado como `MM/YY`. */
export type MesDisponivel = { value: string; label: string };

/**
 * Lista os meses presentes nas datas informadas, do mais recente para o mais antigo,
 * no formato `MM/YY` exibido no filtro. As datas vêm da fim de execução das OS.
 */
export function mesesDisponiveisDe(datas: Date[]): MesDisponivel[] {
  const valores = new Set<string>();
  for (const data of datas) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    valores.add(`${ano}-${mes}`);
  }
  return [...valores]
    .sort((a, b) => b.localeCompare(a))
    .map((value) => {
      const [ano, mes] = value.split("-");
      return { value, label: `${mes}/${ano.slice(2)}` };
    });
}

export type GeoFacet = {
  regiaoAdministrativa: string | null;
  poloId: string | null;
  poloNome: string | null;
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

/**
 * Backlog agregado por (região, polo). "Parada" = OS com execução concluída
 * (dataFimExecucao preenchida) que ainda não foi Concluída/Cancelada e está sem
 * movimento há OS_PARADA_DIAS+ dias. A SQL já aplica esse filtro.
 */
export type ParadaPoloRow = {
  regiao: string | null;
  poloId: string;
  total: number;
  /** updatedAt mais antigo do grupo → maior número de dias parada. */
  oldestUpdatedAt: Date;
};

/** Uma OS do backlog, para a lista paginada exibida quando um polo é filtrado. */
export type ParadaDetalheRow = {
  id: string;
  numero: string;
  status: StatusOS;
  updatedAt: Date;
  dataFimExecucao: Date | null;
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
  /** Backlog agrupado por (região, polo): contagem + updatedAt mais antigo. */
  paradasPorPolo(
    where: Prisma.OrdemServicoWhereInput,
    updatedBefore: Date
  ): Promise<ParadaPoloRow[]>;
  /** Página do backlog de um escopo já filtrado (geralmente por polo). */
  paradasDetalhe(
    where: Prisma.OrdemServicoWhereInput,
    updatedBefore: Date,
    pagination: { skip: number; take: number }
  ): Promise<{ rows: ParadaDetalheRow[]; total: number }>;
  /** Nome dos polos por id, para rotular o backlog. */
  findPolos(ids: string[]): Promise<Array<{ id: string; nome: string }>>;
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
  /** `dataFimExecucao` das OS executadas no escopo, para listar os meses disponíveis. */
  mesesDisponiveis(where: Prisma.OrdemServicoWhereInput): Promise<Date[]>;
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
  /**
   * Backlog de OS paradas (2+ dias). Visão padrão: resumo por região → polo.
   * `detalhe` só vem preenchido quando um polo é filtrado — aí lista as OS
   * paginadas com a data de fim de execução.
   */
  paradas: {
    porPolo: Array<{
      regiao: string | null;
      poloId: string;
      poloNome: string;
      total: number;
      maxDias: number;
    }>;
    detalhe: {
      rows: Array<{
        id: string;
        numero: string;
        status: StatusOS;
        dataFimExecucao: Date | null;
        diasParada: number;
      }>;
      total: number;
      page: number;
      pageSize: number;
    } | null;
  };
  filtros: { regiao?: string; polo?: string; municipio?: string };
  /** Meses importados (MM/YY) para o seletor mensal do período. */
  mesesDisponiveis: MesDisponivel[];
  opcoesGeograficas: OpcoesGeograficas;
};

/** Árvore Região → Polo → Municípios derivada das OS reais (facets). */
export type OpcoesGeograficas = Array<{
  regiao: string;
  polos: Array<{ id: string; nome: string; municipios: string[] }>;
}>;

/**
 * Monta as opções do filtro geográfico (Região → Polo → Municípios) a partir dos
 * facets escopados do usuário. Reutilizável por qualquer tela com filtro geo.
 */
export async function getOpcoesGeograficas(
  repository: Pick<DashboardRepository, "findGeoFacets">,
  user: SessionUserScope
): Promise<OpcoesGeograficas> {
  return buildOpcoesGeograficas(await repository.findGeoFacets(buildOsScope(user)));
}

/**
 * Lista os meses (MM/YY) com serviços executados no escopo do usuário, do mais recente ao
 * mais antigo. Reutilizável por qualquer tela com filtro mensal (dashboard e relatórios).
 */
export async function getMesesDisponiveis(
  repository: Pick<DashboardRepository, "mesesDisponiveis">,
  user: SessionUserScope
): Promise<MesDisponivel[]> {
  return mesesDisponiveisDe(await repository.mesesDisponiveis(buildOsScope(user)));
}

const OS_PARADA_DIAS = 2;
/** Page size for the backlog detail list (shown when a polo is filtered). */
export const PARADAS_PAGE_SIZE = 10;

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
  // Medem trabalho ao vivo no sistema, então usam a base "fluxo".
  const janelaHoje: DashboardPeriodo = { from: startOfDay(now), to: now, base: "fluxo" };
  const janelaMes: DashboardPeriodo = { from: startOfMonth(now), to: now, base: "fluxo" };
  // "Parada" cutoff keeps the calendar-day semantics: stalled means the last
  // update was at least OS_PARADA_DIAS calendar days ago.
  const updatedBefore = startOfDay(subDaysCal(now, OS_PARADA_DIAS - 1));
  // The detail list only matters once a polo is picked (`where.poloId` is set).
  const paradaPage = Math.max(1, filtros.page ?? 1);
  const pageSize = PARADAS_PAGE_SIZE;

  const [
    statusCounts,
    progressoBase,
    paradasRows,
    paradasDetalhe,
    entradas,
    concluidas,
    analisadas,
    regiaoRows,
    desempenhoRows,
    fiscaisAtivos,
    facets,
    mesesRaw,
    progressoHoje,
    progressoMes
  ] = await Promise.all([
    repository.countByStatus(where),
    repository.progressoPorFiscal(where),
    repository.paradasPorPolo(where, updatedBefore),
    filtros.polo
      ? repository.paradasDetalhe(where, updatedBefore, {
          skip: (paradaPage - 1) * pageSize,
          take: pageSize
        })
      : Promise.resolve(null),
    repository.contarEntradas(where, periodo),
    repository.contarConcluidas(where, periodo),
    repository.contarAnalisadas(where, periodo),
    repository.agruparPorRegiao(where, periodo),
    repository.desempenhoPorFiscal(where, periodo),
    repository.contarFiscaisAtivos(where, periodo),
    // Geo filter options stay on the access scope (not narrowed by the geo filter)
    // so they don't collapse as the user narrows.
    repository.findGeoFacets(scope),
    // Meses ficam no escopo de acesso (não estreitados pelo filtro geo) para que
    // as opções não colapsem conforme o usuário filtra.
    repository.mesesDisponiveis(scope),
    contarProgresso(repository, where, janelaHoje),
    contarProgresso(repository, where, janelaMes)
  ]);

  // Resolve polo names for the backlog summary labels.
  const polos = await repository.findPolos(paradasRows.map((row) => row.poloId));
  const poloNomePorId = new Map(polos.map((polo) => [polo.id, polo.nome]));
  const paradas = buildParadas(paradasRows, paradasDetalhe, poloNomePorId, paradaPage, pageSize, now);

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
    paradas,
    filtros: { regiao: filtros.regiao, polo: filtros.polo, municipio: filtros.municipio },
    mesesDisponiveis: mesesDisponiveisDe(mesesRaw),
    opcoesGeograficas: buildOpcoesGeograficas(facets)
  };
}

function resolvePeriodo(filtros: DashboardFiltros, now: Date): DashboardPeriodo {
  // O período selecionável (seletor Hoje/7 dias/Mês) é fatiado pela data real de
  // execução do serviço (`dataFimExecucao`), consistente com os relatórios.
  return { from: filtros.from ?? startOfDay(now), to: filtros.to ?? now, base: "execucao" };
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

function buildOpcoesGeograficas(facets: GeoFacet[]): OpcoesGeograficas {
  // Região → polo → municípios, montado a partir das OS reais: só aparecem polos
  // (e municípios) que de fato têm OS naquela região.
  const byRegiao = new Map<string, Map<string, { nome: string; municipios: Set<string> }>>();
  for (const facet of facets) {
    if (!facet.regiaoAdministrativa || !facet.poloId) continue;
    const polos = byRegiao.get(facet.regiaoAdministrativa) ?? new Map();
    const polo = polos.get(facet.poloId) ?? { nome: facet.poloNome ?? facet.poloId, municipios: new Set<string>() };
    if (facet.cidade) polo.municipios.add(facet.cidade);
    polos.set(facet.poloId, polo);
    byRegiao.set(facet.regiaoAdministrativa, polos);
  }
  return REGIOES_SP.filter((regiao) => byRegiao.has(regiao)).map((regiao) => ({
    regiao,
    polos: [...(byRegiao.get(regiao) ?? new Map()).entries()]
      .map(([id, polo]) => ({
        id,
        nome: polo.nome,
        municipios: [...polo.municipios].sort((a, b) => a.localeCompare(b, "pt-BR"))
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
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

function buildParadas(
  porPolo: ParadaPoloRow[],
  detalhe: { rows: ParadaDetalheRow[]; total: number } | null,
  poloNomePorId: Map<string, string>,
  page: number,
  pageSize: number,
  now: Date
): DashboardResumo["paradas"] {
  return {
    // Resumo por polo: contagem + pior caso (OS mais antiga sem movimento).
    porPolo: porPolo
      .map((row) => ({
        regiao: row.regiao,
        poloId: row.poloId,
        poloNome: poloNomePorId.get(row.poloId) ?? row.poloId,
        total: row.total,
        maxDias: differenceInCalendarDays(now, row.oldestUpdatedAt)
      }))
      .sort((a, b) => b.maxDias - a.maxDias || b.total - a.total),
    detalhe: detalhe
      ? {
          rows: detalhe.rows.map((row) => ({
            id: row.id,
            numero: row.numero,
            status: row.status,
            dataFimExecucao: row.dataFimExecucao,
            diasParada: differenceInCalendarDays(now, row.updatedAt)
          })),
          total: detalhe.total,
          page,
          pageSize
        }
      : null
  };
}
