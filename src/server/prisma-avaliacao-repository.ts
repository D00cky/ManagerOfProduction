import { prisma } from "@/lib/prisma";
import type { AvaliacaoRepository } from "@/server/avaliacao-service";

export const prismaAvaliacaoRepository: AvaliacaoRepository = {
  findTabulacaoById(id: string) {
    return prisma.tabulacao.findUnique({ where: { id }, select: { id: true } });
  },
  create(input) {
    return prisma.avaliacao.create({ data: input });
  }
};
