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
  async findFiscalNome(fiscalId: string) {
    const user = await prisma.user.findUnique({ where: { id: fiscalId }, select: { name: true } });
    return user?.name ?? null;
  },
  findUsuarioBasico(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { name: true, matricula: true } });
  },
  upsertTabulacao(input: UpsertTabulacaoInput) {
    const { alteracao, ...base } = input;
    return prisma.tabulacao.upsert({
      where: { ordemServicoId: input.ordemServicoId },
      create: { ...base, alterada: false },
      update: {
        fiscalId: base.fiscalId,
        tabuladoPorId: base.tabuladoPorId,
        respostas: base.respostas,
        somaObtida: base.somaObtida,
        somaPossivel: base.somaPossivel,
        percentual: base.percentual,
        conceito: base.conceito,
        observacoes: base.observacoes,
        // Campos de alteração só mudam quando a gravação for de fato uma alteração;
        // caso contrário o histórico anterior é preservado.
        ...(alteracao
          ? {
              alterada: true,
              alteradoPorId: alteracao.alteradoPorId,
              motivoAlteracao: alteracao.motivoAlteracao,
              alteradaEm: alteracao.alteradaEm
            }
          : {})
      }
    });
  },
  async log(input: TabulacaoLogInput) {
    await createLogAtividade(input);
  }
};
