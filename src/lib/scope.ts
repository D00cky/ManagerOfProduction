import type { Perfil } from "@prisma/client";

export type SessionUserScope = {
  id: string;
  perfil: Perfil;
  poloId?: string | null;
  polosPermitidos?: string[];
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
  return { poloId: { in: allowedPoloIds(user) ?? [] } };
}
