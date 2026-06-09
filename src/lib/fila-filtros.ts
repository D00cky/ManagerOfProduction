import type { StatusOS } from "@prisma/client";

/**
 * Pure (DOM-free) filtering + pagination for the Fila de OS table, so the queue
 * UI logic can be unit-tested without rendering. Empty string means "todos" for
 * each filter; SEM_FISCAL matches OS with no fiscal assigned.
 */

export const SEM_FISCAL = "__sem_fiscal__";

export type FilaFiltros = {
  poloId: string;
  fiscalId: string;
  tipoServico: string;
  status: string;
};

export const FILTROS_VAZIOS: FilaFiltros = {
  poloId: "",
  fiscalId: "",
  tipoServico: "",
  status: ""
};

export type FilaFiltravel = {
  poloId: string | null;
  fiscalId: string | null;
  tipoServico: string;
  status: StatusOS;
};

export function filtrarOrdens<T extends FilaFiltravel>(rows: T[], filtros: FilaFiltros): T[] {
  return rows.filter((row) => {
    if (filtros.poloId && row.poloId !== filtros.poloId) return false;
    if (filtros.fiscalId === SEM_FISCAL) {
      if (row.fiscalId) return false;
    } else if (filtros.fiscalId && row.fiscalId !== filtros.fiscalId) {
      return false;
    }
    if (filtros.tipoServico && row.tipoServico !== filtros.tipoServico) return false;
    if (filtros.status && row.status !== filtros.status) return false;
    return true;
  });
}

export type Paginacao<T> = {
  itens: T[];
  paginaAtual: number;
  totalPaginas: number;
  total: number;
};

export function paginar<T>(rows: T[], pagina: number, tamanho: number): Paginacao<T> {
  const total = rows.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaAtual - 1) * tamanho;
  return {
    itens: rows.slice(inicio, inicio + tamanho),
    paginaAtual,
    totalPaginas,
    total
  };
}
