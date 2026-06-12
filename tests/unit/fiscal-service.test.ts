import { describe, expect, it, vi } from "vitest";
import type { StatusOS, TipoServico } from "@prisma/client";
import {
  getFiscalDesempenho,
  getFiscalHome,
  resumoFiscal,
  type FiscalRepository
} from "@/server/fiscal-service";

type StatusCount = { status: StatusOS; count: number };

function repository(overrides: Partial<FiscalRepository> = {}): FiscalRepository {
  return {
    contarPorStatus: vi.fn(async (): Promise<StatusCount[]> => []),
    proximaOrdem: vi.fn(async () => null),
    contarConcluidasNoPeriodo: vi.fn(async () => 0),
    contarConcluidasPorTipoNoPeriodo: vi.fn(async () => []),
    ...overrides
  };
}

const FISCAL = { id: "f1", perfil: "fiscal" as const, poloId: "p1" };

describe("resumoFiscal", () => {
  it("folds per-status counts into imported/concluded/remaining/na fila", () => {
    const resumo = resumoFiscal([
      { status: "NaFila", count: 3 },
      { status: "EmExecucao", count: 1 },
      { status: "Pendente", count: 2 },
      { status: "Concluida", count: 4 },
      { status: "Cancelada", count: 1 }
    ]);
    expect(resumo).toEqual({ total: 11, concluidas: 4, restantes: 6, canceladas: 1, naFila: 3 });
  });

  it("defaults missing statuses to zero", () => {
    expect(resumoFiscal([{ status: "Concluida", count: 2 }])).toEqual({
      total: 2,
      concluidas: 2,
      restantes: 0,
      canceladas: 0,
      naFila: 0
    });
  });
});

describe("getFiscalHome", () => {
  it("returns the resumo, today's completions and the next OS id for the fiscal", async () => {
    const repo = repository({
      contarPorStatus: vi.fn(async () => [
        { status: "NaFila", count: 2 },
        { status: "Concluida", count: 1 }
      ]),
      proximaOrdem: vi.fn(async () => ({ id: "os-9", numero: "9001" })),
      contarConcluidasNoPeriodo: vi.fn(async () => 1)
    });
    const now = new Date("2026-06-12T15:00:00.000Z");

    const home = await getFiscalHome(repo, FISCAL, now);

    expect(repo.contarPorStatus).toHaveBeenCalledWith("f1");
    expect(home.proximaOrdemId).toBe("os-9");
    expect(home.resumo).toEqual({ total: 3, concluidas: 1, restantes: 2, canceladas: 0, naFila: 2 });
    expect(home.concluidasHoje).toBe(1);
    // Janela de "hoje": início do dia até agora.
    expect(repo.contarConcluidasNoPeriodo).toHaveBeenCalledWith(
      "f1",
      new Date("2026-06-12T00:00:00.000Z"),
      now
    );
  });

  it("reports no next OS when the backlog is empty", async () => {
    const home = await getFiscalHome(repository(), FISCAL, new Date("2026-06-12T15:00:00.000Z"));

    expect(home.proximaOrdemId).toBeNull();
    expect(home.resumo.total).toBe(0);
    expect(home.concluidasHoje).toBe(0);
  });
});

describe("getFiscalDesempenho", () => {
  it("returns today, month and per-tipo completions over the right windows", async () => {
    const porTipo: Array<{ tipoServico: TipoServico; count: number }> = [
      { tipoServico: "RedeRamalAgua", count: 5 },
      { tipoServico: "Desobstrucao", count: 2 }
    ];
    const repo = repository({
      contarPorStatus: vi.fn(async () => [
        { status: "NaFila", count: 4 },
        { status: "Concluida", count: 7 }
      ]),
      // Primeira chamada: hoje; segunda: mês.
      contarConcluidasNoPeriodo: vi.fn(async () => 0).mockResolvedValueOnce(2).mockResolvedValueOnce(7),
      contarConcluidasPorTipoNoPeriodo: vi.fn(async () => porTipo)
    });
    const now = new Date("2026-06-12T15:00:00.000Z");

    const desempenho = await getFiscalDesempenho(repo, FISCAL, now);

    expect(desempenho.importadas).toBe(11);
    expect(desempenho.naFila).toBe(4);
    expect(desempenho.concluidasHoje).toBe(2);
    expect(desempenho.concluidasMes).toBe(7);
    expect(desempenho.porTipo).toEqual(porTipo);

    expect(repo.contarConcluidasNoPeriodo).toHaveBeenNthCalledWith(
      1,
      "f1",
      new Date("2026-06-12T00:00:00.000Z"),
      now
    );
    expect(repo.contarConcluidasNoPeriodo).toHaveBeenNthCalledWith(
      2,
      "f1",
      new Date("2026-06-01T00:00:00.000Z"),
      now
    );
    expect(repo.contarConcluidasPorTipoNoPeriodo).toHaveBeenCalledWith(
      "f1",
      new Date("2026-06-01T00:00:00.000Z"),
      now
    );
  });
});
