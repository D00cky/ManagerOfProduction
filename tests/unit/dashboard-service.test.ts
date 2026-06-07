import { describe, expect, it, vi } from "vitest";
import type { OrdemServico } from "@prisma/client";
import { getDashboardResumo, type DashboardRepository } from "@/server/dashboard-service";

function os(overrides: Partial<OrdemServico>): OrdemServico {
  const now = new Date("2026-06-07T10:00:00.000Z");
  return {
    id: overrides.id ?? "os1",
    numero: overrides.numero ?? "1001",
    enderecoCompleto: "Rua A",
    bairro: null,
    cidade: null,
    tipoServico: "Vistoria",
    status: overrides.status ?? "NaFila",
    poloId: overrides.poloId ?? "p1",
    fiscalId: overrides.fiscalId ?? null,
    observacao: null,
    dataProgramada: null,
    iniciadaEm: null,
    concluidaEm: overrides.concluidaEm ?? null,
    canceladaEm: null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

function repository(ordens: OrdemServico[]): DashboardRepository {
  return {
    findOrdens: vi.fn(async () => ordens),
    findRecentLogs: vi.fn(async () => [
      { id: "log1", evento: "status" as const, descricao: "OS atualizada", createdAt: new Date("2026-06-07T11:00:00.000Z") }
    ])
  };
}

describe("getDashboardResumo", () => {
  it("loads OS using the requester scope", async () => {
    const repo = repository([]);

    await getDashboardResumo(repo, { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p2"] });

    expect(repo.findOrdens).toHaveBeenCalledWith({ poloId: { in: ["p2"] } });
  });

  it("calculates status metrics and completion percentage", async () => {
    const repo = repository([
      os({ id: "1", status: "NaFila" }),
      os({ id: "2", status: "EmExecucao" }),
      os({ id: "3", status: "Pendente" }),
      os({ id: "4", status: "Concluida", concluidaEm: new Date("2026-06-07T09:00:00.000Z") }),
      os({ id: "5", status: "Cancelada" })
    ]);

    const resumo = await getDashboardResumo(repo, { id: "s1", perfil: "supervisor" });

    expect(resumo.metricas).toEqual({
      total: 5,
      naFila: 1,
      emExecucao: 1,
      pendentes: 1,
      concluidas: 1,
      canceladas: 1,
      percentualConclusao: 0.25
    });
  });

  it("groups productivity by fiscal and ignores unassigned OS", async () => {
    const repo = repository([
      os({ id: "1", fiscalId: "f1", status: "Concluida" }),
      os({ id: "2", fiscalId: "f1", status: "Pendente" }),
      os({ id: "3", fiscalId: "f2", status: "EmExecucao" }),
      os({ id: "4", fiscalId: null, status: "NaFila" })
    ]);

    const resumo = await getDashboardResumo(repo, { id: "s1", perfil: "supervisor" });

    expect(resumo.progressoPorFiscal).toEqual([
      { fiscalId: "f1", total: 2, concluidas: 1, pendentes: 1, emExecucao: 0, percentualConclusao: 0.5 },
      { fiscalId: "f2", total: 1, concluidas: 0, pendentes: 0, emExecucao: 1, percentualConclusao: 0 }
    ]);
  });

  it("returns stalled OS older than the threshold and not terminal", async () => {
    const repo = repository([
      os({ id: "old", numero: "1001", status: "Pendente", updatedAt: new Date("2026-06-05T10:00:00.000Z") }),
      os({ id: "new", numero: "1002", status: "Pendente", updatedAt: new Date("2026-06-07T09:00:00.000Z") }),
      os({ id: "done", numero: "1003", status: "Concluida", updatedAt: new Date("2026-06-01T09:00:00.000Z") })
    ]);

    const resumo = await getDashboardResumo(repo, { id: "s1", perfil: "supervisor" }, new Date("2026-06-07T10:00:00.000Z"));

    expect(resumo.osParadas).toEqual([
      { id: "old", numero: "1001", status: "Pendente", diasParada: 2, fiscalId: null, poloId: "p1" }
    ]);
  });
});
