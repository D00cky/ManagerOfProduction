import type { Perfil } from "@prisma/client";

export type SessionUserScope = {
  id: string;
  perfil: Perfil;
  poloId?: string | null;
  polosPermitidos?: string[];
  /** For monitors: the administrative região they oversee (whole-região scope). */
  regiao?: string | null;
};

export function allowedPoloIds(user: SessionUserScope) {
  if (user.perfil === "supervisor") return undefined;
  if (user.perfil === "monitor") {
    const explicit = user.polosPermitidos?.filter(Boolean) ?? [];
    return explicit.length > 0 ? explicit : user.poloId ? [user.poloId] : [];
  }
  return user.poloId ? [user.poloId] : [];
}

export function buildOsScope(user: SessionUserScope) {
  if (user.perfil === "supervisor") return {};
  if (user.perfil === "fiscal") return { fiscalId: user.id };
  // Monitors oversee a whole administrative região. OS rows carry their polo's
  // região in `regiaoAdministrativa` (denormalized on import), so scoping by that
  // single indexed column is both correct and cheap. An empty `in` list (monitor
  // without a região) matches nothing, mirroring the old empty-polo-list behaviour.
  return { regiaoAdministrativa: { in: user.regiao ? [user.regiao] : [] } };
}
