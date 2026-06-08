import type { EventoLog, Prisma, StatusOS, TipoServico } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import type { NormalizedImportRow } from "@/lib/importacao";
import type { SessionUserScope } from "@/lib/scope";

export type DuplicateMode = "ignorar" | "atualizar";

export type ImportacaoPolo = { id: string; nome: string; codigo: string };
export type ImportacaoFiscal = { id: string; name: string; matricula: string };
export type ImportacaoOrdemExistente = { id: string; numero: string };

export type ImportacaoOrdemInput = {
  numero: string;
  enderecoCompleto: string;
  bairro?: string | null;
  cidade?: string | null;
  tipoServico: TipoServico;
  status: StatusOS;
  poloId: string;
  fiscalId?: string | null;
  observacao?: string | null;
  dataProgramada?: Date | null;
};

export type ImportacaoLogInput = {
  evento: EventoLog;
  descricao: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
};

export type ImportacaoRepository = {
  findPoloByNameOrCode(value: string): Promise<ImportacaoPolo | null>;
  findFiscalByNameOrMatricula(value: string): Promise<ImportacaoFiscal | null>;
  findOrdemByNumero(numero: string): Promise<ImportacaoOrdemExistente | null>;
  createOrdem(input: ImportacaoOrdemInput): Promise<unknown>;
  updateOrdem(id: string, input: ImportacaoOrdemInput): Promise<unknown>;
  log(input: ImportacaoLogInput): Promise<void>;
};

export type ImportacaoErro = {
  linha: number;
  erros: string[];
};

export type ImportacaoResumo = {
  total: number;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  invalidas: number;
  erros: ImportacaoErro[];
};

export async function confirmarImportacao(
  repository: ImportacaoRepository,
  user: SessionUserScope,
  rows: NormalizedImportRow[],
  duplicateMode: DuplicateMode
): Promise<ImportacaoResumo> {
  if (!hasPermission(user.perfil, "importacao:write")) {
    throw new Error("Sem permissao para importar OS");
  }

  const resumo: ImportacaoResumo = {
    total: rows.length,
    criadas: 0,
    atualizadas: 0,
    ignoradas: 0,
    invalidas: 0,
    erros: []
  };

  for (const [index, row] of rows.entries()) {
    const linha = index + 1;
    const errors = validateRow(row);
    const polo = row.polo ? await repository.findPoloByNameOrCode(row.polo) : null;
    if (!polo) errors.push("polo obrigatorio ou nao encontrado");

    if (errors.length > 0) {
      resumo.invalidas += 1;
      resumo.erros.push({ linha, erros: errors });
      continue;
    }

    if (!polo) throw new Error("Polo nao resolvido apos validacao");
    const resolvedPolo = polo;
    const fiscal = row.fiscal ? await repository.findFiscalByNameOrMatricula(row.fiscal) : null;
    const input: ImportacaoOrdemInput = {
      numero: row.numero,
      enderecoCompleto: row.enderecoCompleto,
      bairro: row.bairro ?? null,
      cidade: row.cidade ?? null,
      tipoServico: row.tipoServico,
      status: "NaFila",
      poloId: resolvedPolo.id,
      fiscalId: fiscal?.id ?? null,
      observacao: row.observacao ?? null,
      dataProgramada: row.dataProgramada ?? null
    };

    const existente = await repository.findOrdemByNumero(row.numero);
    if (existente && duplicateMode === "ignorar") {
      resumo.ignoradas += 1;
      continue;
    }
    if (existente && duplicateMode === "atualizar") {
      await repository.updateOrdem(existente.id, input);
      resumo.atualizadas += 1;
      continue;
    }

    await repository.createOrdem(input);
    resumo.criadas += 1;
  }

  await repository.log({
    evento: "importacao",
    descricao: `Importacao Excel concluida: ${resumo.criadas} criadas, ${resumo.atualizadas} atualizadas, ${resumo.ignoradas} ignoradas, ${resumo.invalidas} invalidas`,
    userId: user.id,
    metadata: {
      criadas: resumo.criadas,
      atualizadas: resumo.atualizadas,
      ignoradas: resumo.ignoradas,
      invalidas: resumo.invalidas,
      total: resumo.total
    }
  });

  return resumo;
}

function validateRow(row: NormalizedImportRow) {
  const errors: string[] = [];
  if (!row.numero) errors.push("numero_os obrigatorio");
  if (!row.enderecoCompleto) errors.push("endereco_completo obrigatorio");
  return errors;
}
