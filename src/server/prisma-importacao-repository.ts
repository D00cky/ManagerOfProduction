import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createLogAtividade } from "@/server/log";
import type {
  ImportacaoLogInput,
  ImportacaoOrdemInput,
  ImportacaoPolo,
  ImportacaoRepository
} from "@/server/importacao-service";

const poloSelect = { id: true, nome: true, codigo: true, regiao: true } satisfies Prisma.PoloSelect;

// Sabesp unit strings look like "ORMR - DIV MANUT SERV OPE REGISTRO" — use the
// leading token as the polo code, falling back to the full text.
function deriveCodigo(value: string) {
  const nome = value.trim();
  return ((nome.split(" - ")[0] ?? nome).trim() || nome).slice(0, 60);
}

async function createOrdemComFallback(input: ImportacaoOrdemInput) {
  try {
    await prisma.ordemServico.create({ data: input });
  } catch (error) {
    if (
      input.fiscalId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await prisma.ordemServico.create({ data: { ...input, fiscalId: null } });
      return;
    }
    throw error;
  }
}

export const prismaImportacaoRepository: ImportacaoRepository = {
  listPolos() {
    return prisma.polo.findMany({ where: { ativo: true }, select: poloSelect });
  },
  async ensurePolos(values: string[]) {
    // Upsert each distinct derived codigo once, then return one entry per
    // requested value (keyed by that value's name in the service map).
    const entries = values.map((value) => ({ value, codigo: deriveCodigo(value) }));
    const firstNomeByCodigo = new Map<string, string>();
    for (const { value, codigo } of entries) {
      if (!firstNomeByCodigo.has(codigo)) firstNomeByCodigo.set(codigo, value.trim());
    }
    const upserted = await Promise.all(
      [...firstNomeByCodigo.entries()].map(([codigo, nome]) =>
        prisma.polo.upsert({
          where: { codigo },
          update: {},
          create: { codigo, nome, regiao: null },
          select: poloSelect
        })
      )
    );
    const byCodigo = new Map(upserted.map((polo) => [polo.codigo, polo]));
    return entries.map(({ value, codigo }) => {
      const polo = byCodigo.get(codigo) as ImportacaoPolo;
      return { id: polo.id, nome: value, codigo: polo.codigo, regiao: polo.regiao };
    });
  },
  listFiscaisAtivos() {
    return prisma.user.findMany({
      where: { perfil: "fiscal", status: "ativo" },
      select: { id: true, name: true, matricula: true }
    });
  },
  async findOrdensByNumero(numeros: string[]) {
    if (numeros.length === 0) return [];
    return prisma.ordemServico.findMany({
      where: { numero: { in: numeros } },
      select: { id: true, numero: true }
    });
  },
  async openWorkByFiscal(fiscalIds: string[]) {
    if (fiscalIds.length === 0) return [];
    const rows = await prisma.ordemServico.findMany({
      where: { fiscalId: { in: fiscalIds }, status: { in: ["NaFila", "EmExecucao", "Pendente"] } },
      select: { id: true, fiscalId: true }
    });
    const byFiscal = new Map<string, string[]>();
    for (const row of rows) {
      if (!row.fiscalId) continue;
      const ids = byFiscal.get(row.fiscalId) ?? [];
      ids.push(row.id);
      byFiscal.set(row.fiscalId, ids);
    }
    return [...byFiscal.entries()].map(([fiscalId, ordemIds]) => ({ fiscalId, ordemIds }));
  },
  async createOrdens(inputs: ImportacaoOrdemInput[]) {
    if (inputs.length === 0) return;
    try {
      await prisma.ordemServico.createMany({ data: inputs });
    } catch (error) {
      // The service already guarantees ≤1 open OS per fiscal; a P2002 here means a
      // concurrent claim raced us. Fall back to per-row creates so the rest of the
      // batch still lands, dropping the fiscal on the conflicting row.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        for (const input of inputs) await createOrdemComFallback(input);
        return;
      }
      throw error;
    }
  },
  async updateOrdem(id: string, input: ImportacaoOrdemInput) {
    try {
      await prisma.ordemServico.update({ where: { id }, data: input });
    } catch (error) {
      if (
        input.fiscalId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        await prisma.ordemServico.update({ where: { id }, data: { ...input, fiscalId: null } });
        return;
      }
      throw error;
    }
  },
  async log(input: ImportacaoLogInput) {
    await createLogAtividade(input);
  }
};
