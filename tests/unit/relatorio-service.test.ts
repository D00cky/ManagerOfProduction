import { describe, expect, it, vi } from "vitest";
import type { Conceito } from "@prisma/client";
import {
  exportRelatorioCsv,
  getRelatorio,
  type RelatorioRepository,
  type RelatorioTabulacao
} from "@/server/relatorio-service";

function tab(overrides: Partial<RelatorioTabulacao> = {}): RelatorioTabulacao {
  return { conceito: "A" as Conceito, percentual: 1, fiscalId: "f1", ...overrides };
}

function repo(tabulacoes: RelatorioTabulacao[]): RelatorioRepository {
  return { findTabulacoes: vi.fn(async () => tabulacoes) };
}

describe("getRelatorio", () => {
  it("denies users without the relatorios:read capability", async () => {
    const repository = repo([]);

    await expect(getRelatorio(repository, { id: "f1", perfil: "fiscal", poloId: "p1" })).rejects.toThrow(
      "Sem permissao para ver relatorios"
    );
    expect(repository.findTabulacoes).not.toHaveBeenCalled();
  });

  it("scopes a monitor to their authorized polos", async () => {
    const repository = repo([]);

    await getRelatorio(repository, {
      id: "m1",
      perfil: "monitor",
      poloId: "p1",
      polosPermitidos: ["p1", "p2"]
    });

    expect(repository.findTabulacoes).toHaveBeenCalledWith({ poloId: { in: ["p1", "p2"] } });
  });

  it("returns zeros when there are no tabulations", async () => {
    const repository = repo([]);

    const resumo = await getRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(resumo.totalAvaliadas).toBe(0);
    expect(resumo.mediaPercentual).toBe(0);
    expect(resumo.conceitos).toEqual({ A: 0, B: 0, C: 0, D: 0, NaoAvaliado: 0 });
    expect(resumo.porFiscal).toEqual([]);
  });

  it("aggregates concept distribution, average and per-fiscal quality", async () => {
    const repository = repo([
      tab({ conceito: "A", percentual: 1, fiscalId: "f1" }),
      tab({ conceito: "C", percentual: 0.5, fiscalId: "f1" }),
      tab({ conceito: "B", percentual: 0.8, fiscalId: "f2" }),
      tab({ conceito: "NaoAvaliado", percentual: 0, fiscalId: "f2" })
    ]);

    const resumo = await getRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(resumo.totalAvaliadas).toBe(4);
    expect(resumo.conceitos).toEqual({ A: 1, B: 1, C: 1, D: 0, NaoAvaliado: 1 });
    expect(resumo.mediaPercentual).toBeCloseTo((1 + 0.5 + 0.8 + 0) / 4, 5);
    expect(resumo.porFiscal).toEqual([
      { fiscalId: "f1", total: 2, mediaPercentual: 0.75 },
      { fiscalId: "f2", total: 2, mediaPercentual: 0.4 }
    ]);
  });

  it("exports scoped report rows as CSV", async () => {
    const repository = repo([
      tab({ conceito: "A", percentual: 1, fiscalId: "f1" }),
      tab({ conceito: "C", percentual: 0.5, fiscalId: "f1" })
    ]);

    const csv = await exportRelatorioCsv(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(csv).toBe("Fiscal,Tabulacoes,Media FFR\nf1,2,75.00%");
  });
});
