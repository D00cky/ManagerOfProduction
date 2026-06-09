import type { Perfil, StatusOS } from "@prisma/client";

export type Permission =
  | "dashboard:read"
  | "fila:read"
  | "os:write"
  | "os:delete"
  | "importacao:write"
  | "tabulacao:write"
  | "equipe:read"
  | "equipe:write"
  | "usuarios:write"
  | "avaliacoes:write"
  | "relatorios:read"
  | "configuracoes:write";

export const rolePermissions: Record<Perfil, Permission[]> = {
  fiscal: ["fila:read", "tabulacao:write"],
  monitor: [
    "dashboard:read",
    "fila:read",
    "os:write",
    "os:delete",
    "importacao:write",
    "tabulacao:write",
    "equipe:read",
    "equipe:write",
    "relatorios:read"
  ],
  supervisor: [
    "dashboard:read",
    "fila:read",
    "os:write",
    "os:delete",
    "importacao:write",
    "tabulacao:write",
    "equipe:read",
    "equipe:write",
    "usuarios:write",
    "avaliacoes:write",
    "relatorios:read",
    "configuracoes:write"
  ]
};

export const navigation = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard:read" },
  { href: "/fila", label: "Fila de OS", permission: "fila:read" },
  { href: "/importar", label: "Importar Excel", permission: "importacao:write" },
  { href: "/equipe", label: "Equipe", permission: "equipe:read" },
  { href: "/usuarios", label: "Usuarios", permission: "usuarios:write" },
  { href: "/relatorios", label: "Relatorios", permission: "relatorios:read" },
  { href: "/configuracoes", label: "Configuracoes", permission: "configuracoes:write" }
] satisfies Array<{ href: string; label: string; permission: Permission }>;

export function hasPermission(perfil: Perfil, permission: Permission) {
  return rolePermissions[perfil].includes(permission);
}

export function defaultRedirect(perfil: Perfil) {
  // Fiscais land straight in the tabulação flow (which jumps to their next OS).
  return perfil === "fiscal" ? "/tabulacao" : "/dashboard";
}

export function canTransitionStatus(from: StatusOS, to: StatusOS, hasTabulacao: boolean) {
  if (from === "Cancelada" || from === "Concluida") return false;
  if (to === "Concluida") return hasTabulacao;
  if (to === "Cancelada") return true;
  const allowed: Partial<Record<StatusOS, StatusOS[]>> = {
    NaFila: ["EmExecucao", "Pendente"],
    EmExecucao: ["Pendente"],
    Pendente: ["EmExecucao"]
  };
  return allowed[from]?.includes(to) ?? false;
}
