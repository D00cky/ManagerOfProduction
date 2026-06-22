import type { Conceito, Prisma, TipoServico } from "@prisma/client";
import { contarConformidade, iqesPercentual, type RespostasFfr } from "@/lib/ffr";
import { hasPermission } from "@/lib/permissions";
import { buildOsScope, type SessionUserScope } from "@/lib/scope";

export type RelatorioOverall = { total: number; mediaPercentual: number };
export type ConceitoCount = { conceito: Conceito; count: number };
export type FiscalQualidade = { fiscalId: string; total: number; mediaPercentual: number };
export type FiscalInfo = { id: string; name: string; matricula: string };

/** Linha "achatada" de uma tabulação + dados da OS necessários para os recortes geográficos. */
export type TabulacaoBreakdownRow = {
  percentual: number;
  respostas: RespostasFfr;
  tipoServico: TipoServico;
  descricaoTss: string | null;
  regiaoAdministrativa: string | null;
  poloNome: string | null;
  poloCodigo: string | null;
  codigoContrato: string | null;
  descricaoContrato: string | null;
};

export type RelatorioRepository = {
  overall(scope: Prisma.OrdemServicoWhereInput): Promise<RelatorioOverall>;
  countByConceito(scope: Prisma.OrdemServicoWhereInput): Promise<ConceitoCount[]>;
  mediaPorFiscal(scope: Prisma.OrdemServicoWhereInput): Promise<FiscalQualidade[]>;
  findFiscais(ids: string[]): Promise<FiscalInfo[]>;
  listTabulacoesParaBreakdown(scope: Prisma.OrdemServicoWhereInput): Promise<TabulacaoBreakdownRow[]>;
};

/** Entrada de um recorte de desempenho (por região / polo / contratada) com o IQES. */
export type RelatorioBreakdownEntry = {
  chave: string;
  nome: string;
  total: number;
  mediaPercentual: number;
  iqes: number;
};

export type RelatorioContratadaEntry = RelatorioBreakdownEntry & { regiao: string };

export type RelatorioResumo = {
  totalAvaliadas: number;
  mediaPercentual: number;
  conceitos: Record<Conceito, number>;
  porFiscal: Array<{
    fiscalId: string;
    name: string;
    matricula: string;
    total: number;
    mediaPercentual: number;
  }>;
  porRegiao: RelatorioBreakdownEntry[];
  porPolo: RelatorioBreakdownEntry[];
  porContratada: RelatorioContratadaEntry[];
};

const SEM_REGIAO = "Sem regiao";
const SEM_POLO = "Sem polo";
const SEM_CONTRATADA = "Sem contratada";

const conceitos: Conceito[] = ["A", "B", "C", "D", "NaoAvaliado"];

export async function getRelatorio(
  repository: RelatorioRepository,
  user: SessionUserScope
): Promise<RelatorioResumo> {
  if (!hasPermission(user.perfil, "relatorios:read")) {
    throw new Error("Sem permissao para ver relatorios");
  }

  const scope = buildOsScope(user);
  const [overall, conceitoCounts, porFiscalRows, breakdownRows] = await Promise.all([
    repository.overall(scope),
    repository.countByConceito(scope),
    repository.mediaPorFiscal(scope),
    repository.listTabulacoesParaBreakdown(scope)
  ]);

  // Resolve fiscal ids to human-readable name + matrícula (the table used to show
  // the raw cuid, which looked like a meaningless hash).
  const fiscais = await repository.findFiscais(porFiscalRows.map((row) => row.fiscalId));
  const fiscalPorId = new Map(fiscais.map((fiscal) => [fiscal.id, fiscal]));

  const { porRegiao, porPolo, porContratada } = agruparBreakdown(breakdownRows);

  return {
    totalAvaliadas: overall.total,
    mediaPercentual: overall.mediaPercentual,
    conceitos: zeroFillConceitos(conceitoCounts),
    porFiscal: porFiscalRows
      .map((row) => ({
        fiscalId: row.fiscalId,
        name: fiscalPorId.get(row.fiscalId)?.name ?? row.fiscalId,
        matricula: fiscalPorId.get(row.fiscalId)?.matricula ?? "",
        total: row.total,
        mediaPercentual: row.mediaPercentual
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    porRegiao,
    porPolo,
    porContratada
  };
}

type Acumulador = {
  nome: string;
  regiao?: string;
  total: number;
  somaPercentual: number;
  conforme: number;
  naoConforme: number;
};

/**
 * Recortes de desempenho por região, polo e contratada. Para cada tabulação contamos os
 * itens "Conforme"/"Não conforme" (IQES) e somamos o percentual FFR; o IQES de um grupo é a
 * razão agregada conforme / (conforme + não-conforme). A contratada é chaveada por
 * região + nome, para separar a mesma contratada atuando em regiões diferentes.
 */
function agruparBreakdown(rows: TabulacaoBreakdownRow[]) {
  const regioes = new Map<string, Acumulador>();
  const polos = new Map<string, Acumulador>();
  const contratadas = new Map<string, Acumulador>();

  const acumular = (mapa: Map<string, Acumulador>, chave: string, nome: string, row: TabulacaoBreakdownRow, contagem: { conforme: number; naoConforme: number }, regiao?: string) => {
    const atual = mapa.get(chave) ?? { nome, regiao, total: 0, somaPercentual: 0, conforme: 0, naoConforme: 0 };
    atual.total += 1;
    atual.somaPercentual += row.percentual;
    atual.conforme += contagem.conforme;
    atual.naoConforme += contagem.naoConforme;
    mapa.set(chave, atual);
  };

  for (const row of rows) {
    const contagem = contarConformidade(
      { tipoServico: row.tipoServico, descricaoTss: row.descricaoTss },
      row.respostas
    );
    const regiao = row.regiaoAdministrativa?.trim() || SEM_REGIAO;
    const polo = row.poloNome?.trim() || row.poloCodigo?.trim() || SEM_POLO;
    const contratada = row.descricaoContrato?.trim() || row.codigoContrato?.trim() || SEM_CONTRATADA;

    acumular(regioes, regiao, regiao, row, contagem);
    acumular(polos, polo, polo, row, contagem);
    acumular(contratadas, `${regiao}__${contratada}`, contratada, row, contagem, regiao);
  }

  const porContratada: RelatorioContratadaEntry[] = [...contratadas.entries()]
    .map(([chave, acc]) => ({
      ...entrada(chave, acc),
      regiao: acc.regiao ?? SEM_REGIAO
    }))
    .sort((a, b) => a.regiao.localeCompare(b.regiao, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    porRegiao: finalizar(regioes),
    porPolo: finalizar(polos),
    porContratada
  };
}

function entrada(chave: string, acc: Acumulador): RelatorioBreakdownEntry {
  return {
    chave,
    nome: acc.nome,
    total: acc.total,
    mediaPercentual: acc.total > 0 ? acc.somaPercentual / acc.total : 0,
    iqes: iqesPercentual({ conforme: acc.conforme, naoConforme: acc.naoConforme })
  };
}

function finalizar(mapa: Map<string, Acumulador>): RelatorioBreakdownEntry[] {
  return [...mapa.entries()]
    .map(([chave, acc]) => entrada(chave, acc))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function zeroFillConceitos(counts: ConceitoCount[]): Record<Conceito, number> {
  const base = Object.fromEntries(conceitos.map((c) => [c, 0])) as Record<Conceito, number>;
  for (const row of counts) base[row.conceito] = row.count;
  return base;
}

export async function exportRelatorioCsv(repository: RelatorioRepository, user: SessionUserScope) {
  const relatorio = await getRelatorio(repository, user);
  const rows = [
    ["Fiscal", "Matricula", "Tabulacoes", "Media FFR"],
    ...relatorio.porFiscal.map((item) => [
      item.name,
      item.matricula,
      String(item.total),
      pct(item.mediaPercentual)
    ]),
    [],
    ["Regiao", "Contratada", "Tabulacoes", "Media FFR", "IQES"],
    ...relatorio.porContratada.map((item) => [
      item.regiao,
      item.nome,
      String(item.total),
      pct(item.mediaPercentual),
      pct(item.iqes)
    ])
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function pct(ratio: number) {
  return `${(ratio * 100).toFixed(2)}%`;
}

function csvCell(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
