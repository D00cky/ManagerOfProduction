import { describe, expect, it, vi } from "vitest";
import type { Conceito } from "@prisma/client";
import {
  exportRelatorioCsv,
  getRelatorio,
  type ConceitoCount,
  type FiscalInfo,
  type FiscalQualidade,
  type RelatorioOverall,
  type RelatorioRepository,
  type TabulacaoBreakdownRow
} from "@/server/relatorio-service";

function repo(options: {
  overall?: RelatorioOverall;
  conceitos?: ConceitoCount[];
  porFiscal?: FiscalQualidade[];
  fiscais?: FiscalInfo[];
  breakdown?: TabulacaoBreakdownRow[];
}): RelatorioRepository {
  return {
    overall: vi.fn(async () => options.overall ?? { total: 0, mediaPercentual: 0 }),
    countByConceito: vi.fn(async () => options.conceitos ?? []),
    mediaPorFiscal: vi.fn(async () => options.porFiscal ?? []),
    findFiscais: vi.fn(async () => options.fiscais ?? []),
    listTabulacoesParaBreakdown: vi.fn(async () => options.breakdown ?? [])
  };
}

function breakdownRow(over: Partial<TabulacaoBreakdownRow>): TabulacaoBreakdownRow {
  return {
    percentual: 0,
    respostas: {},
    tipoServico: "RedeRamalAgua",
    descricaoTss: null,
    regiaoAdministrativa: null,
    poloNome: null,
    poloCodigo: null,
    codigoContrato: null,
    descricaoContrato: null,
    ...over
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
    expect(repository.listTabulacoesParaBreakdown).toHaveBeenCalledWith(expected);
  });

  it("groups performance and IQES by região, polo and contratada", async () => {
    const repository = repo({
      breakdown: [
        // METROPOLITANA / Polo Leste / Contratada A: 3 conforme, 1 não conforme -> IQES 75%
        breakdownRow({
          percentual: 0.8,
          regiaoAdministrativa: "METROPOLITANA",
          poloNome: "Polo Leste",
          descricaoContrato: "Contratada A",
          respostas: { gerais_q1: "1", gerais_q3: "1", ramal_agua_q3: "1", gerais_q2: "0" }
        }),
        // METROPOLITANA / Polo Leste / Contratada A again: 1 conforme, 1 não conforme
        breakdownRow({
          percentual: 0.6,
          regiaoAdministrativa: "METROPOLITANA",
          poloNome: "Polo Leste",
          descricaoContrato: "Contratada A",
          respostas: { gerais_q1: "1", gerais_q2: "0" }
        }),
        // BAIXADA / Polo Sul / Contratada A (same name, other região -> separate row)
        breakdownRow({
          percentual: 1,
          regiaoAdministrativa: "BAIXADA SANTISTA",
          poloNome: "Polo Sul",
          descricaoContrato: "Contratada A",
          respostas: { gerais_q1: "1", gerais_q2: "1" }
        })
      ]
    });

    const resumo = await getRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    // Região: METROPOLITANA aggregates 4 conforme + 2 não-conforme -> 4/6
    const metro = resumo.porRegiao.find((r) => r.nome === "METROPOLITANA");
    expect(metro).toMatchObject({ total: 2, mediaPercentual: 0.7 });
    expect(metro?.iqes).toBeCloseTo(4 / 6, 5);

    // Polo Leste mirrors METROPOLITANA here
    const leste = resumo.porPolo.find((p) => p.nome === "Polo Leste");
    expect(leste).toMatchObject({ total: 2 });
    expect(leste?.iqes).toBeCloseTo(4 / 6, 5);

    // Contratada A split per região: two distinct rows
    const contratadaA = resumo.porContratada.filter((c) => c.nome === "Contratada A");
    expect(contratadaA).toHaveLength(2);
    const metroA = contratadaA.find((c) => c.regiao === "METROPOLITANA");
    expect(metroA).toMatchObject({ total: 2 });
    expect(metroA?.iqes).toBeCloseTo(4 / 6, 5);
    const baixadaA = contratadaA.find((c) => c.regiao === "BAIXADA SANTISTA");
    expect(baixadaA).toMatchObject({ total: 1, iqes: 1 });
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
      ],
      fiscais: [
        { id: "f1", name: "Ana", matricula: "F0001" },
        { id: "f2", name: "Bruno", matricula: "F0002" }
      ]
    });

    const resumo = await getRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(resumo.totalAvaliadas).toBe(4);
    expect(resumo.conceitos).toEqual({ A: 1, B: 1, C: 1, D: 0, NaoAvaliado: 1 });
    expect(resumo.mediaPercentual).toBeCloseTo(0.575, 5);
    // Resolved to name + matrícula and sorted by name (Ana before Bruno).
    expect(resumo.porFiscal).toEqual([
      { fiscalId: "f1", name: "Ana", matricula: "F0001", total: 2, mediaPercentual: 0.75 },
      { fiscalId: "f2", name: "Bruno", matricula: "F0002", total: 2, mediaPercentual: 0.4 }
    ]);
  });

  it("exports scoped report rows as CSV with name + matrícula and a contratada/IQES section", async () => {
    const repository = repo({
      porFiscal: [{ fiscalId: "f1", total: 2, mediaPercentual: 0.75 }],
      fiscais: [{ id: "f1", name: "Ana", matricula: "F0001" }],
      breakdown: [
        breakdownRow({
          percentual: 0.75,
          regiaoAdministrativa: "METROPOLITANA",
          descricaoContrato: "Contratada A",
          respostas: { gerais_q1: "1", gerais_q3: "1", ramal_agua_q3: "1", gerais_q2: "0" }
        })
      ]
    });

    const csv = await exportRelatorioCsv(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(csv).toBe(
      [
        "Fiscal,Matricula,Tabulacoes,Media FFR",
        "Ana,F0001,2,75.00%",
        "",
        "Regiao,Contratada,Tabulacoes,Media FFR,IQES",
        "METROPOLITANA,Contratada A,1,75.00%,75.00%"
      ].join("\n")
    );
  });
});
