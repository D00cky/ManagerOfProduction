import type { EventoLog, OrdemServico, Prisma, StatusOS } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { buildOsScope, type SessionUserScope } from "@/lib/scope";

export type DashboardLog = {
  id: string;
  evento: EventoLog;
  descricao: string;
  createdAt: Date;
};

export type DashboardRepository = {
  findOrdens(where: Prisma.OrdemServicoWhereInput): Promise<OrdemServico[]>;
  findRecentLogs(where: Prisma.OrdemServicoWhereInput): Promise<DashboardLog[]>;
};

export type DashboardResumo = {
  metricas: {
    total: number;
    naFila: number;
    emExecucao: number;
    pendentes: number;
    concluidas: number;
    canceladas: number;
    percentualConclusao: number;
  };
  progressoPorFiscal: Array<{
    fiscalId: string;
    total: number;
    concluidas: number;
    pendentes: number;
    emExecucao: number;
    percentualConclusao: number;
  }>;
  osParadas: Array<{
    id: string;
    numero: string;
    status: StatusOS;
    diasParada: number;
    fiscalId: string | null;
    poloId: string;
  }>;
  atividades: DashboardLog[];
};

export async function getDashboardResumo(
  repository: DashboardRepository,
  user: SessionUserScope,
  now = new Date()
): Promise<DashboardResumo> {
  const scope = buildOsScope(user);
  const [ordens, atividades] = await Promise.all([
    repository.findOrdens(scope),
    repository.findRecentLogs(scope)
  ]);

  return {
    metricas: calculateMetricas(ordens),
    progressoPorFiscal: calculateProgressoPorFiscal(ordens),
    osParadas: calculateOsParadas(ordens, now),
    atividades
  };
}

function calculateMetricas(ordens: OrdemServico[]): DashboardResumo["metricas"] {
  const total = ordens.length;
  const naFila = countStatus(ordens, "NaFila");
  const emExecucao = countStatus(ordens, "EmExecucao");
  const pendentes = countStatus(ordens, "Pendente");
  const concluidas = countStatus(ordens, "Concluida");
  const canceladas = countStatus(ordens, "Cancelada");
  const elegiveis = total - canceladas;
  return {
    total,
    naFila,
    emExecucao,
    pendentes,
    concluidas,
    canceladas,
    percentualConclusao: elegiveis > 0 ? concluidas / elegiveis : 0
  };
}

function calculateProgressoPorFiscal(ordens: OrdemServico[]): DashboardResumo["progressoPorFiscal"] {
  const byFiscal = new Map<string, { fiscalId: string; total: number; concluidas: number; pendentes: number; emExecucao: number }>();
  for (const ordem of ordens) {
    if (!ordem.fiscalId) continue;
    const current = byFiscal.get(ordem.fiscalId) ?? {
      fiscalId: ordem.fiscalId,
      total: 0,
      concluidas: 0,
      pendentes: 0,
      emExecucao: 0
    };
    current.total += 1;
    if (ordem.status === "Concluida") current.concluidas += 1;
    if (ordem.status === "Pendente") current.pendentes += 1;
    if (ordem.status === "EmExecucao") current.emExecucao += 1;
    byFiscal.set(ordem.fiscalId, current);
  }

  return [...byFiscal.values()]
    .map((item) => ({
      ...item,
      percentualConclusao: item.total > 0 ? item.concluidas / item.total : 0
    }))
    .sort((a, b) => a.fiscalId.localeCompare(b.fiscalId));
}

function calculateOsParadas(ordens: OrdemServico[], now: Date): DashboardResumo["osParadas"] {
  return ordens
    .filter((ordem) => ordem.status !== "Concluida" && ordem.status !== "Cancelada")
    .map((ordem) => ({
      id: ordem.id,
      numero: ordem.numero,
      status: ordem.status,
      diasParada: differenceInCalendarDays(now, ordem.updatedAt),
      fiscalId: ordem.fiscalId,
      poloId: ordem.poloId
    }))
    .filter((ordem) => ordem.diasParada >= 2)
    .sort((a, b) => b.diasParada - a.diasParada);
}

function countStatus(ordens: OrdemServico[], status: StatusOS) {
  return ordens.filter((ordem) => ordem.status === status).length;
}
