import type { Conceito, Prisma, TipoServico } from "@prisma/client";
import { contarConformidade, iqesPercentual, type RespostasFfr } from "@/lib/ffr";
import { hasPermission } from "@/lib/permissions";
import { buildOsScope, mergeScopeAndGeo, type GeoFiltros, type SessionUserScope } from "@/lib/scope";

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

/** Um nível de desempenho (região / polo / contratada) com Tabulações, Média FFR e IQES. */
export type NivelDesempenho = {
  chave: string;
  nome: string;
  total: number;
  mediaPercentual: number;
  iqes: number;
};

/** Árvore Região → Polo → Contratada: cada contratada agrupada sob o polo onde executou. */
export type RelatorioArvore = Array<
  NivelDesempenho & {
    polos: Array<NivelDesempenho & { contratadas: NivelDesempenho[] }>;
  }
>;

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
  porRegiao: NivelDesempenho[];
  porPolo: NivelDesempenho[];
  arvore: RelatorioArvore;
};

const SEM_REGIAO = "Sem regiao";
const SEM_POLO = "Sem polo";
const SEM_CONTRATADA = "Sem contratada";

const conceitos: Conceito[] = ["A", "B", "C", "D", "NaoAvaliado"];

export async function getRelatorio(
  repository: RelatorioRepository,
  user: SessionUserScope,
  filtros: GeoFiltros = {}
): Promise<RelatorioResumo> {
  if (!hasPermission(user.perfil, "relatorios:read")) {
    throw new Error("Sem permissao para ver relatorios");
  }

  // A região/polo filter only narrows within the user's access scope (scope always wins).
  const where = mergeScopeAndGeo(buildOsScope(user), filtros);
  const [overall, conceitoCounts, porFiscalRows, breakdownRows] = await Promise.all([
    repository.overall(where),
    repository.countByConceito(where),
    repository.mediaPorFiscal(where),
    repository.listTabulacoesParaBreakdown(where)
  ]);

  // Resolve fiscal ids to human-readable name + matrícula (the table used to show
  // the raw cuid, which looked like a meaningless hash).
  const fiscais = await repository.findFiscais(porFiscalRows.map((row) => row.fiscalId));
  const fiscalPorId = new Map(fiscais.map((fiscal) => [fiscal.id, fiscal]));

  const { porRegiao, porPolo, arvore } = agruparBreakdown(breakdownRows);

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
    arvore
  };
}

type Acc = { total: number; somaPercentual: number; conforme: number; naoConforme: number };
type Contagem = { conforme: number; naoConforme: number };
type NodoPolo = { nome: string; acc: Acc; contratadas: Map<string, { nome: string; acc: Acc }> };
type NodoRegiao = { nome: string; acc: Acc; polos: Map<string, NodoPolo> };

function novoAcc(): Acc {
  return { total: 0, somaPercentual: 0, conforme: 0, naoConforme: 0 };
}

function somar(acc: Acc, percentual: number, contagem: Contagem) {
  acc.total += 1;
  acc.somaPercentual += percentual;
  acc.conforme += contagem.conforme;
  acc.naoConforme += contagem.naoConforme;
}

function nivel(chave: string, nome: string, acc: Acc): NivelDesempenho {
  return {
    chave,
    nome,
    total: acc.total,
    mediaPercentual: acc.total > 0 ? acc.somaPercentual / acc.total : 0,
    iqes: iqesPercentual({ conforme: acc.conforme, naoConforme: acc.naoConforme })
  };
}

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");

/**
 * Recortes de desempenho. Para cada tabulação contamos os itens "Conforme"/"Não conforme" (IQES)
 * e somamos o percentual FFR; o IQES de um grupo é a razão agregada conforme / (conforme +
 * não-conforme). Além das tabelas planas por região e por polo, monta a árvore
 * Região → Polo → Contratada, agrupando cada contratada sob o polo onde executou os serviços.
 */
function agruparBreakdown(rows: TabulacaoBreakdownRow[]) {
  const regioes = new Map<string, { nome: string; acc: Acc }>();
  const polos = new Map<string, { nome: string; acc: Acc }>();
  const arvore = new Map<string, NodoRegiao>();

  const planar = (mapa: Map<string, { nome: string; acc: Acc }>, chave: string, nome: string, percentual: number, contagem: Contagem) => {
    const item = mapa.get(chave) ?? { nome, acc: novoAcc() };
    somar(item.acc, percentual, contagem);
    mapa.set(chave, item);
  };

  for (const row of rows) {
    const contagem = contarConformidade(
      { tipoServico: row.tipoServico, descricaoTss: row.descricaoTss },
      row.respostas
    );
    const regiao = row.regiaoAdministrativa?.trim() || SEM_REGIAO;
    const polo = row.poloNome?.trim() || row.poloCodigo?.trim() || SEM_POLO;
    const contratada = row.descricaoContrato?.trim() || row.codigoContrato?.trim() || SEM_CONTRATADA;

    planar(regioes, regiao, regiao, row.percentual, contagem);
    planar(polos, polo, polo, row.percentual, contagem);

    const nodoR = arvore.get(regiao) ?? { nome: regiao, acc: novoAcc(), polos: new Map() };
    somar(nodoR.acc, row.percentual, contagem);
    const nodoP = nodoR.polos.get(polo) ?? { nome: polo, acc: novoAcc(), contratadas: new Map() };
    somar(nodoP.acc, row.percentual, contagem);
    const nodoC = nodoP.contratadas.get(contratada) ?? { nome: contratada, acc: novoAcc() };
    somar(nodoC.acc, row.percentual, contagem);
    nodoP.contratadas.set(contratada, nodoC);
    nodoR.polos.set(polo, nodoP);
    arvore.set(regiao, nodoR);
  }

  const porRegiao = [...regioes.entries()].map(([chave, r]) => nivel(chave, r.nome, r.acc)).sort(porNome);
  const porPolo = [...polos.entries()].map(([chave, p]) => nivel(chave, p.nome, p.acc)).sort(porNome);

  const arvoreOut: RelatorioArvore = [...arvore.values()]
    .map((r) => ({
      ...nivel(r.nome, r.nome, r.acc),
      polos: [...r.polos.values()]
        .map((p) => ({
          ...nivel(`${r.nome}__${p.nome}`, p.nome, p.acc),
          contratadas: [...p.contratadas.values()]
            .map((c) => nivel(`${r.nome}__${p.nome}__${c.nome}`, c.nome, c.acc))
            .sort(porNome)
        }))
        .sort(porNome)
    }))
    .sort(porNome);

  return { porRegiao, porPolo, arvore: arvoreOut };
}

function zeroFillConceitos(counts: ConceitoCount[]): Record<Conceito, number> {
  const base = Object.fromEntries(conceitos.map((c) => [c, 0])) as Record<Conceito, number>;
  for (const row of counts) base[row.conceito] = row.count;
  return base;
}

export async function exportRelatorioCsv(
  repository: RelatorioRepository,
  user: SessionUserScope,
  filtros: GeoFiltros = {}
) {
  const relatorio = await getRelatorio(repository, user, filtros);
  const arvoreRows = relatorio.arvore.flatMap((regiao) =>
    regiao.polos.flatMap((polo) =>
      polo.contratadas.map((contratada) => [
        regiao.nome,
        polo.nome,
        contratada.nome,
        String(contratada.total),
        pct(contratada.mediaPercentual),
        pct(contratada.iqes)
      ])
    )
  );
  const rows = [
    ["Fiscal", "Matricula", "Tabulacoes", "Media FFR"],
    ...relatorio.porFiscal.map((item) => [
      item.name,
      item.matricula,
      String(item.total),
      pct(item.mediaPercentual)
    ]),
    [],
    ["Regiao", "Polo", "Contratada", "Tabulacoes", "Media FFR", "IQES"],
    ...arvoreRows
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
