import type { OrdemServico, Prisma, Tabulacao } from "@prisma/client";
import { buildOsScope, type SessionUserScope } from "@/lib/scope";
import { hasPermission } from "@/lib/permissions";
import { buildListWhere, type OsListFilters } from "@/server/os-service";
import {
  gruposFfr,
  gruposParaGrupoEspecifico,
  selecionarGruposEspecificosIds,
  type FfrItem,
  type ValorResposta
} from "@/data/grupos-ffr";

export type OrdemExport = OrdemServico & {
  tabulacao: Tabulacao | null;
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

/** Map a stored answer to a human label for the export cell. */
export function mapearResposta(valor: ValorResposta | undefined, item: FfrItem): string {
  if (item.tipo === "texto") return typeof valor === "string" ? valor : "";
  if (valor === "1") return "Conforme";
  if (valor === "0") return "Não conforme";
  if (valor === "X") return "N/A";
  return "";
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

  // Uma OS pode abranger vários serviços (TSS PAI + TSE): entra em cada planilha
  // correspondente. Aqui as categorias repetidas colapsam para não duplicar a
  // mesma linha numa aba; sem grupo específico, cai em "Sem categoria".
  const grupos = new Map<string, OrdemExport[]>();
  for (const ordem of ordens) {
    const ids = selecionarGruposEspecificosIds(ordem);
    const categorias = ids.length > 0 ? Array.from(new Set(ids)) : [SEM_CATEGORIA.id];
    for (const id of categorias) {
      const lista = grupos.get(id);
      if (lista) lista.push(ordem);
      else grupos.set(id, [ordem]);
    }
  }

  const usados = new Set<string>();
  const sheets: ExportSheet[] = [];

  for (const [grupoId, ordensDoGrupo] of grupos) {
    // Cada planilha mostra apenas os critérios do seu próprio grupo específico.
    const especificoId = grupoId === SEM_CATEGORIA.id ? null : grupoId;
    const itens = gruposParaGrupoEspecifico(especificoId).flatMap((g) => g.itens);
    const colunas = [
      ...colunasMetadados.map(([label]) => label),
      ...itens.map((item) => item.texto),
      ...colunasScore
    ];

    const linhas = ordensDoGrupo.map((ordem) => {
      const respostas = (ordem.tabulacao?.respostas ?? {}) as Record<string, ValorResposta>;
      const tab = ordem.tabulacao;
      return [
        ...colunasMetadados.map(([, extrair]) => extrair(ordem)),
        ...itens.map((item) => mapearResposta(respostas[item.id], item)),
        tab ? tab.somaObtida : "",
        tab ? tab.somaPossivel : "",
        tab ? tab.percentual : "",
        tab ? tab.conceito : ""
      ] as (string | number)[];
    });

    const nome = grupoId === SEM_CATEGORIA.id ? SEM_CATEGORIA.nome : nomePorGrupoId.get(grupoId) ?? grupoId;
    sheets.push({ nome: sanitizeSheetName(nome, usados), colunas, linhas });
  }

  return { sheets };
}
