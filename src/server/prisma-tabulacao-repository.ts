import { prisma } from "@/lib/prisma";
import { createLogAtividade } from "@/server/log";
import type { TabulacaoLogInput, TabulacaoRepository, UpsertTabulacaoInput } from "@/server/tabulacao-service";

export const prismaTabulacaoRepository: TabulacaoRepository = {
  findOrdemById(id: string) {
    return prisma.ordemServico.findUnique({ where: { id } });
  },
  findTabulacaoByOrdem(ordemServicoId: string) {
    return prisma.tabulacao.findUnique({ where: { ordemServicoId } });
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
    await createLogAtividade(input);
  }
};
