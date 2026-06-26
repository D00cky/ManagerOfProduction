import type { OrdemServico, Prisma, Tabulacao } from "@prisma/client";
import { buildOsScope, type SessionUserScope } from "@/lib/scope";
import { hasPermission } from "@/lib/permissions";
import { buildListWhere, type OsListFilters } from "@/server/os-service";
import {
  chaveCampoTexto,
  chaveObsNaoConforme,
  gruposFfr,
  gruposParaOrdem,
  selecionarGrupoEspecificoId,
  type FfrItem,
  type ValorResposta
} from "@/data/grupos-ffr";

type Pessoa = { name: string; matricula: string };

export type OrdemExport = OrdemServico & {
  tabulacao: (Tabulacao & { tabuladoPor: Pessoa | null; alteradoPor: Pessoa | null }) | null;
  fiscal: { name: string | null } | null;
  polo: { nome: string } | null;
};

export type ExportacaoRepository = {
  findOrdensParaExport(where: Prisma.OrdemServicoWhereInput): Promise<OrdemExport[]>;
};

export type ExportSheet = {
  nome: string;
  colunas: string[];
  linhas: (string | number)[][];
};

export type ExportDataset = { sheets: ExportSheet[] };

const SEM_CATEGORIA = { id: "__sem_categoria__", nome: "Sem categoria" };
const nomePorGrupoId = new Map(gruposFfr.map((grupo) => [grupo.id, grupo.nome]));

function juntar(codigo: string | null, descricao: string | null) {
  return [codigo, descricao].filter((parte) => parte && parte.trim().length > 0).join(" — ");
}

function dataBR(value: Date | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "";
}

function endereco(ordem: OrdemServico) {
  return [ordem.enderecoCompleto, ordem.numeroImovel, ordem.complemento]
    .filter((parte) => parte && String(parte).trim().length > 0)
    .join(", ");
}

// Colunas de metadados da OS (cabeçalho importado), na ordem de exibição.
const colunasMetadados: Array<[string, (o: OrdemExport) => string]> = [
  ["nº OS", (o) => o.numero],
  ["Status", (o) => o.status],
  ["Tipo de serviço", (o) => o.tipoServico],
  ["TSS", (o) => juntar(o.codigoTss, o.descricaoTss)],
  ["TSE", (o) => juntar(o.codigoTse, o.descricaoTse)],
  ["Contrato", (o) => juntar(o.codigoContrato, o.descricaoContrato)],
  ["Unidade Executante", (o) => o.unidadeExecutante ?? ""],
  ["PDE", (o) => o.pde ?? ""],
  ["Endereço", (o) => endereco(o)],
  ["Bairro", (o) => o.bairro ?? ""],
  ["Município", (o) => o.cidade ?? ""],
  ["Polo", (o) => o.polo?.nome ?? ""],
  ["Fiscal", (o) => o.fiscal?.name ?? ""],
  ["Data programada", (o) => dataBR(o.dataProgramada)],
  ["Data início", (o) => dataBR(o.dataInicioExecucao)],
  ["Data fim", (o) => dataBR(o.dataFimExecucao)],
  ["Concluída em", (o) => dataBR(o.concluidaEm)]
];

const colunasScore = ["Soma obtida", "Soma possível", "Percentual", "Conceito"];
const colunasAuditoria = ["Tabulado por", "Alterada", "Alterado por", "Motivo da alteração"];

function pessoaLabel(pessoa: { name: string; matricula: string } | null | undefined) {
  return pessoa ? `${pessoa.name} (${pessoa.matricula})` : "";
}

/** Map a stored answer to a human label for the export cell. */
export function mapearResposta(valor: ValorResposta | undefined, item: FfrItem): string {
  if (item.tipo === "texto") return typeof valor === "string" ? valor : "";
  if (valor === "1") return "Conforme";
  if (valor === "0") return "Não conforme";
  if (valor === "X") return "N/A";
  return "";
}

/** Header prefix for the per-criteria "Não conforme" observation column. */
export const PREFIXO_OBS_NAO_CONFORME = "Obs. Não conforme: ";

/**
 * Booleano criteria carry a paired observation column — exceto quando o item tem
 * um `campoTexto` que já cobre "Não conforme" ("0"), pois nesse caso a descrição
 * é guardada na coluna do campoTexto (espelha a supressão da UI). Itens texto não
 * têm coluna de observação.
 */
function temColunaObsNaoConforme(item: FfrItem): boolean {
  return item.tipo !== "texto" && !item.campoTexto?.revelarEm.includes("0");
}

/** Observation a fiscal wrote for a criteria — only when it was marked "Não conforme". */
export function observacaoNaoConforme(
  respostas: Record<string, ValorResposta>,
  item: FfrItem
): string {
  if (!temColunaObsNaoConforme(item) || respostas[item.id] !== "0") return "";
  const obs = respostas[chaveObsNaoConforme(item.id)];
  return typeof obs === "string" ? obs : "";
}

/** Valor do campo de texto condicional (leitura/matrícula/desnível/descrição). */
export function valorCampoTexto(
  respostas: Record<string, ValorResposta>,
  item: FfrItem
): string {
  if (!item.campoTexto) return "";
  const valor = respostas[item.campoTexto.chave ?? chaveCampoTexto(item.id)];
  return typeof valor === "string" ? valor : "";
}

/** Cabeçalhos de coluna gerados por um item (resposta [+ obs] [+ campoTexto]). */
function colunasDoItem(item: FfrItem): string[] {
  const colunas = [item.texto];
  if (temColunaObsNaoConforme(item)) colunas.push(`${PREFIXO_OBS_NAO_CONFORME}${item.texto}`);
  if (item.campoTexto) colunas.push(item.campoTexto.label ?? item.texto);
  return colunas;
}

/** Valores de uma OS para as colunas de um item, na mesma ordem de `colunasDoItem`. */
function valoresDoItem(
  respostas: Record<string, ValorResposta>,
  item: FfrItem
): (string | number)[] {
  const valores: (string | number)[] = [mapearResposta(respostas[item.id], item)];
  if (temColunaObsNaoConforme(item)) valores.push(observacaoNaoConforme(respostas, item));
  if (item.campoTexto) valores.push(valorCampoTexto(respostas, item));
  return valores;
}

/** Excel sheet names: ≤31 chars, no :\/?*[], unique. Returns a sanitized unique name. */
export function sanitizeSheetName(nome: string, usados: Set<string>): string {
  let base = nome.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Planilha";
  let candidato = base;
  let sufixo = 2;
  while (usados.has(candidato)) {
    const tag = `~${sufixo}`;
    candidato = `${base.slice(0, 31 - tag.length)}${tag}`;
    sufixo += 1;
  }
  usados.add(candidato);
  return candidato;
}

export async function buildExportDataset(
  repository: ExportacaoRepository,
  user: SessionUserScope,
  filters: OsListFilters
): Promise<ExportDataset> {
  if (!hasPermission(user.perfil, "fila:read")) {
    throw new Error("Sem permissao para exportar ordens");
  }

  const where = buildListWhere(buildOsScope(user), filters);
  const ordens = await repository.findOrdensParaExport(where);

  // Agrupa cada OS na sua única categoria (grupo específico de critérios).
  const grupos = new Map<string, OrdemExport[]>();
  for (const ordem of ordens) {
    const id = selecionarGrupoEspecificoId(ordem) ?? SEM_CATEGORIA.id;
    const lista = grupos.get(id);
    if (lista) lista.push(ordem);
    else grupos.set(id, [ordem]);
  }

  const usados = new Set<string>();
  const sheets: ExportSheet[] = [];

  for (const [grupoId, ordensDoGrupo] of grupos) {
    const itens = gruposParaOrdem(ordensDoGrupo[0]).flatMap((g) => g.itens);
    // Cada critério booleano ganha, logo após sua coluna de resposta, uma coluna
    // pareada com a observação de "Não conforme" daquele critério.
    const colunas = [
      ...colunasMetadados.map(([label]) => label),
      ...itens.flatMap((item) => colunasDoItem(item)),
      ...colunasScore,
      ...colunasAuditoria
    ];

    const linhas = ordensDoGrupo.map((ordem) => {
      const respostas = (ordem.tabulacao?.respostas ?? {}) as Record<string, ValorResposta>;
      const tab = ordem.tabulacao;
      return [
        ...colunasMetadados.map(([, extrair]) => extrair(ordem)),
        ...itens.flatMap((item) => valoresDoItem(respostas, item)),
        tab ? tab.somaObtida : "",
        tab ? tab.somaPossivel : "",
        tab ? tab.percentual : "",
        tab ? tab.conceito : "",
        tab ? pessoaLabel(tab.tabuladoPor) : "",
        tab ? (tab.alterada ? "Sim" : "Não") : "",
        tab ? pessoaLabel(tab.alteradoPor) : "",
        tab ? tab.motivoAlteracao ?? "" : ""
      ] as (string | number)[];
    });

    const nome = grupoId === SEM_CATEGORIA.id ? SEM_CATEGORIA.nome : nomePorGrupoId.get(grupoId) ?? grupoId;
    sheets.push({ nome: sanitizeSheetName(nome, usados), colunas, linhas });
  }

  return { sheets };
}
