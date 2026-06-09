import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AtualizarPoloInput, CriarPoloInput, PoloRepository } from "@/server/polo-service";

const poloSelect = {
  id: true,
  nome: true,
  codigo: true,
  regiao: true,
  ativo: true
} satisfies Prisma.PoloSelect;

export const prismaPoloRepository: PoloRepository = {
  list() {
    return prisma.polo.findMany({ orderBy: { nome: "asc" }, select: poloSelect });
  },
  findByCodigo(codigo: string) {
    return prisma.polo.findUnique({ where: { codigo }, select: poloSelect });
  },
  findById(id: string) {
    return prisma.polo.findUnique({ where: { id }, select: poloSelect });
  },
  create(input: CriarPoloInput) {
    return prisma.polo.create({
      data: { nome: input.nome, codigo: input.codigo, regiao: input.regiao ?? null },
      select: poloSelect
    });
  },
  update(id: string, data: AtualizarPoloInput) {
    return prisma.polo.update({ where: { id }, data, select: poloSelect });
  }
};
