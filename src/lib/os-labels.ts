import type { StatusOS, TipoServico } from "@prisma/client";

export const statusLabels: Record<StatusOS, string> = {
  NaFila: "Na fila",
  EmExecucao: "Em execucao",
  Pendente: "Pendente",
  Concluida: "Concluida",
  Cancelada: "Cancelada"
};

export const tipoServicoLabels: Record<TipoServico, string> = {
  RedeAgua: "Rede de agua",
  RamalAgua: "Ramal de agua",
  CavaleteHidrometro: "Cavalete / hidrometro",
  RedeRamalEsgoto: "Rede / ramal de esgoto / PV / PI / TL",
  Desobstrucao: "Desobstrucao / lavagem de rede / ramal",
  LavagemEee: "Lavagem de EEE",
  ReposicaoPiso: "Reposicao piso / passeio / bloquete / paralelo",
  ReposicaoAsfaltica: "Reposicao asfaltica / sinalizacao"
};

export function statusLabel(status: StatusOS): string {
  return statusLabels[status] ?? status;
}

export function tipoServicoLabel(tipo: string): string {
  return tipoServicoLabels[tipo as TipoServico] ?? tipo;
}
