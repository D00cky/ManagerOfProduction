import type { TipoServico } from "@prisma/client";
import { parseDate } from "@/lib/utils";

export type ImportColumn =
  | "numero"
  | "enderecoCompleto"
  | "bairro"
  | "cidade"
  | "tipoServico"
  | "polo"
  | "fiscal"
  | "dataProgramada"
  | "observacao";

export type ImportMapping = Partial<Record<ImportColumn, string>>;

export type RawImportRow = Record<string, unknown>;

export type NormalizedImportRow = {
  numero: string;
  enderecoCompleto: string;
  bairro?: string;
  cidade?: string;
  tipoServico: TipoServico;
  polo?: string;
  fiscal?: string;
  dataProgramada?: Date;
  observacao?: string;
};

export const aliases: Record<ImportColumn, string[]> = {
  numero: ["numero_os", "numero", "os", "ordem", "ordem_servico"],
  enderecoCompleto: ["endereco_completo", "endereco", "logradouro"],
  bairro: ["bairro"],
  cidade: ["cidade", "municipio"],
  tipoServico: ["tipo_servico", "servico", "tipo"],
  polo: ["polo", "base", "unidade"],
  fiscal: ["fiscal", "matricula", "nome_fiscal"],
  dataProgramada: ["data_programada", "data", "programacao"],
  observacao: ["observacao", "obs"]
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

export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
  return tipoServicoMap[key] ?? "Outros";
}

export function normalizeImportRow(row: RawImportRow, mapping: ImportMapping) {
  const get = (column: ImportColumn) => {
    const header = mapping[column];
    return header ? row[header] : undefined;
  };
  const normalized: NormalizedImportRow = {
    numero: String(get("numero") ?? "").trim(),
    enderecoCompleto: String(get("enderecoCompleto") ?? "").trim(),
    bairro: optionalString(get("bairro")),
    cidade: optionalString(get("cidade")),
    tipoServico: normalizeTipoServico(get("tipoServico")),
    polo: optionalString(get("polo")),
    fiscal: optionalString(get("fiscal")),
    dataProgramada: parseDate(get("dataProgramada")),
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
