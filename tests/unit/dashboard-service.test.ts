import { describe, expect, it, vi } from "vitest";
import type { OrdemServico } from "@prisma/client";
import { getDashboardResumo, type DashboardRepository } from "@/server/dashboard-service";

function os(overrides: Partial<OrdemServico>): OrdemServico {
  const now = new Date("2026-06-07T10:00:00.000Z");
  return {
    id: overrides.id ?? "os1",
    numero: overrides.numero ?? "1001",
    enderecoCompleto: "Rua A",
    numeroImovel: null,
    complemento: null,
    bairro: null,
    cidade: overrides.cidade ?? null,
    regiaoAdministrativa: overrides.regiaoAdministrativa ?? null,
    tipoServico: "Vistoria",
    status: overrides.status ?? "NaFila",
    poloId: overrides.poloId ?? "p1",
    fiscalId: overrides.fiscalId ?? null,
    unidadeExecutante: null,
    codigoContrato: null,
    descricaoContrato: null,
    codigoTss: null,
    descricaoTss: null,
    codigoTse: null,
    descricaoTse: null,
    pde: null,
    equipe: null,
    observacao: null,
    dataProgramada: null,
    dataInicioExecucao: null,
    dataFimExecucao: null,
    iniciadaEm: null,
    concluidaEm: overrides.concluidaEm ?? null,
    canceladaEm: null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

function matchesWhere(ordem: OrdemServico, where: Record<string, unknown>): boolean {
  const polo = where.poloId as { in?: string[] } | undefined;
  if (polo?.in && !polo.in.includes(ordem.poloId)) return false;
  if (where.fiscalId && ordem.fiscalId !== where.fiscalId) return false;
  if (where.regiaoAdministrativa && ordem.regiaoAdministrativa !== where.regiaoAdministrativa) return false;
  if (where.cidade && ordem.cidade !== where.cidade) return false;
  return true;
}

function repository(ordens: OrdemServico[]): DashboardRepository {
  return {
    findOrdens: vi.fn(async (where: Record<string, unknown>) => ordens.filter((ordem) => matchesWhere(ordem, where))),
    findRecentLogs: vi.fn(async () => [
      { id: "log1", evento: "status" as const, descricao: "OS atualizada", createdAt: new Date("2026-06-07T11:00:00.000Z") }
    ]),
    findGeoFacets: vi.fn(async (where: Record<string, unknown>) => {
      const seen = new Set<string>();
      const facets: Array<{ regiaoAdministrativa: string | null; cidade: string | null }> = [];
      for (const ordem of ordens.filter((o) => matchesWhere(o, where))) {
        const key = `${ordem.regiaoAdministrativa}__${ordem.cidade}`;
        if (seen.has(key)) continue;
        seen.add(key);
        facets.push({ regiaoAdministrativa: ordem.regiaoAdministrativa, cidade: ordem.cidade });
      }
      return facets;
    })
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

  it("narrows metrics by region and exposes geographic options within scope", async () => {
    const repo = repository([
      os({ id: "1", cidade: "MIRACATU", regiaoAdministrativa: "Registro" }),
      os({ id: "2", cidade: "REGISTRO", regiaoAdministrativa: "Registro" }),
      os({ id: "3", cidade: "GUARULHOS", regiaoAdministrativa: "São Paulo" })
    ]);

    const resumo = await getDashboardResumo(
      repo,
      { id: "s1", perfil: "supervisor" },
      new Date("2026-06-07T10:00:00.000Z"),
      { regiao: "Registro" }
    );

    expect(repo.findOrdens).toHaveBeenCalledWith({ regiaoAdministrativa: "Registro" });
    expect(resumo.metricas.total).toBe(2);
    expect(resumo.filtros).toEqual({ regiao: "Registro" });
    // Options are built from the full scope, not the narrowed filter.
    expect(resumo.opcoesGeograficas).toEqual([
      { regiao: "São Paulo", municipios: ["GUARULHOS"] },
      { regiao: "Registro", municipios: ["MIRACATU", "REGISTRO"] }
    ]);
  });

  it("narrows by municipality and keeps the access scope (monitor cannot read other polos)", async () => {
    const repo = repository([
      os({ id: "1", poloId: "p1", cidade: "MIRACATU", regiaoAdministrativa: "Registro" }),
      os({ id: "2", poloId: "p1", cidade: "REGISTRO", regiaoAdministrativa: "Registro" }),
      os({ id: "3", poloId: "p2", cidade: "MIRACATU", regiaoAdministrativa: "Registro" })
    ]);

    const resumo = await getDashboardResumo(
      repo,
      { id: "m1", perfil: "monitor", poloId: "p1", polosPermitidos: ["p1"] },
      new Date("2026-06-07T10:00:00.000Z"),
      { municipio: "MIRACATU" }
    );

    expect(repo.findOrdens).toHaveBeenCalledWith({ poloId: { in: ["p1"] }, cidade: "MIRACATU" });
    // Only the in-scope MIRACATU OS (p1), not the p2 one.
    expect(resumo.metricas.total).toBe(1);
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
