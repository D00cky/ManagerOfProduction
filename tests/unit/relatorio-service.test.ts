import { describe, expect, it, vi } from "vitest";
import type { Conceito } from "@prisma/client";
import {
  exportRelatorioCsv,
  getRelatorio,
  type ConceitoCount,
  type FiscalQualidade,
  type RelatorioOverall,
  type RelatorioRepository
} from "@/server/relatorio-service";

function repo(options: {
  overall?: RelatorioOverall;
  conceitos?: ConceitoCount[];
  porFiscal?: FiscalQualidade[];
}): RelatorioRepository {
  return {
    overall: vi.fn(async () => options.overall ?? { total: 0, mediaPercentual: 0 }),
    countByConceito: vi.fn(async () => options.conceitos ?? []),
    mediaPorFiscal: vi.fn(async () => options.porFiscal ?? [])
  };
}

describe("getRelatorio", () => {
  it("denies users without the relatorios:read capability", async () => {
    const repository = repo({});

    await expect(getRelatorio(repository, { id: "f1", perfil: "fiscal", poloId: "p1" })).rejects.toThrow(
      "Sem permissao para ver relatorios"
    );
    expect(repository.overall).not.toHaveBeenCalled();
  });

  it("scopes a monitor to their whole região", async () => {
    const repository = repo({});

    await getRelatorio(repository, { id: "m1", perfil: "monitor", regiao: "Campinas" });

    const expected = { regiaoAdministrativa: { in: ["Campinas"] } };
    expect(repository.overall).toHaveBeenCalledWith(expected);
    expect(repository.countByConceito).toHaveBeenCalledWith(expected);
    expect(repository.mediaPorFiscal).toHaveBeenCalledWith(expected);
  });

  it("returns zeros when there are no tabulations", async () => {
    const repository = repo({});

    const resumo = await getRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(resumo.totalAvaliadas).toBe(0);
    expect(resumo.mediaPercentual).toBe(0);
    expect(resumo.conceitos).toEqual({ A: 0, B: 0, C: 0, D: 0, NaoAvaliado: 0 });
    expect(resumo.porFiscal).toEqual([]);
  });

  it("zero-fills the concept distribution and sorts per-fiscal quality", async () => {
    const repository = repo({
      overall: { total: 4, mediaPercentual: 0.575 },
      conceitos: [
        { conceito: "A" as Conceito, count: 1 },
        { conceito: "C" as Conceito, count: 1 },
        { conceito: "B" as Conceito, count: 1 },
        { conceito: "NaoAvaliado" as Conceito, count: 1 }
      ],
      porFiscal: [
        { fiscalId: "f2", total: 2, mediaPercentual: 0.4 },
        { fiscalId: "f1", total: 2, mediaPercentual: 0.75 }
      ]
    });

    const resumo = await getRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(resumo.totalAvaliadas).toBe(4);
    expect(resumo.conceitos).toEqual({ A: 1, B: 1, C: 1, D: 0, NaoAvaliado: 1 });
    expect(resumo.mediaPercentual).toBeCloseTo(0.575, 5);
    expect(resumo.porFiscal).toEqual([
      { fiscalId: "f1", total: 2, mediaPercentual: 0.75 },
      { fiscalId: "f2", total: 2, mediaPercentual: 0.4 }
    ]);
  });

  it("exports scoped report rows as CSV", async () => {
    const repository = repo({
      porFiscal: [{ fiscalId: "f1", total: 2, mediaPercentual: 0.75 }]
    });

    const csv = await exportRelatorioCsv(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(csv).toBe("Fiscal,Tabulacoes,Media FFR\nf1,2,75.00%");
  });
});
