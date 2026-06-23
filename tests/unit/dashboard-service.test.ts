import { describe, expect, it, vi } from "vitest";
import type { OrdemServico } from "@prisma/client";
import {
  getDashboardResumo,
  mesesDisponiveisDe,
  type DashboardRepository
} from "@/server/dashboard-service";

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
    tipoServico: "Outros",
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
    dataFimExecucao: overrides.dataFimExecucao ?? null,
    iniciadaEm: null,
    concluidaEm: overrides.concluidaEm ?? null,
    canceladaEm: null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

function matchesWhere(ordem: OrdemServico, where: Record<string, unknown>): boolean {
  const polo = where.poloId as string | { in?: string[] } | undefined;
  if (typeof polo === "string" && ordem.poloId !== polo) return false;
  if (polo && typeof polo === "object" && polo.in && !polo.in.includes(ordem.poloId)) return false;
  if (where.fiscalId && ordem.fiscalId !== where.fiscalId) return false;
  const regiao = where.regiaoAdministrativa as string | { in?: string[] } | undefined;
  if (typeof regiao === "string" && ordem.regiaoAdministrativa !== regiao) return false;
  if (regiao && typeof regiao === "object" && regiao.in && !regiao.in.includes(ordem.regiaoAdministrativa as string)) {
    return false;
  }
  if (where.cidade && ordem.cidade !== where.cidade) return false;
  return true;
}

type Periodo = { from: Date; to: Date };
function inWindow(date: Date | null, periodo: Periodo) {
  return date !== null && date >= periodo.from && date <= periodo.to;
}

/** Backlog "parada": execução concluída, não terminal e sem movimento 2+ dias. */
function paradas(ordens: OrdemServico[], updatedBefore: Date) {
  return ordens.filter(
    (o) =>
      o.dataFimExecucao !== null &&
      o.status !== "Concluida" &&
      o.status !== "Cancelada" &&
      o.updatedAt < updatedBefore
  );
}

/** Tabulação fixture for the "analisadas" funnel: createdAt + the OS it scores. */
type TabFixture = { createdAt: Date; ordem: OrdemServico };

function repository(ordens: OrdemServico[], tabulacoes: TabFixture[] = []): DashboardRepository {
  const scoped = (where: Record<string, unknown>) => ordens.filter((ordem) => matchesWhere(ordem, where));
  return {
    countByStatus: vi.fn(async (where: Record<string, unknown>) => {
      const counts = new Map<OrdemServico["status"], number>();
      for (const ordem of scoped(where)) counts.set(ordem.status, (counts.get(ordem.status) ?? 0) + 1);
      return [...counts.entries()].map(([status, count]) => ({ status, count }));
    }),
    progressoPorFiscal: vi.fn(async (where: Record<string, unknown>) => {
      const byFiscal = new Map<string, { fiscalId: string; total: number; concluidas: number; pendentes: number; emExecucao: number }>();
      for (const ordem of scoped(where)) {
        if (!ordem.fiscalId) continue;
        const cur = byFiscal.get(ordem.fiscalId) ?? { fiscalId: ordem.fiscalId, total: 0, concluidas: 0, pendentes: 0, emExecucao: 0 };
        cur.total += 1;
        if (ordem.status === "Concluida") cur.concluidas += 1;
        if (ordem.status === "Pendente") cur.pendentes += 1;
        if (ordem.status === "EmExecucao") cur.emExecucao += 1;
        byFiscal.set(ordem.fiscalId, cur);
      }
      return [...byFiscal.values()];
    }),
    paradasPorPolo: vi.fn(async (where: Record<string, unknown>, updatedBefore: Date) => {
      const byPolo = new Map<string, { regiao: string | null; poloId: string; total: number; oldestUpdatedAt: Date }>();
      for (const o of paradas(scoped(where), updatedBefore)) {
        const cur = byPolo.get(o.poloId) ?? {
          regiao: o.regiaoAdministrativa,
          poloId: o.poloId,
          total: 0,
          oldestUpdatedAt: o.updatedAt
        };
        cur.total += 1;
        if (o.updatedAt < cur.oldestUpdatedAt) cur.oldestUpdatedAt = o.updatedAt;
        byPolo.set(o.poloId, cur);
      }
      return [...byPolo.values()];
    }),
    paradasDetalhe: vi.fn(
      async (where: Record<string, unknown>, updatedBefore: Date, pagination: { skip: number; take: number }) => {
        const all = paradas(scoped(where), updatedBefore).sort(
          (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()
        );
        const rows = all
          .slice(pagination.skip, pagination.skip + pagination.take)
          .map((o) => ({
            id: o.id,
            numero: o.numero,
            status: o.status,
            updatedAt: o.updatedAt,
            dataFimExecucao: o.dataFimExecucao
          }));
        return { rows, total: all.length };
      }
    ),
    findPolos: vi.fn(async (ids: string[]) => ids.map((id) => ({ id, nome: `Polo ${id}` }))),
    contarEntradas: vi.fn(async (where: Record<string, unknown>, periodo: Periodo) =>
      scoped(where).filter((o) => inWindow(o.createdAt, periodo)).length
    ),
    contarConcluidas: vi.fn(async (where: Record<string, unknown>, periodo: Periodo) =>
      scoped(where).filter((o) => inWindow(o.concluidaEm, periodo)).length
    ),
    contarAnalisadas: vi.fn(async (where: Record<string, unknown>, periodo: Periodo) =>
      tabulacoes.filter((t) => matchesWhere(t.ordem, where) && inWindow(t.createdAt, periodo)).length
    ),
    agruparPorRegiao: vi.fn(async (where: Record<string, unknown>, periodo: Periodo) => {
      const byRegiao = new Map<string | null, { chave: string | null; entradas: number; concluidas: number }>();
      for (const ordem of scoped(where)) {
        const entrou = inWindow(ordem.createdAt, periodo);
        const concluiu = inWindow(ordem.concluidaEm, periodo);
        if (!entrou && !concluiu) continue;
        const cur = byRegiao.get(ordem.regiaoAdministrativa) ?? { chave: ordem.regiaoAdministrativa, entradas: 0, concluidas: 0 };
        if (entrou) cur.entradas += 1;
        if (concluiu) cur.concluidas += 1;
        byRegiao.set(ordem.regiaoAdministrativa, cur);
      }
      return [...byRegiao.values()];
    }),
    desempenhoPorFiscal: vi.fn(async (where: Record<string, unknown>, periodo: Periodo) => {
      const byFiscal = new Map<string, { fiscalId: string; concluidas: number; analisadas: number }>();
      for (const ordem of scoped(where)) {
        if (ordem.fiscalId && inWindow(ordem.concluidaEm, periodo)) {
          const cur = byFiscal.get(ordem.fiscalId) ?? { fiscalId: ordem.fiscalId, concluidas: 0, analisadas: 0 };
          cur.concluidas += 1;
          byFiscal.set(ordem.fiscalId, cur);
        }
      }
      for (const tab of tabulacoes) {
        if (tab.ordem.fiscalId && matchesWhere(tab.ordem, where) && inWindow(tab.createdAt, periodo)) {
          const cur = byFiscal.get(tab.ordem.fiscalId) ?? { fiscalId: tab.ordem.fiscalId, concluidas: 0, analisadas: 0 };
          cur.analisadas += 1;
          byFiscal.set(tab.ordem.fiscalId, cur);
        }
      }
      return [...byFiscal.values()];
    }),
    contarFiscaisAtivos: vi.fn(async (where: Record<string, unknown>, periodo: Periodo) => {
      const ativos = new Set<string>();
      for (const ordem of scoped(where)) {
        if (ordem.fiscalId && inWindow(ordem.concluidaEm, periodo)) ativos.add(ordem.fiscalId);
      }
      for (const tab of tabulacoes) {
        if (tab.ordem.fiscalId && matchesWhere(tab.ordem, where) && inWindow(tab.createdAt, periodo)) {
          ativos.add(tab.ordem.fiscalId);
        }
      }
      return ativos.size;
    }),
    findGeoFacets: vi.fn(async (where: Record<string, unknown>) => {
      const seen = new Set<string>();
      const facets: Array<{
        regiaoAdministrativa: string | null;
        poloId: string | null;
        poloNome: string | null;
        cidade: string | null;
      }> = [];
      for (const ordem of scoped(where)) {
        const key = `${ordem.regiaoAdministrativa}__${ordem.poloId}__${ordem.cidade}`;
        if (seen.has(key)) continue;
        seen.add(key);
        facets.push({
          regiaoAdministrativa: ordem.regiaoAdministrativa,
          poloId: ordem.poloId,
          poloNome: `Polo ${ordem.poloId}`,
          cidade: ordem.cidade
        });
      }
      return facets;
    }),
    mesesDisponiveis: vi.fn(async (where: Record<string, unknown>) =>
      scoped(where).map((o) => o.createdAt)
    ),
    findFiscais: vi.fn(async (ids: string[]) =>
      ids.map((id) => ({ id, name: `Fiscal ${id}`, matricula: id.toUpperCase(), regiao: null }))
    ),
    findMonitores: vi.fn(async () => [])
  };
}

describe("getDashboardResumo", () => {
  it("loads OS using the requester scope (monitor → assigned polos)", async () => {
    const repo = repository([]);

    await getDashboardResumo(repo, { id: "m1", perfil: "monitor", polosPermitidos: ["p1"] });

    expect(repo.countByStatus).toHaveBeenCalledWith({ poloId: { in: ["p1"] } });
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
      { fiscalId: "f1", name: "Fiscal f1", matricula: "F1", total: 2, concluidas: 1, pendentes: 1, emExecucao: 0, percentualConclusao: 0.5 },
      { fiscalId: "f2", name: "Fiscal f2", matricula: "F2", total: 1, concluidas: 0, pendentes: 0, emExecucao: 1, percentualConclusao: 0 }
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

    expect(repo.countByStatus).toHaveBeenCalledWith({ regiaoAdministrativa: "Registro" });
    expect(resumo.metricas.total).toBe(2);
    expect(resumo.filtros).toEqual({ regiao: "Registro" });
    // Options are built from the full scope, not the narrowed filter.
    expect(resumo.opcoesGeograficas).toEqual([
      { regiao: "São Paulo", polos: [{ id: "p1", nome: "Polo p1", municipios: ["GUARULHOS"] }] },
      { regiao: "Registro", polos: [{ id: "p1", nome: "Polo p1", municipios: ["MIRACATU", "REGISTRO"] }] }
    ]);
  });

  it("narrows by polo within the access scope", async () => {
    const repo = repository([
      os({ id: "1", poloId: "p1", regiaoAdministrativa: "Registro" }),
      os({ id: "2", poloId: "p2", regiaoAdministrativa: "Registro" }),
      os({ id: "3", poloId: "p1", regiaoAdministrativa: "Registro" })
    ]);

    const resumo = await getDashboardResumo(
      repo,
      { id: "s1", perfil: "supervisor" },
      new Date("2026-06-07T10:00:00.000Z"),
      { regiao: "Registro", polo: "p1" }
    );

    expect(repo.countByStatus).toHaveBeenCalledWith({ regiaoAdministrativa: "Registro", poloId: "p1" });
    expect(resumo.metricas.total).toBe(2);
    expect(resumo.filtros).toEqual({ regiao: "Registro", polo: "p1" });
  });

  it("groups municipalities per polo inside each região", async () => {
    const repo = repository([
      os({ id: "1", poloId: "p1", cidade: "MIRACATU", regiaoAdministrativa: "Registro" }),
      os({ id: "2", poloId: "p2", cidade: "REGISTRO", regiaoAdministrativa: "Registro" }),
      os({ id: "3", poloId: "p2", cidade: "IGUAPE", regiaoAdministrativa: "Registro" })
    ]);

    const resumo = await getDashboardResumo(repo, { id: "s1", perfil: "supervisor" });

    expect(resumo.opcoesGeograficas).toEqual([
      {
        regiao: "Registro",
        polos: [
          { id: "p1", nome: "Polo p1", municipios: ["MIRACATU"] },
          { id: "p2", nome: "Polo p2", municipios: ["IGUAPE", "REGISTRO"] }
        ]
      }
    ]);
  });

  it("narrows by municipality and keeps the access scope (monitor cannot read other polos)", async () => {
    const repo = repository([
      os({ id: "1", cidade: "MIRACATU", poloId: "p1" }),
      os({ id: "2", cidade: "REGISTRO", poloId: "p1" }),
      os({ id: "3", cidade: "MIRACATU", poloId: "polo-x" })
    ]);

    const resumo = await getDashboardResumo(
      repo,
      { id: "m1", perfil: "monitor", polosPermitidos: ["p1"] },
      new Date("2026-06-07T10:00:00.000Z"),
      { municipio: "MIRACATU" }
    );

    expect(repo.countByStatus).toHaveBeenCalledWith({
      poloId: { in: ["p1"] },
      cidade: "MIRACATU"
    });
    // Only the in-scope (polo p1) MIRACATU OS, not the polo-x one.
    expect(resumo.metricas.total).toBe(1);
  });

  it("builds the entered × analyzed × concluída funnel and per-região roll-up for the window", async () => {
    const dia = new Date("2026-06-08T12:00:00.000Z");
    const ordens = [
      // entered today, concluded today, Registro
      os({ id: "1", regiaoAdministrativa: "Registro", createdAt: dia, concluidaEm: dia, status: "Concluida" }),
      // entered today, not concluded, Registro
      os({ id: "2", regiaoAdministrativa: "Registro", createdAt: dia, status: "NaFila" }),
      // entered today, São Paulo
      os({ id: "3", regiaoAdministrativa: "São Paulo", createdAt: dia, status: "NaFila" }),
      // entered yesterday — outside the window
      os({ id: "4", regiaoAdministrativa: "Registro", createdAt: new Date("2026-06-07T12:00:00.000Z"), status: "NaFila" })
    ];
    const tabulacoes = [
      { createdAt: dia, ordem: ordens[0] },
      { createdAt: new Date("2026-06-07T09:00:00.000Z"), ordem: ordens[3] } // outside window
    ];
    const repo = repository(ordens, tabulacoes);

    const resumo = await getDashboardResumo(
      repo,
      { id: "s1", perfil: "supervisor" },
      new Date("2026-06-08T20:00:00.000Z")
    );

    expect(resumo.funnel).toEqual({ entradas: 3, analisadas: 1, concluidas: 1, percentualConclusao: 1 / 3 });
    expect(resumo.porRegiao).toEqual([
      { regiao: "Registro", entradas: 2, concluidas: 1 },
      { regiao: "São Paulo", entradas: 1, concluidas: 0 }
    ]);
    expect(resumo.periodo.to).toEqual(new Date("2026-06-08T20:00:00.000Z"));
  });

  it("reports per-fiscal performance and the active-fiscais count for the window", async () => {
    const dia = new Date("2026-06-08T12:00:00.000Z");
    const ordens = [
      os({ id: "1", fiscalId: "f1", status: "Concluida", concluidaEm: dia }),
      os({ id: "2", fiscalId: "f1", status: "Concluida", concluidaEm: dia }),
      os({ id: "3", fiscalId: "f2", status: "Concluida", concluidaEm: dia }),
      // concluded outside the window — ignored
      os({ id: "4", fiscalId: "f3", status: "Concluida", concluidaEm: new Date("2026-06-01T12:00:00.000Z") })
    ];
    const tabulacoes = [{ createdAt: dia, ordem: ordens[2] }]; // f2 analyzed one
    const repo = repository(ordens, tabulacoes);

    const resumo = await getDashboardResumo(
      repo,
      { id: "s1", perfil: "supervisor" },
      new Date("2026-06-08T20:00:00.000Z")
    );

    expect(resumo.fiscaisAtivos).toBe(2); // f1 and f2 (f3 concluded outside window)
    expect(resumo.desempenhoFiscais).toEqual([
      { fiscalId: "f1", name: "Fiscal f1", matricula: "F1", concluidas: 2, analisadas: 0 },
      { fiscalId: "f2", name: "Fiscal f2", matricula: "F2", concluidas: 1, analisadas: 1 }
    ]);
  });

  it("organizes performance into a Região → Monitor → Fiscal tree", async () => {
    const dia = new Date("2026-06-08T12:00:00.000Z");
    const ordens = [
      os({ id: "1", fiscalId: "f1", status: "Concluida", concluidaEm: dia }),
      os({ id: "2", fiscalId: "f2", status: "Concluida", concluidaEm: dia })
    ];
    const repo = repository(ordens);
    repo.findFiscais = vi.fn(async (ids: string[]) =>
      ids.map((id) => ({
        id,
        name: `Fiscal ${id}`,
        matricula: id.toUpperCase(),
        regiao: id === "f1" ? "Campinas" : "Santos"
      }))
    );
    repo.findMonitores = vi.fn(async () => [
      { id: "m1", name: "Ana", matricula: "M0001", regiao: "Campinas" }
    ]);

    const resumo = await getDashboardResumo(
      repo,
      { id: "s1", perfil: "supervisor" },
      new Date("2026-06-08T20:00:00.000Z")
    );

    expect(resumo.arvoreDesempenho).toEqual([
      {
        regiao: "Campinas",
        monitores: [{ name: "Ana", matricula: "M0001" }],
        fiscais: [{ fiscalId: "f1", name: "Fiscal f1", matricula: "F1", concluidas: 1, analisadas: 0 }]
      },
      {
        regiao: "Santos",
        monitores: [],
        fiscais: [{ fiscalId: "f2", name: "Fiscal f2", matricula: "F2", concluidas: 1, analisadas: 0 }]
      }
    ]);
  });

  it("computes fixed today and month progress independent of the filter period", async () => {
    const now = new Date("2026-06-12T20:00:00.000Z");
    const hoje = new Date("2026-06-12T09:00:00.000Z");
    const inicioMes = new Date("2026-06-03T09:00:00.000Z");
    const mesPassado = new Date("2026-05-20T09:00:00.000Z");
    const ordens = [
      os({ id: "1", status: "Concluida", concluidaEm: hoje, createdAt: hoje }),
      os({ id: "2", status: "Concluida", concluidaEm: inicioMes, createdAt: inicioMes }),
      os({ id: "3", status: "Concluida", concluidaEm: mesPassado, createdAt: mesPassado })
    ];
    const repo = repository(ordens);

    // Filtro restrito ao mês passado — os cards fixos de hoje/mês devem ignorá-lo.
    const resumo = await getDashboardResumo(repo, { id: "s1", perfil: "supervisor" }, now, {
      from: new Date("2026-05-01T00:00:00.000Z"),
      to: new Date("2026-05-31T23:59:59.000Z")
    });

    expect(resumo.progressoHoje).toEqual({ entradas: 1, analisadas: 0, concluidas: 1 });
    expect(resumo.progressoMes).toEqual({ entradas: 2, analisadas: 0, concluidas: 2 });
  });

  it("summarises the backlog per polo (count + oldest dias) without a polo filter", async () => {
    const fim = new Date("2026-06-04T10:00:00.000Z");
    const repo = repository([
      // p1: two stalled (oldest 2 dias), one terminal (ignored), one recent (ignored)
      os({ id: "a", poloId: "p1", regiaoAdministrativa: "Registro", status: "Pendente", dataFimExecucao: fim, updatedAt: new Date("2026-06-05T10:00:00.000Z") }),
      os({ id: "b", poloId: "p1", regiaoAdministrativa: "Registro", status: "EmExecucao", dataFimExecucao: fim, updatedAt: new Date("2026-06-05T08:00:00.000Z") }),
      os({ id: "c", poloId: "p1", regiaoAdministrativa: "Registro", status: "Concluida", dataFimExecucao: fim, updatedAt: new Date("2026-06-01T09:00:00.000Z") }),
      os({ id: "d", poloId: "p1", regiaoAdministrativa: "Registro", status: "Pendente", dataFimExecucao: fim, updatedAt: new Date("2026-06-07T09:00:00.000Z") }),
      // p2: one stalled (3 dias); also an OS with no fim execução (ignored)
      os({ id: "e", poloId: "p2", regiaoAdministrativa: "Santos", status: "Pendente", dataFimExecucao: fim, updatedAt: new Date("2026-06-04T08:00:00.000Z") }),
      os({ id: "f", poloId: "p2", regiaoAdministrativa: "Santos", status: "Pendente", dataFimExecucao: null, updatedAt: new Date("2026-06-04T08:00:00.000Z") })
    ]);

    const resumo = await getDashboardResumo(repo, { id: "s1", perfil: "supervisor" }, new Date("2026-06-07T10:00:00.000Z"));

    // Sorted by maxDias desc: p2 (3 dias) before p1 (2 dias).
    expect(resumo.paradas.porPolo).toEqual([
      { regiao: "Santos", poloId: "p2", poloNome: "Polo p2", total: 1, maxDias: 3 },
      { regiao: "Registro", poloId: "p1", poloNome: "Polo p1", total: 2, maxDias: 2 }
    ]);
    expect(resumo.paradas.detalhe).toBeNull();
  });

  it("lists the paginated stalled OS for the selected polo, with the fim-execução date", async () => {
    const fim = new Date("2026-06-04T10:00:00.000Z");
    const ordens = Array.from({ length: 12 }, (_, i) =>
      os({
        id: `os${i}`,
        numero: `10${String(i).padStart(2, "0")}`,
        poloId: "p1",
        regiaoAdministrativa: "Registro",
        status: "Pendente",
        dataFimExecucao: fim,
        updatedAt: new Date(`2026-06-05T${String(i).padStart(2, "0")}:00:00.000Z`)
      })
    );
    const repo = repository(ordens);

    const resumo = await getDashboardResumo(
      repo,
      { id: "s1", perfil: "supervisor" },
      new Date("2026-06-07T10:00:00.000Z"),
      { regiao: "Registro", polo: "p1", page: 2 }
    );

    expect(resumo.paradas.detalhe).not.toBeNull();
    expect(resumo.paradas.detalhe!.total).toBe(12);
    expect(resumo.paradas.detalhe!.page).toBe(2);
    expect(resumo.paradas.detalhe!.pageSize).toBe(10);
    // Page 2 holds the remaining 2 rows.
    expect(resumo.paradas.detalhe!.rows).toHaveLength(2);
    expect(resumo.paradas.detalhe!.rows[0]).toMatchObject({
      dataFimExecucao: fim,
      diasParada: 2,
      status: "Pendente"
    });
  });

  it("lista os meses importados (MM/YY) do mais recente ao mais antigo", async () => {
    const repo = repository([
      os({ id: "a", createdAt: new Date("2026-06-07T10:00:00.000Z") }),
      os({ id: "b", createdAt: new Date("2026-06-20T10:00:00.000Z") }),
      os({ id: "c", createdAt: new Date("2026-04-01T10:00:00.000Z") })
    ]);

    const resumo = await getDashboardResumo(repo, { id: "s1", perfil: "supervisor" });

    expect(resumo.mesesDisponiveis).toEqual([
      { value: "2026-06", label: "06/26" },
      { value: "2026-04", label: "04/26" }
    ]);
  });
});

describe("mesesDisponiveisDe", () => {
  it("deduplica meses e os formata como MM/YY, do mais recente ao mais antigo", () => {
    expect(
      mesesDisponiveisDe([
        new Date(2025, 11, 31, 12),
        new Date(2026, 0, 15, 9),
        new Date(2026, 0, 2, 9)
      ])
    ).toEqual([
      { value: "2026-01", label: "01/26" },
      { value: "2025-12", label: "12/25" }
    ]);
  });

  it("retorna vazio quando não há datas", () => {
    expect(mesesDisponiveisDe([])).toEqual([]);
  });
});
