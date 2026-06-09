import type { StatusOS, TipoServico } from "@prisma/client";

export const statusLabels: Record<StatusOS, string> = {
  NaFila: "Na fila",
  EmExecucao: "Em execucao",
  Pendente: "Pendente",
  Concluida: "Concluida",
  Cancelada: "Cancelada"
};

export const tipoServicoLabels: Record<TipoServico, string> = {
  LigacaoAgua: "Ligacao de Agua",
  ReligacaoAgua: "Religacao de Agua",
  CorteAgua: "Corte de Agua",
  TrocaHidrometro: "Troca de Hidrometro",
  Vistoria: "Vistoria",
  ReparoRede: "Reparo de Rede",
  Outros: "Outros"
};

export function statusLabel(status: StatusOS): string {
  return statusLabels[status] ?? status;
}

export function tipoServicoLabel(tipo: string): string {
  return tipoServicoLabels[tipo as TipoServico] ?? tipo;
}
