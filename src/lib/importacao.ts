import type { TipoServico } from "@prisma/client";
import { parseDate } from "@/lib/utils";
import { resolveRegiao } from "@/data/regioes-sp";
import { categoriaPorCodigo } from "@/data/categorias-servico";

export type ImportColumn =
  | "numero"
  | "enderecoCompleto"
  | "numeroImovel"
  | "complemento"
  | "bairro"
  | "cidade"
  | "tipoServico"
  | "polo"
  | "fiscal"
  | "unidadeExecutante"
  | "codigoContrato"
  | "descricaoContrato"
  | "codigoTss"
  | "descricaoTss"
  | "codigoTse"
  | "descricaoTse"
  | "pde"
  | "equipe"
  | "dataProgramada"
  | "dataInicioExecucao"
  | "dataFimExecucao"
  | "observacao";

export type ImportMapping = Partial<Record<ImportColumn, string>>;

export type RawImportRow = Record<string, unknown>;

export type NormalizedImportRow = {
  numero: string;
  enderecoCompleto: string;
  numeroImovel?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  regiaoAdministrativa?: string;
  // Categoria FFR derivada do código do serviço (TSS/TSE). `null` quando o código
  // não está na tabela fixa — a linha está fora de escopo e não deve ser importada.
  tipoServico: TipoServico | null;
  // `true` quando o serviço não consta na tabela de códigos (descartar na importação).
  foraDeEscopo: boolean;
  polo?: string;
  fiscal?: string;
  unidadeExecutante?: string;
  codigoContrato?: string;
  descricaoContrato?: string;
  codigoTss?: string;
  descricaoTss?: string;
  codigoTse?: string;
  descricaoTse?: string;
  pde?: string;
  equipe?: string;
  dataProgramada?: Date;
  dataInicioExecucao?: Date;
  dataFimExecucao?: Date;
  observacao?: string;
};

export const aliases: Record<ImportColumn, string[]> = {
  numero: ["numero_os", "os", "ordem", "ordem_servico"],
  enderecoCompleto: ["endereco_completo", "endereco", "logradouro"],
  numeroImovel: ["numero"],
  complemento: ["complemento"],
  bairro: ["bairro"],
  cidade: ["cidade", "municipio"],
  tipoServico: ["descricao_tss", "tipo_servico", "servico", "tipo", "familia"],
  polo: ["polo", "base"],
  fiscal: ["fiscal", "matricula", "nome_fiscal", "equipe"],
  unidadeExecutante: ["unidade_executante", "unidade"],
  codigoContrato: ["codigo_contrato", "contrato"],
  descricaoContrato: ["descricao_contrato"],
  codigoTss: ["codigo_tss"],
  descricaoTss: ["descricao_tss"],
  codigoTse: ["codigo_resultado", "codigo_tse"],
  descricaoTse: ["resultado", "descricao_tse"],
  pde: ["pde"],
  equipe: ["equipe"],
  dataProgramada: ["data_programada", "data_agendada", "data_de_planejamento", "programacao"],
  dataInicioExecucao: ["data_inicio_execucao", "data_inicio"],
  dataFimExecucao: ["data_fim_execucao", "data_fim"],
  observacao: ["observacao", "obs", "notas_de_acatamento"]
};

export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function detectMapping(headers: string[]): ImportMapping {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping: ImportMapping = {};
  for (const [column, names] of Object.entries(aliases) as Array<[ImportColumn, string[]]>) {
    for (const name of names) {
      const header = normalized.get(name);
      if (header) {
        mapping[column] = header;
        break;
      }
    }
  }
  return mapping;
}

export function normalizeImportRow(row: RawImportRow, mapping: ImportMapping) {
  const get = (column: ImportColumn) => {
    const header = mapping[column];
    return header ? row[header] : undefined;
  };
  const cidade = optionalString(get("cidade"));
  const unidadeExecutante = optionalString(get("unidadeExecutante"));
  const codigoTss = optionalString(get("codigoTss"));
  const codigoTse = optionalString(get("codigoTse"));
  // Categoria determinística pela tabela fixa de códigos; `null` = fora de escopo.
  const tipoServico = categoriaPorCodigo(codigoTss, codigoTse);
  const normalized: NormalizedImportRow = {
    numero: String(get("numero") ?? "").trim(),
    enderecoCompleto: String(get("enderecoCompleto") ?? "").trim(),
    numeroImovel: optionalString(get("numeroImovel")),
    complemento: optionalString(get("complemento")),
    bairro: optionalString(get("bairro")),
    cidade,
    regiaoAdministrativa: resolveRegiao(cidade) ?? undefined,
    tipoServico,
    foraDeEscopo: tipoServico === null,
    // No explicit Polo column in the Sabesp export — key the polo off the unit.
    polo: optionalString(get("polo")) ?? unidadeExecutante,
    fiscal: optionalString(get("fiscal")),
    unidadeExecutante,
    codigoContrato: optionalString(get("codigoContrato")),
    descricaoContrato: optionalString(get("descricaoContrato")),
    codigoTss,
    descricaoTss: optionalString(get("descricaoTss")),
    codigoTse,
    descricaoTse: optionalString(get("descricaoTse")),
    pde: optionalString(get("pde")),
    equipe: optionalString(get("equipe")),
    dataProgramada: parseDate(get("dataProgramada")),
    dataInicioExecucao: parseDate(get("dataInicioExecucao")),
    dataFimExecucao: parseDate(get("dataFimExecucao")),
    observacao: optionalString(get("observacao"))
  };
  const errors: string[] = [];
  if (!normalized.numero) errors.push("numero_os obrigatorio");
  if (!normalized.enderecoCompleto) errors.push("endereco_completo obrigatorio");
  // Sem contrato/empresa identificável a OS não é importada: ambos os campos vazios.
  if (!normalized.codigoContrato && !normalized.descricaoContrato) errors.push("contrato obrigatorio");
  return { row: normalized, errors };
}

function optionalString(value: unknown) {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : undefined;
}
