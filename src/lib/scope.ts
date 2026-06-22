import type { Perfil, Prisma } from "@prisma/client";

export type SessionUserScope = {
  id: string;
  perfil: Perfil;
  poloId?: string | null;
  polosPermitidos?: string[];
  /** For monitors: the administrative região they oversee (whole-região scope). */
  regiao?: string | null;
};

/** Geographic narrowing applied on top of the role scope (Região → Polo → Município). */
export type GeoFiltros = {
  regiao?: string;
  /** Polo id; narrows the OS set within the selected região. */
  polo?: string;
  municipio?: string;
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

/**
 * Combine the role access scope with a geographic filter so the scope always wins.
 * A monitor is restricted to a single região (`{ regiaoAdministrativa: { in } }`); a região
 * filter may only narrow *within* that scope — never escape it — and an out-of-scope região
 * collapses to "nothing". Polo/município are additional AND narrowings within the scope.
 */
export function mergeScopeAndGeo(
  scope: Prisma.OrdemServicoWhereInput,
  filtros: GeoFiltros
): Prisma.OrdemServicoWhereInput {
  const where: Prisma.OrdemServicoWhereInput = { ...scope };
  if (filtros.municipio) where.cidade = filtros.municipio;
  if (filtros.polo) where.poloId = filtros.polo;
  if (filtros.regiao) {
    const scoped = scope.regiaoAdministrativa as { in?: string[] } | undefined;
    const allowed = !scoped || (Array.isArray(scoped.in) ? scoped.in.includes(filtros.regiao) : true);
    where.regiaoAdministrativa = allowed ? filtros.regiao : { in: [] };
  }
  return where;
}
