import type { StatusOS, TipoServico } from "@prisma/client";
import type { OsListFilters } from "@/server/os-service";

/**
 * Fila de OS filters live in the URL and are resolved into a SQL `where` on the
 * server (the queue is paginated server-side). Empty string means "todos";
 * SEM_FISCAL matches OS with no fiscal assigned.
 */

export const SEM_FISCAL = "__sem_fiscal__";

/** String-shaped filters as held by the UI selects / URL query. */
export type FilaFiltros = {
  poloId: string;
  fiscalId: string;
  tipoServico: string;
  status: string;
  busca: string;
};

export const FILTROS_VAZIOS: FilaFiltros = {
  poloId: "",
  fiscalId: "",
  tipoServico: "",
  status: "",
  busca: ""
};

type RawFiltros = {
  poloId?: string | null;
  fiscalId?: string | null;
  tipoServico?: string | null;
  status?: string | null;
  busca?: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Convert raw query/URL values into the service's typed filter object. */
export function parseFilaFilters(raw: RawFiltros): OsListFilters {
  const filters: OsListFilters = {};
  const poloId = clean(raw.poloId);
  if (poloId) filters.poloId = poloId;

  const fiscalId = clean(raw.fiscalId);
  if (fiscalId === SEM_FISCAL) filters.fiscalId = null;
  else if (fiscalId) filters.fiscalId = fiscalId;

  const tipoServico = clean(raw.tipoServico);
  if (tipoServico) filters.tipoServico = tipoServico as TipoServico;

  const status = clean(raw.status);
  if (status) filters.status = status as StatusOS;

  const busca = clean(raw.busca);
  if (busca) filters.busca = busca;

  return filters;
}
