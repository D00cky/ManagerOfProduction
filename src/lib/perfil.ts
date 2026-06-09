import type { Perfil } from "@prisma/client";

const perfilLabels: Record<Perfil, string> = {
  supervisor: "Coordenação",
  monitor: "Monitor",
  fiscal: "Fiscal"
};

export function perfilLabel(perfil: Perfil) {
  return perfilLabels[perfil];
}
