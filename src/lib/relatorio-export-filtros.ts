import type { TipoServico } from "@prisma/client";
import type { RelatorioExportFiltros, RelatorioPeriodoTipo } from "@/server/relatorio-export-service";

/**
 * Filtros do relatório executivo, na forma como vivem na URL / nos selects da UI.
 * Resolvidos no servidor para `RelatorioExportFiltros` (datas tipadas).
 */
export type RawRelatorioExportFiltros = {
  periodoTipo?: string | null;
  from?: string | null;
  to?: string | null;
  mes?: string | null;
  semana?: string | null;
  regiao?: string | null;
  polo?: string | null;
  municipio?: string | null;
  tipoServico?: string | null;
  fiscalId?: string | null;
};

const PERIODOS: RelatorioPeriodoTipo[] = ["semanal", "mensal", "personalizado"];

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Parse `yyyy-mm-dd` em fronteira de dia local (`endOfDay` = limite superior inclusivo). */
function parseInputDate(value: string | null | undefined, endOfDay: boolean): Date | undefined {
  const raw = clean(value);
  const match = raw ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null;
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseRelatorioExportFiltros(raw: RawRelatorioExportFiltros): RelatorioExportFiltros {
  const filtros: RelatorioExportFiltros = {};

  const periodoTipo = clean(raw.periodoTipo);
  if (periodoTipo && (PERIODOS as string[]).includes(periodoTipo)) {
    filtros.periodoTipo = periodoTipo as RelatorioPeriodoTipo;
  }

  const from = parseInputDate(raw.from, false);
  if (from) filtros.from = from;
  const to = parseInputDate(raw.to, true);
  if (to) filtros.to = to;

  const mes = clean(raw.mes);
  if (mes && /^\d{4}-\d{2}$/.test(mes)) filtros.mes = mes;

  const semana = clean(raw.semana);
  if (semana && /^\d{4}-W\d{2}$/.test(semana)) filtros.semana = semana;

  const regiao = clean(raw.regiao);
  if (regiao) filtros.regiao = regiao;

  const polo = clean(raw.polo);
  if (polo) filtros.polo = polo;

  const municipio = clean(raw.municipio);
  if (municipio) filtros.municipio = municipio;

  const tipoServico = clean(raw.tipoServico);
  if (tipoServico) filtros.tipoServico = tipoServico as TipoServico;

  const fiscalId = clean(raw.fiscalId);
  if (fiscalId) filtros.fiscalId = fiscalId;

  return filtros;
}

/** Lê os filtros a partir de `URLSearchParams` (rota da API). */
export function filtrosFromSearchParams(params: URLSearchParams): RelatorioExportFiltros {
  return parseRelatorioExportFiltros({
    periodoTipo: params.get("periodoTipo"),
    from: params.get("from"),
    to: params.get("to"),
    mes: params.get("mes"),
    semana: params.get("semana"),
    regiao: params.get("regiao"),
    polo: params.get("polo"),
    municipio: params.get("municipio"),
    tipoServico: params.get("tipoServico"),
    fiscalId: params.get("fiscalId")
  });
}
