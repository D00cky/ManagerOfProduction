import type { EventoLog, OrdemServico, Prisma, Tabulacao } from "@prisma/client";
import { calcularConceito, type RespostasFfr } from "@/lib/ffr";
import type { SessionUserScope } from "@/lib/scope";
import { isOrdemInUserScope } from "@/server/os-service";

export type SaveTabulacaoInput = {
  ordemServicoId: string;
  respostas: RespostasFfr;
  observacoes?: string;
};

export type UpsertTabulacaoInput = {
  ordemServicoId: string;
  fiscalId: string;
  respostas: Prisma.InputJsonValue;
  somaObtida: number;
  somaPossivel: number;
  percentual: number;
  conceito: Tabulacao["conceito"];
  observacoes?: string | null;
};

export type TabulacaoLogInput = {
  evento: EventoLog;
  descricao: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
  ordemServicoId?: string;
};

export type TabulacaoRepository = {
  findOrdemById(id: string): Promise<OrdemServico | null>;
  upsertTabulacao(input: UpsertTabulacaoInput): Promise<Tabulacao>;
  log(input: TabulacaoLogInput): Promise<void>;
};

export async function saveTabulacao(
  repository: TabulacaoRepository,
  user: SessionUserScope,
  input: SaveTabulacaoInput
) {
  const ordem = await repository.findOrdemById(input.ordemServicoId);
  if (!ordem) throw new Error("OS nao encontrada");
  if (!isOrdemInUserScope(ordem, user)) throw new Error("OS fora do escopo do usuario");
  if (ordem.status === "Concluida") throw new Error("Tabulacao bloqueada para OS concluida");

  const resultado = calcularConceito(ordem.tipoServico, input.respostas);
  const tabulacao = await repository.upsertTabulacao({
    ordemServicoId: ordem.id,
    fiscalId: user.id,
    respostas: input.respostas as Prisma.InputJsonObject,
    somaObtida: resultado.somaObtida,
    somaPossivel: resultado.somaPossivel,
    percentual: resultado.percentual,
    conceito: resultado.conceito,
    observacoes: input.observacoes ?? null
  });

  await repository.log({
    evento: "tabulacao",
    descricao: `Tabulacao salva para OS ${ordem.numero}`,
    userId: user.id,
    ordemServicoId: ordem.id,
    metadata: {
      conceito: resultado.conceito,
      somaObtida: resultado.somaObtida,
      somaPossivel: resultado.somaPossivel,
      percentual: resultado.percentual
    }
  });

  return tabulacao;
}
