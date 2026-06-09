import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EquipeRepository } from "@/server/equipe-service";

const membroSelect = {
  id: true,
  name: true,
  matricula: true,
  perfil: true,
  status: true,
  poloId: true,
  lastSeenAt: true
} satisfies Prisma.UserSelect;

export const prismaEquipeRepository: EquipeRepository = {
  list(poloIds: string[] | undefined) {
    return prisma.user.findMany({
      where: {
        perfil: { in: ["fiscal", "monitor"] },
        ...(poloIds ? { poloId: { in: poloIds } } : {})
      },
      orderBy: { name: "asc" },
      select: membroSelect
    });
  },
  findMembro(id: string) {
    return prisma.user.findFirst({
      where: { id, perfil: { in: ["fiscal", "monitor"] } },
      select: membroSelect
    });
  },
  updatePolo(id: string, poloId: string | null) {
    return prisma.user.update({
      where: { id },
      data: { poloId },
      select: membroSelect
    });
  },
  async log(input) {
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
