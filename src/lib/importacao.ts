import type { TipoServico } from "@prisma/client";
import { parseDate } from "@/lib/utils";
import { resolveRegiao } from "@/data/regioes-sp";

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
  tipoServico: TipoServico;
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
  tipoServico: ["tipo_servico", "servico", "tipo", "familia", "descricao_tss"],
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

const tipoServicoMap: Record<string, TipoServico> = {
  ligacaoagua: "LigacaoAgua",
  ligacao: "LigacaoAgua",
  religacaoagua: "ReligacaoAgua",
  religacao: "ReligacaoAgua",
  corteagua: "CorteAgua",
  corte: "CorteAgua",
  trocahidrometro: "TrocaHidrometro",
  hidrometro: "TrocaHidrometro",
  vistoria: "Vistoria",
  reparorede: "ReparoRede",
  reparo: "ReparoRede",
  outros: "Outros"
};

// Substring fallback for Sabesp service descriptions like "LIGAÇÃO DE ÁGUA S/V".
// Order matters: more specific prefixes (religacao) before broader ones (ligacao).
const tipoServicoKeywords: Array<[string, TipoServico]> = [
  ["religacao", "ReligacaoAgua"],
  ["ligacao", "LigacaoAgua"],
  ["corte", "CorteAgua"],
  ["hidrometro", "TrocaHidrometro"],
  ["vistoria", "Vistoria"],
  ["reparo", "ReparoRede"]
];

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

export function normalizeTipoServico(value: unknown): TipoServico {
  const key = normalizeHeader(String(value || "outros")).replace(/_/g, "");
  const exact = tipoServicoMap[key];
  if (exact) return exact;
  for (const [needle, tipo] of tipoServicoKeywords) {
    if (key.includes(needle)) return tipo;
  }
  return "Outros";
}

export function normalizeImportRow(row: RawImportRow, mapping: ImportMapping) {
  const get = (column: ImportColumn) => {
    const header = mapping[column];
    return header ? row[header] : undefined;
  };
  const cidade = optionalString(get("cidade"));
  const unidadeExecutante = optionalString(get("unidadeExecutante"));
  const normalized: NormalizedImportRow = {
    numero: String(get("numero") ?? "").trim(),
    enderecoCompleto: String(get("enderecoCompleto") ?? "").trim(),
    numeroImovel: optionalString(get("numeroImovel")),
    complemento: optionalString(get("complemento")),
    bairro: optionalString(get("bairro")),
    cidade,
    regiaoAdministrativa: resolveRegiao(cidade) ?? undefined,
    tipoServico: normalizeTipoServico(get("tipoServico")),
    // No explicit Polo column in the Sabesp export — key the polo off the unit.
    polo: optionalString(get("polo")) ?? unidadeExecutante,
    fiscal: optionalString(get("fiscal")),
    unidadeExecutante,
    codigoContrato: optionalString(get("codigoContrato")),
    descricaoContrato: optionalString(get("descricaoContrato")),
    codigoTss: optionalString(get("codigoTss")),
    descricaoTss: optionalString(get("descricaoTss")),
    codigoTse: optionalString(get("codigoTse")),
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
  return { row: normalized, errors };
}

function optionalString(value: unknown) {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : undefined;
}
