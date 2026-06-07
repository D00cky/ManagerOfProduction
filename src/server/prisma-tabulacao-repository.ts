import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TabulacaoLogInput, TabulacaoRepository, UpsertTabulacaoInput } from "@/server/tabulacao-service";

export const prismaTabulacaoRepository: TabulacaoRepository = {
  findOrdemById(id: string) {
    return prisma.ordemServico.findUnique({ where: { id } });
  },
  upsertTabulacao(input: UpsertTabulacaoInput) {
    return prisma.tabulacao.upsert({
      where: { ordemServicoId: input.ordemServicoId },
      create: input,
      update: {
        fiscalId: input.fiscalId,
        respostas: input.respostas,
        somaObtida: input.somaObtida,
        somaPossivel: input.somaPossivel,
        percentual: input.percentual,
        conceito: input.conceito,
        observacoes: input.observacoes
      }
    });
  },
  async log(input: TabulacaoLogInput) {
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
