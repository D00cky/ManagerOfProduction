import type { Perfil, StatusUsuario } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { allowedPoloIds, type SessionUserScope } from "@/lib/scope";

export type MembroEquipe = {
  id: string;
  name: string;
  matricula: string;
  perfil: Perfil;
  status: StatusUsuario;
  poloId: string | null;
  lastSeenAt: Date | null;
};

export type EquipeRepository = {
  // poloIds === undefined means no polo restriction (supervisor scope).
  list(poloIds: string[] | undefined): Promise<MembroEquipe[]>;
};

export async function listEquipe(repository: EquipeRepository, user: SessionUserScope) {
  if (!hasPermission(user.perfil, "equipe:read")) {
    throw new Error("Sem permissao para ver a equipe");
  }
  return repository.list(allowedPoloIds(user));
}
