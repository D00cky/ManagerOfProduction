import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
  findOrdemByNumero(numero: string) {
    return prisma.ordemServico.findUnique({ where: { numero }, select: { id: true, numero: true } });
  },
  createOrdem(input: ImportacaoOrdemInput) {
    return prisma.ordemServico.create({ data: input });
  },
  updateOrdem(id: string, input: ImportacaoOrdemInput) {
    return prisma.ordemServico.update({ where: { id }, data: input });
  },
  async log(input: ImportacaoLogInput) {
    await prisma.logAtividade.create({
      data: {
        evento: input.evento,
        descricao: input.descricao,
        metadata: input.metadata ?? Prisma.JsonNull,
        userId: input.userId
      }
    });
  }
};
