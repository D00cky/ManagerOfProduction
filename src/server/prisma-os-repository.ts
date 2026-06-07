import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LogInput, OrdemRepository, OrdemStatusUpdate } from "@/server/os-service";

export const prismaOrdemRepository: OrdemRepository = {
  findMany(where: Prisma.OrdemServicoWhereInput) {
    return prisma.ordemServico.findMany({
      where,
      orderBy: [{ dataProgramada: "asc" }, { createdAt: "desc" }],
      include: { polo: true, fiscal: true, tabulacao: true }
    });
  },
  findById(id: string) {
    return prisma.ordemServico.findUnique({ where: { id } });
  },
  async hasTabulacao(ordemServicoId: string) {
    const count = await prisma.tabulacao.count({ where: { ordemServicoId } });
    return count > 0;
  },
  updateStatus(id: string, data: OrdemStatusUpdate) {
    return prisma.ordemServico.update({ where: { id }, data });
  },
  findFiscalById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, perfil: true, poloId: true }
    });
  },
  updateFiscal(id: string, fiscalId: string) {
    return prisma.ordemServico.update({ where: { id }, data: { fiscalId } });
  },
  async log(input: LogInput) {
    await prisma.logAtividade.create({
      data: {
        evento: input.evento,
        descricao: input.descricao,
        metadata: input.metadata ?? Prisma.JsonNull,
        userId: input.userId,
        ordemServicoId: input.ordemServicoId
      }
    });
  }
};
