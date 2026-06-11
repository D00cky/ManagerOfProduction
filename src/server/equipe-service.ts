import type { Perfil, Prisma, StatusUsuario } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { allowedPoloIds, type SessionUserScope } from "@/lib/scope";

/**
 * Escopo de listagem da equipe: supervisor vê todos; monitor vê quem está na sua
 * região (fiscais/monitores cujo polo é da região, monitores da região, e sempre
 * o próprio monitor, mesmo que o polo dele esteja inconsistente).
 */
export type EquipeScope =
  | { tipo: "todos" }
  | { tipo: "regiao"; regiao: string; selfId: string };

export type MembroEquipe = {
  id: string;
  name: string;
  matricula: string;
  perfil: Perfil;
  status: StatusUsuario;
  poloId: string | null;
  lastSeenAt: Date | null;
};

export type EquipeLogInput = {
  evento: "usuario";
  descricao: string;
  userId?: string;
  metadata?: Prisma.InputJsonValue;
};

export type EquipeRepository = {
  list(scope: EquipeScope): Promise<MembroEquipe[]>;
  findMembro(id: string): Promise<MembroEquipe | null>;
  updatePolo(id: string, poloId: string | null): Promise<MembroEquipe>;
  log(input: EquipeLogInput): Promise<void>;
};

export async function listEquipe(repository: EquipeRepository, user: SessionUserScope) {
  if (!hasPermission(user.perfil, "equipe:read")) {
    throw new Error("Sem permissao para ver a equipe");
  }
  const scope: EquipeScope =
    user.perfil === "supervisor"
      ? { tipo: "todos" }
      : { tipo: "regiao", regiao: user.regiao ?? "", selfId: user.id };
  return repository.list(scope);
}

export async function atualizarPoloMembro(
  repository: EquipeRepository,
  user: SessionUserScope,
  membroId: string,
  poloId: string | null
) {
  if (!hasPermission(user.perfil, "equipe:write")) {
    throw new Error("Sem permissao para alterar polo da equipe");
  }

  const membro = await repository.findMembro(membroId);
  if (!membro) throw new Error("Membro nao encontrado");

  // undefined = supervisor (no restriction); a list means monitor scope.
  const allowed = allowedPoloIds(user);
  if (allowed) {
    const membroNoEscopo = membro.poloId !== null && allowed.includes(membro.poloId);
    const destinoNoEscopo = poloId !== null && allowed.includes(poloId);
    if (!membroNoEscopo || !destinoNoEscopo) {
      throw new Error("Sem permissao para alterar polo deste membro");
    }
  }

  const atualizado = await repository.updatePolo(membroId, poloId);
  await repository.log({
    evento: "usuario",
    descricao: `Polo do membro ${membro.name} alterado`,
    userId: user.id,
    metadata: { id: membroId, de: membro.poloId, para: poloId }
  });
  return atualizado;
}
