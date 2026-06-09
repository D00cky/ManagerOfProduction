import { describe, expect, it, vi } from "vitest";
import type { StatusOS } from "@prisma/client";
import { getFiscalHome, resumoFiscal, type FiscalRepository } from "@/server/fiscal-service";

type StatusCount = { status: StatusOS; count: number };

describe("resumoFiscal", () => {
  it("folds per-status counts into imported/concluded/remaining", () => {
    const resumo = resumoFiscal([
      { status: "NaFila", count: 3 },
      { status: "EmExecucao", count: 1 },
      { status: "Pendente", count: 2 },
      { status: "Concluida", count: 4 },
      { status: "Cancelada", count: 1 }
    ]);
    expect(resumo).toEqual({ total: 11, concluidas: 4, restantes: 6, canceladas: 1 });
  });

  it("defaults missing statuses to zero", () => {
    expect(resumoFiscal([{ status: "Concluida", count: 2 }])).toEqual({
      total: 2,
      concluidas: 2,
      restantes: 0,
      canceladas: 0
    });
  });
});

describe("getFiscalHome", () => {
  it("returns the resumo and the next OS id for the fiscal", async () => {
    const repository: FiscalRepository = {
      contarPorStatus: vi.fn(
        async (): Promise<StatusCount[]> => [
          { status: "NaFila", count: 2 },
          { status: "Concluida", count: 1 }
        ]
      ),
      proximaOrdem: vi.fn(async () => ({ id: "os-9", numero: "9001" }))
    };

    const home = await getFiscalHome(repository, { id: "f1", perfil: "fiscal", poloId: "p1" });

    expect(repository.contarPorStatus).toHaveBeenCalledWith("f1");
    expect(home.proximaOrdemId).toBe("os-9");
    expect(home.resumo).toEqual({ total: 3, concluidas: 1, restantes: 2, canceladas: 0 });
  });

  it("reports no next OS when the backlog is empty", async () => {
    const repository: FiscalRepository = {
      contarPorStatus: vi.fn(async () => []),
      proximaOrdem: vi.fn(async () => null)
    };

    const home = await getFiscalHome(repository, { id: "f1", perfil: "fiscal", poloId: "p1" });

    expect(home.proximaOrdemId).toBeNull();
    expect(home.resumo.total).toBe(0);
  });
});
