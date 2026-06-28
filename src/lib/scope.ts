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
  // Monitors see only the polos explicitly assigned to them (via UserPoloAccess,
  // surfaced as `polosPermitidos`), falling back to their own `poloId`. Scoping by
  // `poloId` keeps two monitors in the same região isolated to their own polos. An
  // empty list matches nothing (fail-closed) — a monitor with no polo sees nothing.
  const polos = allowedPoloIds(user) ?? [];
  return { poloId: { in: polos } };
}

/**
 * Apply a polo filter without letting it escape a `poloId`-scoped `where`. If the
 * role scope already restricts `poloId` to a set, a polo outside that set collapses
 * to "nothing" (`{ in: [] }`); otherwise (supervisor) the polo is used as-is.
 */
export function narrowPoloId(
  scopePoloId: Prisma.OrdemServicoWhereInput["poloId"],
  polo: string
): Prisma.OrdemServicoWhereInput["poloId"] {
  const allowed = (scopePoloId as { in?: string[] } | undefined)?.in;
  if (Array.isArray(allowed) && !allowed.includes(polo)) return { in: [] };
  return polo;
}

/**
 * Combine the role access scope with a geographic filter so the scope always wins.
 * The role scope (a monitor's `{ poloId: { in } }`, or `{}` for a supervisor) is kept
 * and the geo filters are ANDed on top: a polo filter is narrowed against the scope
 * (never escapes it), and região/município are plain AND narrowings — for a monitor
 * they intersect with the polo scope, so they can only ever shrink the visible set.
 */
export function mergeScopeAndGeo(
  scope: Prisma.OrdemServicoWhereInput,
  filtros: GeoFiltros
): Prisma.OrdemServicoWhereInput {
  const where: Prisma.OrdemServicoWhereInput = { ...scope };
  if (filtros.municipio) where.cidade = filtros.municipio;
  if (filtros.polo) where.poloId = narrowPoloId(scope.poloId, filtros.polo);
  if (filtros.regiao) where.regiaoAdministrativa = filtros.regiao;
  return where;
}
