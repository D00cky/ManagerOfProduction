import type { StatusOS } from "@prisma/client";
import type { SessionUserScope } from "@/lib/scope";

/** Counts of the fiscal's own OS, broken down for their personal dashboard. */
export type FiscalResumo = {
  total: number; // every OS assigned to the fiscal (their imported backlog)
  concluidas: number;
  restantes: number; // still open: NaFila + EmExecucao + Pendente
  canceladas: number;
};

export type FiscalRepository = {
  contarPorStatus(fiscalId: string): Promise<Array<{ status: StatusOS; count: number }>>;
  proximaOrdem(fiscalId: string): Promise<{ id: string; numero: string } | null>;
};

const ABERTAS: StatusOS[] = ["NaFila", "EmExecucao", "Pendente"];

/** Pure: fold the per-status counts into the fiscal dashboard totals. */
export function resumoFiscal(counts: Array<{ status: StatusOS; count: number }>): FiscalResumo {
  const by = new Map(counts.map((row) => [row.status, row.count]));
  const get = (status: StatusOS) => by.get(status) ?? 0;
  const restantes = ABERTAS.reduce((sum, status) => sum + get(status), 0);
  const concluidas = get("Concluida");
  const canceladas = get("Cancelada");
  return { total: restantes + concluidas + canceladas, concluidas, restantes, canceladas };
}

export type FiscalHome = { resumo: FiscalResumo; proximaOrdemId: string | null };

export async function getFiscalHome(
  repository: FiscalRepository,
  user: SessionUserScope
): Promise<FiscalHome> {
  const [counts, proxima] = await Promise.all([
    repository.contarPorStatus(user.id),
    repository.proximaOrdem(user.id)
  ]);
  return { resumo: resumoFiscal(counts), proximaOrdemId: proxima?.id ?? null };
}
