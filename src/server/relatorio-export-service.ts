import type { Conceito, Prisma, StatusOS, TipoServico } from "@prisma/client";
import { endOfISOWeek, endOfMonth, setISOWeek, startOfISOWeek, startOfMonth } from "date-fns";
import {
  chaveObsNaoConforme,
  GRUPO_NAO_EXECUTADO_ID,
  gruposParaOrdem,
  naoExecutadoAplica,
  type FfrGrupo,
  type FfrItem
} from "@/data/grupos-ffr";
import { contarConformidade, iqesPercentual, type RespostasFfr } from "@/lib/ffr";
import { hasPermission } from "@/lib/permissions";
import { buildOsScope, mergeScopeAndGeo, type SessionUserScope } from "@/lib/scope";

export type RelatorioPeriodoTipo = "semanal" | "mensal" | "personalizado";

export type RelatorioExportFiltros = {
  periodoTipo?: RelatorioPeriodoTipo;
  from?: Date;
  to?: Date;
  /** YYYY-MM (período mensal). */
  mes?: string;
  /** YYYY-Www, semana ISO (período semanal). */
  semana?: string;
  regiao?: string;
  /** Id do polo. */
  polo?: string;
  municipio?: string;
  tipoServico?: TipoServico;
  fiscalId?: string;
};

/** Linha de OS (com tabulação opcional) usada para montar o relatório executivo. */
export type OrdemRelatorioRow = {
  id: string;
  numero: string;
  dataFimExecucao: Date | null;
  cidade: string | null;
  regiaoAdministrativa: string | null;
  tipoServico: TipoServico;
  descricaoTss: string | null;
  poloNome: string | null;
  fiscalNome: string | null;
  codigoContrato: string | null;
  descricaoContrato: string | null;
  unidadeExecutante: string | null;
  status: StatusOS;
  tabulacao: {
    respostas: RespostasFfr;
    conceito: Conceito;
    percentual: number;
  } | null;
};

export type RelatorioExportRepository = {
  /** OS no escopo + período (com tabulação, fiscal e polo já resolvidos). */
  listOrdensParaRelatorio(where: Prisma.OrdemServicoWhereInput): Promise<OrdemRelatorioRow[]>;
};

export type RelatorioKpis = {
  totalOS: number;
  inspecionadas: number;
  pendentes: number;
  naoAvaliada: number;
  atende: number;
  naoAtende: number;
  iqes: number;
};

export type SituacaoInspecao = {
  nome: "Atende" | "Não Atende" | "Não Avaliada";
  quantidade: number;
  percentual: number;
};

export type NaoConformidadeResumo = {
  itemId: string;
  criterio: string;
  grupo: string;
  quantidade: number;
  percentualSobreInspecionadas: number;
};

export type NaoConformidadeDetalhe = {
  osId: string;
  numeroOS: string;
  dataFimExecucao: Date | null;
  municipio: string | null;
  polo: string | null;
  regiao: string | null;
  tipoServico: TipoServico;
  fiscalNome: string | null;
  criterio: string;
  observacao: string | null;
  /** `criterio` + ": " + `observacao` quando há observação; senão só o `criterio`. */
  descricaoNaoConformidade: string;
  conceito: Conceito;
  percentual: number;
  contrato: string | null;
  codigoContrato: string | null;
  descricaoContrato: string | null;
  status: StatusOS;
  unidadeExecutante: string | null;
};

export type QuebraAnalitica = {
  chave: string;
  nome: string;
  quantidadeNC: number;
  totalAvaliado: number;
  mediaPercentual: number;
  iqes: number;
};

export type RelatorioExportDataset = {
  periodo: { from: Date; to: Date; label: string };
  filtrosAplicados: Record<string, string | null>;
  kpis: RelatorioKpis;
  situacaoInspecoes: SituacaoInspecao[];
  principaisNaoConformidades: NaoConformidadeResumo[];
  detalhesNaoConformidades: NaoConformidadeDetalhe[];
  quebras: {
    porRegiao: QuebraAnalitica[];
    porPolo: QuebraAnalitica[];
    porMunicipio: QuebraAnalitica[];
    porTipoServico: QuebraAnalitica[];
    porContrato: QuebraAnalitica[];
    porUnidadeExecutante: QuebraAnalitica[];
  };
};

const TOP_NC = 10;
const SEM_REGIAO = "Sem regiao";
const SEM_POLO = "Sem polo";
const SEM_MUNICIPIO = "Sem municipio";
const SEM_CONTRATO = "Sem contrato";
const SEM_UNIDADE = "Sem unidade executante";

const ATENDE: Conceito[] = ["A", "B"];
const NAO_ATENDE: Conceito[] = ["C", "D"];

/** Converte `YYYY-MM` na janela [início, fim] do mês; `{}` para vazio/inválido. */
export function mesParaIntervalo(mes?: string): { from?: Date; to?: Date } {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return {};
  const base = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1);
  if (Number.isNaN(base.getTime())) return {};
  return { from: startOfMonth(base), to: endOfMonth(base) };
}

/**
 * Converte `YYYY-Www` na janela [segunda, domingo] da semana ISO. Escolha: semana
 * ISO 8601 (segunda a domingo), consistente com `<input type="week">` do HTML.
 * Retorna `{}` para formato vazio/inválido.
 */
export function semanaParaIntervalo(semana?: string): { from?: Date; to?: Date } {
  if (!semana || !/^\d{4}-W\d{2}$/.test(semana)) return {};
  const year = Number(semana.slice(0, 4));
  const week = Number(semana.slice(6, 8));
  if (Number.isNaN(year) || Number.isNaN(week) || week < 1 || week > 53) return {};
  // 4 de janeiro está sempre na semana ISO 1; setISOWeek posiciona na semana desejada.
  const base = setISOWeek(new Date(year, 0, 4), week);
  return { from: startOfISOWeek(base), to: endOfISOWeek(base) };
}

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Resolve o período do relatório. Sempre filtramos pela DATA DE FIM DE EXECUÇÃO da OS
 * (`dataFimExecucao`), a data real do serviço. Sem dados suficientes, usa o mês de `now`.
 */
export function resolvePeriodo(
  filtros: RelatorioExportFiltros,
  now: Date = new Date()
): { from: Date; to: Date; label: string } {
  const tipo =
    filtros.periodoTipo ??
    (filtros.mes ? "mensal" : filtros.semana ? "semanal" : filtros.from || filtros.to ? "personalizado" : "mensal");

  let from: Date | undefined;
  let to: Date | undefined;

  if (tipo === "mensal") {
    ({ from, to } = mesParaIntervalo(filtros.mes));
  } else if (tipo === "semanal") {
    ({ from, to } = semanaParaIntervalo(filtros.semana));
    if (!from || !to) {
      from = startOfISOWeek(now);
      to = endOfISOWeek(now);
    }
  } else {
    from = filtros.from;
    to = filtros.to;
  }

  // Fallback final: mês corrente de `now`.
  if (!from) from = startOfMonth(now);
  if (!to) to = endOfMonth(now);

  return { from, to, label: `${formatarData(from)} a ${formatarData(to)}` };
}

/** Aplica o período por `dataFimExecucao` (data real de execução do serviço). */
function aplicarPeriodo(
  where: Prisma.OrdemServicoWhereInput,
  periodo: { from: Date; to: Date }
): Prisma.OrdemServicoWhereInput {
  return { ...where, dataFimExecucao: { gte: periodo.from, lte: periodo.to } };
}

/**
 * Critérios não conformes de uma OS: itens com resposta "0", válidos para pontuação.
 * Mesma exclusão do cálculo FFR: peso <= 0, tipo "texto", "X"/null/"1" ficam de fora;
 * o grupo "Serviço não executado" só conta quando se aplica (`naoExecutadoAplica`).
 */
function naoConformidadesDaOrdem(
  tipoServico: TipoServico,
  descricaoTss: string | null,
  respostas: RespostasFfr
): Array<{ item: FfrItem; grupo: FfrGrupo }> {
  const incluiNaoExecutado = naoExecutadoAplica(respostas);
  const out: Array<{ item: FfrItem; grupo: FfrGrupo }> = [];
  for (const grupo of gruposParaOrdem({ tipoServico, descricaoTss })) {
    if (grupo.id === GRUPO_NAO_EXECUTADO_ID && !incluiNaoExecutado) continue;
    for (const item of grupo.itens) {
      if (item.peso <= 0 || item.tipo === "texto") continue;
      if (respostas[item.id] === "0") out.push({ item, grupo });
    }
  }
  return out;
}

type QuebraAcc = {
  nome: string;
  quantidadeNC: number;
  totalAvaliado: number;
  somaPercentual: number;
  conforme: number;
  naoConforme: number;
};

function novaQuebra(nome: string): QuebraAcc {
  return { nome, quantidadeNC: 0, totalAvaliado: 0, somaPercentual: 0, conforme: 0, naoConforme: 0 };
}

function finalizarQuebras(mapa: Map<string, QuebraAcc>): QuebraAnalitica[] {
  return [...mapa.entries()]
    .map(([chave, acc]) => ({
      chave,
      nome: acc.nome,
      quantidadeNC: acc.quantidadeNC,
      totalAvaliado: acc.totalAvaliado,
      mediaPercentual: acc.totalAvaliado > 0 ? acc.somaPercentual / acc.totalAvaliado : 0,
      iqes: iqesPercentual({ conforme: acc.conforme, naoConforme: acc.naoConforme })
    }))
    .sort((a, b) => b.quantidadeNC - a.quantidadeNC || a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function buildRelatorioExportDataset(
  repository: RelatorioExportRepository,
  user: SessionUserScope,
  filtros: RelatorioExportFiltros = {},
  now: Date = new Date()
): Promise<RelatorioExportDataset> {
  if (!hasPermission(user.perfil, "relatorios:read")) {
    throw new Error("Sem permissao para gerar relatorio");
  }

  const periodo = resolvePeriodo(filtros, now);
  // O escopo de papel sempre vence; geo (região/polo/município) apenas estreita dentro dele.
  const where = aplicarPeriodo(
    mergeScopeAndGeo(buildOsScope(user), {
      regiao: filtros.regiao,
      polo: filtros.polo,
      municipio: filtros.municipio
    }),
    periodo
  );
  if (filtros.tipoServico) where.tipoServico = filtros.tipoServico;
  // fiscalId apenas estreita para supervisor/monitor; nunca relaxa o escopo do fiscal.
  if (filtros.fiscalId && user.perfil !== "fiscal") where.fiscalId = filtros.fiscalId;

  const rows = await repository.listOrdensParaRelatorio(where);

  const inspecionadas = rows.filter((row) => row.tabulacao !== null);
  let atende = 0;
  let naoAtende = 0;
  let naoAvaliada = 0;
  let conformeTotal = 0;
  let naoConformeTotal = 0;

  const rankingMap = new Map<string, NaoConformidadeResumo>();
  const detalhes: NaoConformidadeDetalhe[] = [];
  const porRegiao = new Map<string, QuebraAcc>();
  const porPolo = new Map<string, QuebraAcc>();
  const porMunicipio = new Map<string, QuebraAcc>();
  const porTipoServico = new Map<string, QuebraAcc>();
  const porContrato = new Map<string, QuebraAcc>();
  const porUnidade = new Map<string, QuebraAcc>();

  const acumular = (mapa: Map<string, QuebraAcc>, chave: string, percentual: number, contagem: { conforme: number; naoConforme: number }, qtdNC: number) => {
    const acc = mapa.get(chave) ?? novaQuebra(chave);
    acc.totalAvaliado += 1;
    acc.somaPercentual += percentual;
    acc.conforme += contagem.conforme;
    acc.naoConforme += contagem.naoConforme;
    acc.quantidadeNC += qtdNC;
    mapa.set(chave, acc);
  };

  for (const row of inspecionadas) {
    const tab = row.tabulacao!;
    if (ATENDE.includes(tab.conceito)) atende += 1;
    else if (NAO_ATENDE.includes(tab.conceito)) naoAtende += 1;
    else naoAvaliada += 1;

    const contagem = contarConformidade(
      { tipoServico: row.tipoServico, descricaoTss: row.descricaoTss },
      tab.respostas
    );
    conformeTotal += contagem.conforme;
    naoConformeTotal += contagem.naoConforme;

    const ncs = naoConformidadesDaOrdem(row.tipoServico, row.descricaoTss, tab.respostas);
    const contrato = row.descricaoContrato?.trim() || row.codigoContrato?.trim() || null;

    for (const { item, grupo } of ncs) {
      const atual = rankingMap.get(item.id) ?? {
        itemId: item.id,
        criterio: item.texto,
        grupo: grupo.nome,
        quantidade: 0,
        percentualSobreInspecionadas: 0
      };
      atual.quantidade += 1;
      rankingMap.set(item.id, atual);

      const obsRaw = tab.respostas[chaveObsNaoConforme(item.id)];
      const observacao = typeof obsRaw === "string" && obsRaw.trim() ? obsRaw.trim() : null;
      detalhes.push({
        osId: row.id,
        numeroOS: row.numero,
        dataFimExecucao: row.dataFimExecucao,
        municipio: row.cidade,
        polo: row.poloNome,
        regiao: row.regiaoAdministrativa,
        tipoServico: row.tipoServico,
        fiscalNome: row.fiscalNome,
        criterio: item.texto,
        observacao,
        descricaoNaoConformidade: observacao ? `${item.texto}: ${observacao}` : item.texto,
        conceito: tab.conceito,
        percentual: tab.percentual,
        contrato,
        codigoContrato: row.codigoContrato,
        descricaoContrato: row.descricaoContrato,
        status: row.status,
        unidadeExecutante: row.unidadeExecutante
      });
    }

    const qtdNC = ncs.length;
    acumular(porRegiao, row.regiaoAdministrativa?.trim() || SEM_REGIAO, tab.percentual, contagem, qtdNC);
    acumular(porPolo, row.poloNome?.trim() || SEM_POLO, tab.percentual, contagem, qtdNC);
    acumular(porMunicipio, row.cidade?.trim() || SEM_MUNICIPIO, tab.percentual, contagem, qtdNC);
    acumular(porTipoServico, row.tipoServico, tab.percentual, contagem, qtdNC);
    acumular(porContrato, contrato ?? SEM_CONTRATO, tab.percentual, contagem, qtdNC);
    acumular(porUnidade, row.unidadeExecutante?.trim() || SEM_UNIDADE, tab.percentual, contagem, qtdNC);
  }

  const totalInspecionadas = inspecionadas.length;
  const principaisNaoConformidades = [...rankingMap.values()]
    .map((nc) => ({
      ...nc,
      percentualSobreInspecionadas: totalInspecionadas > 0 ? nc.quantidade / totalInspecionadas : 0
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.criterio.localeCompare(b.criterio, "pt-BR"))
    .slice(0, TOP_NC);

  const kpis: RelatorioKpis = {
    totalOS: rows.length,
    inspecionadas: totalInspecionadas,
    pendentes: rows.length - totalInspecionadas,
    naoAvaliada,
    atende,
    naoAtende,
    iqes: iqesPercentual({ conforme: conformeTotal, naoConforme: naoConformeTotal })
  };

  const situacaoInspecoes: SituacaoInspecao[] = [
    { nome: "Atende", quantidade: atende, percentual: totalInspecionadas > 0 ? atende / totalInspecionadas : 0 },
    { nome: "Não Atende", quantidade: naoAtende, percentual: totalInspecionadas > 0 ? naoAtende / totalInspecionadas : 0 },
    { nome: "Não Avaliada", quantidade: naoAvaliada, percentual: totalInspecionadas > 0 ? naoAvaliada / totalInspecionadas : 0 }
  ];

  return {
    periodo,
    filtrosAplicados: {
      periodo: periodo.label,
      tipoPeriodo: filtros.periodoTipo ?? null,
      regiao: filtros.regiao ?? null,
      polo: filtros.polo ?? null,
      municipio: filtros.municipio ?? null,
      tipoServico: filtros.tipoServico ?? null,
      fiscalId: user.perfil !== "fiscal" ? filtros.fiscalId ?? null : null
    },
    kpis,
    situacaoInspecoes,
    principaisNaoConformidades,
    detalhesNaoConformidades: detalhes,
    quebras: {
      porRegiao: finalizarQuebras(porRegiao),
      porPolo: finalizarQuebras(porPolo),
      porMunicipio: finalizarQuebras(porMunicipio),
      porTipoServico: finalizarQuebras(porTipoServico),
      porContrato: finalizarQuebras(porContrato),
      porUnidadeExecutante: finalizarQuebras(porUnidade)
    }
  };
}
