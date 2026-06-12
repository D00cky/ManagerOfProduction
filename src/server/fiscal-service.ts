import type { StatusOS, TipoServico } from "@prisma/client";
import { startOfDay, startOfMonth } from "date-fns";
import type { SessionUserScope } from "@/lib/scope";

/** Counts of the fiscal's own OS, broken down for their personal dashboard. */
export type FiscalResumo = {
  total: number; // every OS assigned to the fiscal (their imported backlog)
  concluidas: number;
  restantes: number; // still open: NaFila + EmExecucao + Pendente
  canceladas: number;
  naFila: number; // waiting in the queue (NaFila), not yet started
};

/** Completions of one tipo de serviço within a window. */
export type FiscalTipoLinha = { tipoServico: TipoServico; count: number };

export type FiscalRepository = {
  contarPorStatus(fiscalId: string): Promise<Array<{ status: StatusOS; count: number }>>;
  proximaOrdem(fiscalId: string): Promise<{ id: string; numero: string } | null>;
  /** Count OS the fiscal concluded within [from, to] (by `concluidaEm`). */
  contarConcluidasNoPeriodo(fiscalId: string, from: Date, to: Date): Promise<number>;
  /** Same window, grouped by tipo de serviço. */
  contarConcluidasPorTipoNoPeriodo(
    fiscalId: string,
    from: Date,
    to: Date
  ): Promise<FiscalTipoLinha[]>;
};

const ABERTAS: StatusOS[] = ["NaFila", "EmExecucao", "Pendente"];

/** Pure: fold the per-status counts into the fiscal dashboard totals. */
export function resumoFiscal(counts: Array<{ status: StatusOS; count: number }>): FiscalResumo {
  const by = new Map(counts.map((row) => [row.status, row.count]));
  const get = (status: StatusOS) => by.get(status) ?? 0;
  const restantes = ABERTAS.reduce((sum, status) => sum + get(status), 0);
  const concluidas = get("Concluida");
  const canceladas = get("Cancelada");
  return {
    total: restantes + concluidas + canceladas,
    concluidas,
    restantes,
    canceladas,
    naFila: get("NaFila")
  };
}

export type FiscalHome = {
  resumo: FiscalResumo;
  proximaOrdemId: string | null;
  concluidasHoje: number;
};

export async function getFiscalHome(
  repository: FiscalRepository,
  user: SessionUserScope,
  now = new Date()
): Promise<FiscalHome> {
  const inicioDia = startOfDay(now);
  const [counts, proxima, concluidasHoje] = await Promise.all([
    repository.contarPorStatus(user.id),
    repository.proximaOrdem(user.id),
    repository.contarConcluidasNoPeriodo(user.id, inicioDia, now)
  ]);
  return { resumo: resumoFiscal(counts), proximaOrdemId: proxima?.id ?? null, concluidasHoje };
}

/** The fiscal-only performance dashboard: today + this month, plus monthly by tipo. */
export type FiscalDesempenho = {
  importadas: number; // total OS atribuídas ao fiscal
  naFila: number;
  concluidasHoje: number;
  concluidasMes: number;
  porTipo: FiscalTipoLinha[]; // concluídas no mês, por tipo de serviço
};

export async function getFiscalDesempenho(
  repository: FiscalRepository,
  user: SessionUserScope,
  now = new Date()
): Promise<FiscalDesempenho> {
  const inicioDia = startOfDay(now);
  const inicioMes = startOfMonth(now);
  const [counts, concluidasHoje, concluidasMes, porTipo] = await Promise.all([
    repository.contarPorStatus(user.id),
    repository.contarConcluidasNoPeriodo(user.id, inicioDia, now),
    repository.contarConcluidasNoPeriodo(user.id, inicioMes, now),
    repository.contarConcluidasPorTipoNoPeriodo(user.id, inicioMes, now)
  ]);
  const resumo = resumoFiscal(counts);
  return {
    importadas: resumo.total,
    naFila: resumo.naFila,
    concluidasHoje,
    concluidasMes,
    porTipo
  };
}
