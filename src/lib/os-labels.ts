import type { StatusOS, TipoServico } from "@prisma/client";

export const statusLabels: Record<StatusOS, string> = {
  NaFila: "Na fila",
  EmExecucao: "Em execucao",
  Pendente: "Pendente",
  Concluida: "Concluida",
  Cancelada: "Cancelada"
};

export const tipoServicoLabels: Record<TipoServico, string> = {
  RedeRamalAgua: "Rede / ramal de agua",
  CavaleteHidrometro: "Cavalete / hidrometro",
  RedeRamalEsgoto: "Rede / ramal de esgoto",
  Desobstrucao: "Desobstrucao",
  ReposicaoPiso: "Reposicao piso / passeio / bloquete / paralelo / sinalizacao horizontal",
  ReposicaoAsfaltica: "Reposicao asfaltica",
  Outros: "Outros"
};

export function statusLabel(status: StatusOS): string {
  return statusLabels[status] ?? status;
}

export function tipoServicoLabel(tipo: string): string {
  return tipoServicoLabels[tipo as TipoServico] ?? tipo;
}
