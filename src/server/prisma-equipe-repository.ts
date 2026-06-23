import { Prisma, type Perfil } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createLogAtividade } from "@/server/log";
import type { EquipeRepository } from "@/server/equipe-service";

const perfisEquipe: Perfil[] = ["fiscal", "monitor"];

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
  list(scope) {
    const where: Prisma.UserWhereInput =
      scope.tipo === "todos"
        ? { perfil: { in: perfisEquipe } }
        : {
            perfil: { in: perfisEquipe },
            OR: [
              // Fiscais/monitores cujo polo está atribuído ao monitor.
              { poloId: { in: scope.poloIds } },
              // Sempre inclui o próprio monitor, mesmo com polo fora do escopo.
              { id: scope.selfId }
            ]
          };
    return prisma.user.findMany({ where, orderBy: { name: "asc" }, select: membroSelect });
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
    await createLogAtividade(input);
  }
};
