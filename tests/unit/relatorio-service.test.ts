import { describe, expect, it, vi } from "vitest";
import type { Conceito } from "@prisma/client";
import {
  exportRelatorioCsv,
  getMesesRelatorio,
  getRelatorio,
  mesParaIntervalo,
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
  meses?: Date[];
}): RelatorioRepository {
  return {
    overall: vi.fn(async () => options.overall ?? { total: 0, mediaPercentual: 0 }),
    countByConceito: vi.fn(async () => options.conceitos ?? []),
    mediaPorFiscal: vi.fn(async () => options.porFiscal ?? []),
    findFiscais: vi.fn(async () => options.fiscais ?? []),
    listTabulacoesParaBreakdown: vi.fn(async () => options.breakdown ?? []),
    mesesComExecucao: vi.fn(async () => options.meses ?? [])
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

  it("applies the região/polo filter on top of the access scope", async () => {
    const repository = repo({});

    await getRelatorio(
      repository,
      { id: "sup", perfil: "supervisor", poloId: null },
      { regiao: "METROPOLITANA", polo: "p1" }
    );

    const expected = { regiaoAdministrativa: "METROPOLITANA", poloId: "p1" };
    expect(repository.overall).toHaveBeenCalledWith(expected);
    expect(repository.listTabulacoesParaBreakdown).toHaveBeenCalledWith(expected);
  });

  it("filters by the imported execution-end date and combines with the geo filter", async () => {
    const repository = repo({});
    const from = new Date("2026-05-01T00:00:00.000Z");
    const to = new Date("2026-05-31T23:59:59.999Z");

    await getRelatorio(
      repository,
      { id: "sup", perfil: "supervisor", poloId: null },
      { regiao: "METROPOLITANA", from, to }
    );

    const expected = {
      regiaoAdministrativa: "METROPOLITANA",
      dataFimExecucao: { gte: from, lte: to }
    };
    expect(repository.overall).toHaveBeenCalledWith(expected);
    expect(repository.mediaPorFiscal).toHaveBeenCalledWith(expected);
    expect(repository.listTabulacoesParaBreakdown).toHaveBeenCalledWith(expected);
  });

  it("returns zeros when there are no tabulations", async () => {
    const repository = repo({});

    const resumo = await getRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(resumo.totalAvaliadas).toBe(0);
    expect(resumo.mediaPercentual).toBe(0);
    expect(resumo.conceitos).toEqual({ A: 0, B: 0, C: 0, D: 0, NaoAvaliado: 0 });
    expect(resumo.porFiscal).toEqual([]);
    expect(resumo.porRegiao).toEqual([]);
    expect(resumo.porPolo).toEqual([]);
    expect(resumo.arvore).toEqual([]);
  });

  it("clusters contratada under polo as a Região → Polo → Contratada tree with IQES", async () => {
    const repository = repo({
      breakdown: [
        // METROPOLITANA / Polo Leste / Contratada A: 3 conforme, 1 não conforme
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
        // METROPOLITANA / Polo Oeste / Contratada B: 2 conforme, 0 não conforme
        breakdownRow({
          percentual: 1,
          regiaoAdministrativa: "METROPOLITANA",
          poloNome: "Polo Oeste",
          descricaoContrato: "Contratada B",
          respostas: { gerais_q1: "1", gerais_q2: "1" }
        })
      ]
    });

    const resumo = await getRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    // Flat summaries
    const metroRegiao = resumo.porRegiao.find((r) => r.nome === "METROPOLITANA");
    expect(metroRegiao).toMatchObject({ total: 3 });
    expect(metroRegiao?.iqes).toBeCloseTo(6 / 8, 5); // 6 conforme / 8 evaluated
    expect(resumo.porPolo.map((p) => p.nome)).toEqual(["Polo Leste", "Polo Oeste"]);

    // Tree: single região, two polos, contratada nested under its polo
    expect(resumo.arvore).toHaveLength(1);
    const metro = resumo.arvore[0];
    expect(metro.nome).toBe("METROPOLITANA");
    expect(metro.total).toBe(3);
    expect(metro.iqes).toBeCloseTo(6 / 8, 5);
    expect(metro.polos.map((p) => p.nome)).toEqual(["Polo Leste", "Polo Oeste"]);

    const leste = metro.polos[0];
    expect(leste).toMatchObject({ total: 2 });
    expect(leste.mediaPercentual).toBeCloseTo(0.7, 5);
    expect(leste.iqes).toBeCloseTo(4 / 6, 5);
    expect(leste.contratadas).toHaveLength(1);
    expect(leste.contratadas[0]).toMatchObject({ nome: "Contratada A", total: 2 });
    expect(leste.contratadas[0].iqes).toBeCloseTo(4 / 6, 5);

    const oeste = metro.polos[1];
    expect(oeste.contratadas[0]).toMatchObject({ nome: "Contratada B", total: 1, iqes: 1 });
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
    expect(resumo.porFiscal).toEqual([
      { fiscalId: "f1", name: "Ana", matricula: "F0001", total: 2, mediaPercentual: 0.75 },
      { fiscalId: "f2", name: "Bruno", matricula: "F0002", total: 2, mediaPercentual: 0.4 }
    ]);
  });

  it("exports per-fiscal rows and a flattened Região/Polo/Contratada IQES section as CSV", async () => {
    const repository = repo({
      porFiscal: [{ fiscalId: "f1", total: 2, mediaPercentual: 0.75 }],
      fiscais: [{ id: "f1", name: "Ana", matricula: "F0001" }],
      breakdown: [
        breakdownRow({
          percentual: 0.75,
          regiaoAdministrativa: "METROPOLITANA",
          poloNome: "Polo Leste",
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
        "Regiao,Polo,Contratada,Tabulacoes,Media FFR,IQES",
        "METROPOLITANA,Polo Leste,Contratada A,1,75.00%,75.00%"
      ].join("\n")
    );
  });
});

describe("mesParaIntervalo", () => {
  it("turns YYYY-MM into the first and last instant of that month", () => {
    const { from, to } = mesParaIntervalo("2026-05");
    expect(from).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
    expect(to).toEqual(new Date(2026, 4, 31, 23, 59, 59, 999));
  });

  it("returns an empty window for missing or invalid input", () => {
    expect(mesParaIntervalo(undefined)).toEqual({});
    expect(mesParaIntervalo("")).toEqual({});
    expect(mesParaIntervalo("2026-5")).toEqual({});
    expect(mesParaIntervalo("not-a-month")).toEqual({});
  });
});

describe("getMesesRelatorio", () => {
  it("lists the execution-end months (MM/YY) newest first, deduplicated", async () => {
    const repository = repo({
      meses: [
        new Date(2026, 4, 12), // mai/2026
        new Date(2026, 4, 28), // mai/2026 (dup)
        new Date(2026, 5, 3) // jun/2026
      ]
    });

    const meses = await getMesesRelatorio(repository, { id: "sup", perfil: "supervisor", poloId: null });

    expect(meses).toEqual([
      { value: "2026-06", label: "06/26" },
      { value: "2026-05", label: "05/26" }
    ]);
    expect(repository.mesesComExecucao).toHaveBeenCalledWith({});
  });
});
