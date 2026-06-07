import type { Avaliacao } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import type { SessionUserScope } from "@/lib/scope";

export type AvaliacaoInput = {
  nota: number;
  comentario?: string | null;
};

export type AvaliacaoCreate = {
  tabulacaoId: string;
  avaliadorId: string;
  nota: number;
  comentario: string | null;
};

export type AvaliacaoRepository = {
  findTabulacaoById(id: string): Promise<{ id: string } | null>;
  create(input: AvaliacaoCreate): Promise<Avaliacao>;
};

export async function criarAvaliacao(
  repository: AvaliacaoRepository,
  user: SessionUserScope,
  tabulacaoId: string,
  input: AvaliacaoInput
) {
  if (!hasPermission(user.perfil, "avaliacoes:write")) {
    throw new Error("Sem permissao para avaliar tabulacoes");
  }
  if (!Number.isInteger(input.nota) || input.nota < 1 || input.nota > 5) {
    throw new Error("Avaliacao invalida");
  }

  const tabulacao = await repository.findTabulacaoById(tabulacaoId);
  if (!tabulacao) throw new Error("Tabulacao nao encontrada");

  const comentario = input.comentario?.trim() || null;
  return repository.create({
    tabulacaoId,
    avaliadorId: user.id,
    nota: input.nota,
    comentario
  });
}
