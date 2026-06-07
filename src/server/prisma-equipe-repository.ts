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
  }
};
