import type { EventoLog, Prisma, StatusOS, TipoServico } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import type { NormalizedImportRow } from "@/lib/importacao";
import type { SessionUserScope } from "@/lib/scope";

export type DuplicateMode = "ignorar" | "atualizar";

export type ImportacaoPolo = { id: string; nome: string; codigo: string; regiao: string | null };
export type ImportacaoFiscal = { id: string; name: string; matricula: string };
export type ImportacaoOrdemExistente = {
  id: string;
  numero: string;
  codigoTss: string | null;
  codigoTse: string | null;
};
/** Open (NaFila/EmExecucao/Pendente) OS ids a fiscal currently holds. */
export type OpenWorkFiscal = { fiscalId: string; ordemIds: string[] };

export type ImportacaoOrdemInput = {
  numero: string;
  enderecoCompleto: string;
  numeroImovel?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  regiaoAdministrativa?: string | null;
  tipoServico: TipoServico;
  status: StatusOS;
  poloId: string;
  fiscalId?: string | null;
  unidadeExecutante?: string | null;
  codigoContrato?: string | null;
  descricaoContrato?: string | null;
  codigoTss?: string | null;
  descricaoTss?: string | null;
  codigoTse?: string | null;
  descricaoTse?: string | null;
  pde?: string | null;
  equipe?: string | null;
  observacao?: string | null;
  dataProgramada?: Date | null;
  dataInicioExecucao?: Date | null;
  dataFimExecucao?: Date | null;
};

export type ImportacaoLogInput = {
  evento: EventoLog;
  descricao: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
};

export type ImportacaoRepository = {
  /** All active polos, preloaded once and matched by nome/codigo in memory. */
  listPolos(): Promise<ImportacaoPolo[]>;
  /** Upsert (by derived codigo) any polos that don't exist yet; returns them. */
  ensurePolos(values: string[]): Promise<ImportacaoPolo[]>;
  /** All active fiscais, preloaded once and matched by matrícula/name. */
  listFiscaisAtivos(): Promise<ImportacaoFiscal[]>;
  findOrdensByNumero(numeros: string[]): Promise<ImportacaoOrdemExistente[]>;
  /** Open-work OS ids per fiscal, in one query, for the referenced fiscais. */
  openWorkByFiscal(fiscalIds: string[]): Promise<OpenWorkFiscal[]>;
  /** Bulk-create the new OS (falls back to per-row on a P2002 open-fiscal race). */
  createOrdens(inputs: ImportacaoOrdemInput[]): Promise<void>;
  updateOrdem(id: string, input: ImportacaoOrdemInput): Promise<void>;
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

  // Preload every lookup once instead of querying per row (the import can carry
  // tens of thousands of rows). Polos/fiscais are matched in memory; existing OS
  // and open-work are batched.
  const poloMap = buildPoloMap(await repository.listPolos());
  const fiscalMap = buildFiscalMap(await repository.listFiscaisAtivos());

  // Auto-create any polo (keyed off the Sabesp "unidade executante") that does
  // not exist yet — once, for all distinct missing values.
  const missingPolos = unique(
    rows
      .filter((row) => validateRow(row).length === 0 && row.polo && !poloMap.has(poloKey(row.polo)))
      .map((row) => row.polo as string)
  );
  if (missingPolos.length > 0) {
    for (const polo of await repository.ensurePolos(missingPolos)) addPolo(poloMap, polo);
  }

  // Uma OS só é "duplicada" quando coincide numero + TSS + TSE. A mesma OS com
  // TSS/TSE diferentes é um serviço distinto e deve coexistir, então a chave de
  // deduplicação (aqui e no colapso intra-arquivo abaixo) combina os três.
  const existentes = new Map(
    (await repository.findOrdensByNumero(rows.map((row) => row.numero).filter(Boolean))).map(
      (ordem) => [ordemKey(ordem.numero, ordem.codigoTss, ordem.codigoTse), ordem] as const
    )
  );

  // Pass 1: validate, resolve polo/fiscal, record errors in row order.
  type Preparada = {
    linha: number;
    input: ImportacaoOrdemInput;
    fiscalId: string | null;
    existente: ImportacaoOrdemExistente | null;
  };
  const preparadas: Preparada[] = [];
  const referencedFiscalIds = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const linha = index + 1;
    const errors = validateRow(row);
    if (errors.length > 0) {
      resumo.invalidas += 1;
      resumo.erros.push({ linha, erros: errors });
      continue;
    }

    const polo = row.polo ? poloMap.get(poloKey(row.polo)) : undefined;
    if (!polo) {
      resumo.invalidas += 1;
      resumo.erros.push({ linha, erros: ["polo/unidade executante obrigatorio"] });
      continue;
    }

    const fiscal = row.fiscal ? fiscalMap.get(row.fiscal) : undefined;
    if (fiscal) referencedFiscalIds.add(fiscal.id);

    preparadas.push({
      linha,
      fiscalId: fiscal?.id ?? null,
      existente: existentes.get(ordemKey(row.numero, row.codigoTss, row.codigoTse)) ?? null,
      input: {
        numero: row.numero,
        enderecoCompleto: row.enderecoCompleto,
        numeroImovel: row.numeroImovel ?? null,
        complemento: row.complemento ?? null,
        bairro: row.bairro ?? null,
        cidade: row.cidade ?? null,
        // Região is owned by the polo (denormalized onto the OS for scope/dashboard).
        regiaoAdministrativa: polo.regiao ?? row.regiaoAdministrativa ?? null,
        tipoServico: row.tipoServico,
        status: "NaFila",
        poloId: polo.id,
        fiscalId: null,
        unidadeExecutante: row.unidadeExecutante ?? null,
        codigoContrato: row.codigoContrato ?? null,
        descricaoContrato: row.descricaoContrato ?? null,
        codigoTss: row.codigoTss ?? null,
        descricaoTss: row.descricaoTss ?? null,
        codigoTse: row.codigoTse ?? null,
        descricaoTse: row.descricaoTse ?? null,
        pde: row.pde ?? null,
        equipe: row.equipe ?? null,
        observacao: row.observacao ?? null,
        dataProgramada: row.dataProgramada ?? null,
        dataInicioExecucao: row.dataInicioExecucao ?? null,
        dataFimExecucao: row.dataFimExecucao ?? null
      }
    });
  }

  // Collapse intra-file duplicate OS (mesma numero + TSS + TSE) so each is
  // written once (a "baixa" sheet can repeat the same OS on several rows). Last
  // occurrence wins on "atualizar"; first wins on "ignorar"; collapsed rows are
  // reported as ignoradas. Without this, every occurrence of a not-yet-persisted
  // OS lands in `creates` and createMany self-collides on the unique constraint.
  const porChave = new Map<string, Preparada>();
  for (const prep of preparadas) {
    const chave = ordemKey(prep.input.numero, prep.input.codigoTss, prep.input.codigoTse);
    const previo = porChave.get(chave);
    if (!previo) {
      porChave.set(chave, prep);
    } else {
      resumo.ignoradas += 1;
      if (duplicateMode === "atualizar") porChave.set(chave, prep);
    }
  }
  const unicas = [...porChave.values()].sort((a, b) => a.linha - b.linha);

  // Open work per referenced fiscal, in one query.
  const openWork = new Map(
    (await repository.openWorkByFiscal([...referencedFiscalIds])).map(
      (entry) => [entry.fiscalId, new Set(entry.ordemIds)] as const
    )
  );

  // Pass 2: assign fiscais (≤1 open OS per fiscal, honouring DB open work with
  // exclude-self and assignments already made within this batch) and partition.
  const assignedInBatch = new Set<string>();
  const creates: ImportacaoOrdemInput[] = [];
  const updates: Array<{ id: string; input: ImportacaoOrdemInput }> = [];

  for (const prep of unicas) {
    if (prep.fiscalId) {
      const open = openWork.get(prep.fiscalId);
      const hasOtherOpen = open
        ? [...open].some((id) => id !== prep.existente?.id)
        : false;
      const canAssign = !hasOtherOpen && !assignedInBatch.has(prep.fiscalId);
      if (canAssign) {
        prep.input.fiscalId = prep.fiscalId;
        assignedInBatch.add(prep.fiscalId);
      }
    }

    if (prep.existente && duplicateMode === "ignorar") {
      resumo.ignoradas += 1;
      continue;
    }
    if (prep.existente && duplicateMode === "atualizar") {
      updates.push({ id: prep.existente.id, input: prep.input });
      resumo.atualizadas += 1;
      continue;
    }
    creates.push(prep.input);
    resumo.criadas += 1;
  }

  if (creates.length > 0) await repository.createOrdens(creates);
  // Update in parallel chunks instead of one sequential round-trip per row —
  // the dominant cost on update-heavy ("baixa") imports.
  const CHUNK = 25;
  for (let i = 0; i < updates.length; i += CHUNK) {
    await Promise.all(updates.slice(i, i + CHUNK).map((u) => repository.updateOrdem(u.id, u.input)));
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

// Chave de duplicidade de uma OS: mesma numero + TSS + TSE. Codigos ausentes
// normalizam para "" para que dois registros sem TSS/TSE colapsem entre si.
function ordemKey(
  numero: string,
  codigoTss: string | null | undefined,
  codigoTse: string | null | undefined
) {
  return `${numero} ${codigoTss ?? ""} ${codigoTse ?? ""}`;
}

function validateRow(row: NormalizedImportRow) {
  const errors: string[] = [];
  if (!row.numero) errors.push("numero_os obrigatorio");
  if (!row.enderecoCompleto) errors.push("endereco_completo obrigatorio");
  return errors;
}

function poloKey(value: string) {
  return value.trim().toLowerCase();
}

function addPolo(map: Map<string, ImportacaoPolo>, polo: ImportacaoPolo) {
  map.set(poloKey(polo.nome), polo);
  map.set(poloKey(polo.codigo), polo);
}

function buildPoloMap(polos: ImportacaoPolo[]) {
  const map = new Map<string, ImportacaoPolo>();
  for (const polo of polos) addPolo(map, polo);
  return map;
}

function buildFiscalMap(fiscais: ImportacaoFiscal[]) {
  const map = new Map<string, ImportacaoFiscal>();
  for (const fiscal of fiscais) {
    map.set(fiscal.matricula, fiscal);
    map.set(fiscal.name, fiscal);
  }
  return map;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
