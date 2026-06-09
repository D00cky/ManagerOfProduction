import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createLogAtividade } from "@/server/log";
import type { ImportacaoLogInput, ImportacaoOrdemInput, ImportacaoRepository } from "@/server/importacao-service";

export const prismaImportacaoRepository: ImportacaoRepository = {
  findPoloByNameOrCode(value: string) {
    return prisma.polo.findFirst({
      where: {
        OR: [
          { nome: { equals: value } },
          { codigo: { equals: value } }
        ],
        ativo: true
      },
      select: { id: true, nome: true, codigo: true }
    });
  },
  ensurePolo(value: string) {
    const nome = value.trim();
    // Sabesp unit strings look like "ORMR - DIV MANUT SERV OPE REGISTRO" — use the
    // leading token as the polo code, falling back to the full text.
    const codigo = ((nome.split(" - ")[0] ?? nome).trim() || nome).slice(0, 60);
    return prisma.polo.upsert({
      where: { codigo },
      update: {},
      create: { codigo, nome },
      select: { id: true, nome: true, codigo: true }
    });
  },
  findFiscalByNameOrMatricula(value: string) {
    return prisma.user.findFirst({
      where: {
        perfil: "fiscal",
        status: "ativo",
        OR: [{ matricula: value }, { name: value }]
      },
      select: { id: true, name: true, matricula: true }
    });
  },
  async hasOpenWork(fiscalId: string, excludeOrdemId?: string) {
    const count = await prisma.ordemServico.count({
      where: {
        fiscalId,
        status: { in: ["NaFila", "EmExecucao", "Pendente"] },
        ...(excludeOrdemId ? { id: { not: excludeOrdemId } } : {})
      }
    });
    return count > 0;
  },
  findOrdemByNumero(numero: string) {
    return prisma.ordemServico.findUnique({ where: { numero }, select: { id: true, numero: true } });
  },
  async createOrdem(input: ImportacaoOrdemInput) {
    try {
      return await prisma.ordemServico.create({ data: input });
    } catch (error) {
      if (
        input.fiscalId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return prisma.ordemServico.create({ data: { ...input, fiscalId: null } });
      }
      throw error;
    }
  },
  async updateOrdem(id: string, input: ImportacaoOrdemInput) {
    try {
      return await prisma.ordemServico.update({ where: { id }, data: input });
    } catch (error) {
      if (
        input.fiscalId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return prisma.ordemServico.update({
          where: { id },
          data: { ...input, fiscalId: null }
        });
      }
      throw error;
    }
  },
  async log(input: ImportacaoLogInput) {
    await createLogAtividade(input);
  }
};
