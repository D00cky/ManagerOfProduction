import { describe, expect, it, vi } from "vitest";
import type { Conceito, StatusOS, TipoServico } from "@prisma/client";
import {
  buildRelatorioExportDataset,
  resolvePeriodo,
  semanaParaIntervalo,
  type OrdemRelatorioRow,
  type RelatorioExportRepository
} from "@/server/relatorio-export-service";
import { chaveObsNaoConforme } from "@/data/grupos-ffr";
import type { RespostasFfr } from "@/lib/ffr";

function repo(rows: OrdemRelatorioRow[]): RelatorioExportRepository {
  return {
    listOrdensParaRelatorio: vi.fn(async () => rows)
  };
}

let seq = 0;
function ordem(overrides: Partial<OrdemRelatorioRow> = {}): OrdemRelatorioRow {
  seq += 1;
  return {
    id: `os-${seq}`,
    numero: `OS-${seq}`,
    dataFimExecucao: new Date("2026-05-10T12:00:00.000Z"),
    cidade: "Sao Paulo",
    regiaoAdministrativa: "METROPOLITANA",
    tipoServico: "Desobstrucao" as TipoServico,
    descricaoTss: null,
    poloNome: "Polo Centro",
    fiscalNome: "Fiscal Um",
    codigoContrato: "C-1",
    descricaoContrato: "Contrato Um",
    unidadeExecutante: "Contratada Alfa",
    status: "Concluida" as StatusOS,
    tabulacao: null,
    ...overrides
  };
}

function tab(conceito: Conceito, respostas: RespostasFfr, percentual = 0.8) {
  return { conceito, respostas, percentual };
}

const supervisor = { id: "s1", perfil: "supervisor" as const };

describe("resolvePeriodo", () => {
  const now = new Date("2026-05-15T12:00:00.000Z");

  it("resolve período mensal a partir de YYYY-MM (início e fim do mês)", () => {
    const periodo = resolvePeriodo({ periodoTipo: "mensal", mes: "2026-05" }, now);
    expect(periodo.from.getFullYear()).toBe(2026);
    expect(periodo.from.getMonth()).toBe(4);
    expect(periodo.from.getDate()).toBe(1);
    expect(periodo.to.getMonth()).toBe(4);
    expect(periodo.to.getDate()).toBe(31);
  });

  it("resolve período semanal ISO (segunda a domingo)", () => {
    const periodo = resolvePeriodo({ periodoTipo: "semanal", semana: "2026-W20" }, now);
    // ISO week 20 de 2026: 2026-05-11 (seg) a 2026-05-17 (dom)
    expect(periodo.from.getFullYear()).toBe(2026);
    expect(periodo.from.getMonth()).toBe(4);
    expect(periodo.from.getDate()).toBe(11);
    expect(periodo.from.getDay()).toBe(1); // segunda
    expect(periodo.to.getDate()).toBe(17);
    expect(periodo.to.getDay()).toBe(0); // domingo
  });

  it("resolve período personalizado a partir de from/to", () => {
    const from = new Date("2026-03-01T00:00:00.000Z");
    const to = new Date("2026-03-31T23:59:59.999Z");
    const periodo = resolvePeriodo({ periodoTipo: "personalizado", from, to }, now);
    expect(periodo.from).toEqual(from);
    expect(periodo.to).toEqual(to);
  });
});

describe("semanaParaIntervalo", () => {
  it("retorna vazio para formato inválido", () => {
    expect(semanaParaIntervalo("2026-20")).toEqual({});
    expect(semanaParaIntervalo(undefined)).toEqual({});
  });

  it("converte YYYY-Www em intervalo ISO", () => {
    const { from, to } = semanaParaIntervalo("2026-W20");
    expect(from?.getDate()).toBe(11);
    expect(to?.getDate()).toBe(17);
  });
});

describe("buildRelatorioExportDataset - permissão e escopo", () => {
  it("nega usuário sem relatorios:read", async () => {
    const repository = repo([]);
    await expect(
      buildRelatorioExportDataset(repository, { id: "f1", perfil: "fiscal", poloId: "p1" }, {})
    ).rejects.toThrow("Sem permissao");
    expect(repository.listOrdensParaRelatorio).not.toHaveBeenCalled();
  });

  it("escopa monitor aos polos autorizados", async () => {
    const repository = repo([]);
    await buildRelatorioExportDataset(
      repository,
      { id: "m1", perfil: "monitor", polosPermitidos: ["p1", "p2"] },
      {}
    );
    const where = (repository.listOrdensParaRelatorio as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(where.poloId).toEqual({ in: ["p1", "p2"] });
  });

  it("supervisor vê tudo (sem restrição de polo/fiscal)", async () => {
    const repository = repo([]);
    await buildRelatorioExportDataset(repository, supervisor, {});
    const where = (repository.listOrdensParaRelatorio as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(where.poloId).toBeUndefined();
    expect(where.fiscalId).toBeUndefined();
  });

  it("aplica o período por dataFimExecucao", async () => {
    const repository = repo([]);
    await buildRelatorioExportDataset(repository, supervisor, { periodoTipo: "mensal", mes: "2026-05" });
    const where = (repository.listOrdensParaRelatorio as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(where.dataFimExecucao).toBeDefined();
    expect(where.dataFimExecucao.gte).toBeInstanceOf(Date);
    expect(where.dataFimExecucao.lte).toBeInstanceOf(Date);
  });
});

describe("buildRelatorioExportDataset - KPIs", () => {
  it("totalOS = inspecionadas + pendentes + canceladas e classifica conceitos", async () => {
    const rows = [
      ordem({ tabulacao: tab("A", { gerais_q1: "1" }) }),
      ordem({ tabulacao: tab("B", { gerais_q1: "1" }) }),
      ordem({ tabulacao: tab("C", { gerais_q1: "0" }) }),
      ordem({ tabulacao: tab("NaoAvaliado", {}) }),
      ordem({ status: "Pendente", tabulacao: null }), // pendente
      ordem({ status: "Cancelada", tabulacao: null }) // cancelada — não é pendente
    ];
    const { kpis } = await buildRelatorioExportDataset(repo(rows), supervisor, {});
    expect(kpis.totalOS).toBe(6);
    expect(kpis.inspecionadas).toBe(4);
    expect(kpis.pendentes).toBe(1); // só a Pendente; a Cancelada não entra aqui
    expect(kpis.canceladas).toBe(1);
    expect(kpis.totalOS).toBe(kpis.inspecionadas + kpis.pendentes + kpis.canceladas);
    expect(kpis.atende).toBe(2); // A + B
    expect(kpis.naoAtende).toBe(1); // C
    expect(kpis.naoAvaliada).toBe(1);
  });

  it("OS cancelada não infla pendentes nem métricas de inspeção", async () => {
    const rows = [
      ordem({ tabulacao: tab("A", { gerais_q1: "1" }) }),
      ordem({ status: "Cancelada", tabulacao: null })
    ];
    const { kpis } = await buildRelatorioExportDataset(repo(rows), supervisor, {});
    expect(kpis.pendentes).toBe(0);
    expect(kpis.canceladas).toBe(1);
    expect(kpis.inspecionadas).toBe(1);
    expect(kpis.naoAvaliada).toBe(0);
  });
});

describe("buildRelatorioExportDataset - ranking de não conformidades", () => {
  it("conta apenas respostas '0' de itens válidos; ignora 1/X/null/texto/peso 0", async () => {
    const respostas: RespostasFfr = {
      gerais_q1: "1", // conforme - ignora
      gerais_q2: "X", // N/A - ignora
      gerais_q3: "0", // NC válido (peso 3)
      gerais_q4: "0", // peso 0 - ignora
      desobstrucao_q1: "0", // NC válido
      desobstrucao_q2: null, // null - ignora
      desobstrucao_q3: "0", // NC válido
      [chaveObsNaoConforme("desobstrucao_q1")]: "faltou foto"
    };
    const rows = [ordem({ tabulacao: tab("D", respostas, 0.4) })];
    const dataset = await buildRelatorioExportDataset(repo(rows), supervisor, {});

    const ids = dataset.principaisNaoConformidades.map((n) => n.itemId).sort();
    expect(ids).toEqual(["desobstrucao_q1", "desobstrucao_q3", "gerais_q3"]);
    for (const nc of dataset.principaisNaoConformidades) {
      expect(nc.quantidade).toBe(1);
      expect(nc.percentualSobreInspecionadas).toBeCloseTo(1); // 1 de 1 inspecionada
    }
  });

  it("agrega o mesmo critério entre OS e ordena por quantidade (top 10)", async () => {
    const rows = [
      ordem({ tabulacao: tab("D", { desobstrucao_q1: "0", desobstrucao_q2: "0" }) }),
      ordem({ tabulacao: tab("D", { desobstrucao_q1: "0" }) }),
      ordem({ tabulacao: tab("D", { desobstrucao_q1: "0" }) })
    ];
    const dataset = await buildRelatorioExportDataset(repo(rows), supervisor, {});
    expect(dataset.principaisNaoConformidades[0].itemId).toBe("desobstrucao_q1");
    expect(dataset.principaisNaoConformidades[0].quantidade).toBe(3);
    expect(dataset.principaisNaoConformidades.length).toBeLessThanOrEqual(10);
  });
});

describe("buildRelatorioExportDataset - detalhes e quebras", () => {
  it("gera uma linha de detalhe por OS x critério não conforme com observação", async () => {
    const respostas: RespostasFfr = {
      desobstrucao_q1: "0",
      [chaveObsNaoConforme("desobstrucao_q1")]: "sem sinalizacao"
    };
    const rows = [ordem({ tabulacao: tab("D", respostas, 0.5) })];
    const dataset = await buildRelatorioExportDataset(repo(rows), supervisor, {});
    expect(dataset.detalhesNaoConformidades).toHaveLength(1);
    const det = dataset.detalhesNaoConformidades[0];
    expect(det.numeroOS).toBe(rows[0].numero);
    expect(det.observacao).toBe("sem sinalizacao");
    expect(det.descricaoNaoConformidade).toBe(`${det.criterio}: sem sinalizacao`);
    expect(det.conceito).toBe("D");
    expect(det.contrato).toBe("Contrato Um");
    expect(det.codigoContrato).toBe("C-1");
    expect(det.descricaoContrato).toBe("Contrato Um");
    expect(det.status).toBe("Concluida");
    expect(det.unidadeExecutante).toBe("Contratada Alfa");
  });

  it("usa só o critério como descrição quando não há observação", async () => {
    const rows = [ordem({ tabulacao: tab("D", { desobstrucao_q1: "0" }, 0.5) })];
    const dataset = await buildRelatorioExportDataset(repo(rows), supervisor, {});
    const det = dataset.detalhesNaoConformidades[0];
    expect(det.observacao).toBeNull();
    expect(det.descricaoNaoConformidade).toBe(det.criterio);
  });

  it("produz quebras por região, polo, município, tipo, contrato e unidade", async () => {
    const rows = [
      ordem({ tabulacao: tab("C", { desobstrucao_q1: "0" }) }),
      ordem({ tabulacao: tab("A", { gerais_q1: "1" }) })
    ];
    const dataset = await buildRelatorioExportDataset(repo(rows), supervisor, {});
    expect(dataset.quebras.porRegiao.length).toBeGreaterThan(0);
    expect(dataset.quebras.porPolo.length).toBeGreaterThan(0);
    expect(dataset.quebras.porMunicipio.length).toBeGreaterThan(0);
    expect(dataset.quebras.porTipoServico.length).toBeGreaterThan(0);
    expect(dataset.quebras.porContrato.length).toBeGreaterThan(0);
    expect(dataset.quebras.porUnidadeExecutante.length).toBeGreaterThan(0);
    const regiao = dataset.quebras.porRegiao[0];
    expect(regiao.totalAvaliado).toBe(2);
    expect(regiao.quantidadeNC).toBe(1);
  });

  it("agrupa NC por contratada (mais NC primeiro) com motivos e exemplos de OS", async () => {
    const rows = [
      ordem({ numero: "A1", descricaoContrato: "Empresa Alfa", tabulacao: tab("D", { desobstrucao_q1: "0", desobstrucao_q2: "0" }) }),
      ordem({ numero: "A2", descricaoContrato: "Empresa Alfa", tabulacao: tab("D", { desobstrucao_q1: "0" }) }),
      ordem({ numero: "B1", descricaoContrato: "Empresa Beta", tabulacao: tab("C", { desobstrucao_q1: "0" }) })
    ];
    const { naoConformidadesPorContratada } = await buildRelatorioExportDataset(repo(rows), supervisor, {});

    expect(naoConformidadesPorContratada).toHaveLength(2);
    const [alfa, beta] = naoConformidadesPorContratada;
    expect(alfa.contrato).toBe("Empresa Alfa"); // mais NC vem primeiro
    expect(alfa.quantidadeNC).toBe(3); // q1 (A1,A2) + q2 (A1)
    expect(alfa.totalAvaliado).toBe(2);
    expect(alfa.motivos[0].quantidade).toBe(2); // o critério mais frequente
    expect(alfa.motivos[0].criterio).toContain("FACHADA");
    expect(alfa.exemplos.map((e) => e.numeroOS)).toEqual(["A1", "A2"]); // OS distintas
    expect(alfa.exemplos[0].descricao).toContain("FACHADA");
    expect(beta.contrato).toBe("Empresa Beta");
    expect(beta.quantidadeNC).toBe(1);
  });

  it("inclui a observação na descrição do exemplo da contratada", async () => {
    const rows = [
      ordem({
        numero: "OBS1",
        descricaoContrato: "Empresa Alfa",
        tabulacao: tab("D", { desobstrucao_q1: "0", [chaveObsNaoConforme("desobstrucao_q1")]: "faltou foto" })
      })
    ];
    const { naoConformidadesPorContratada } = await buildRelatorioExportDataset(repo(rows), supervisor, {});
    expect(naoConformidadesPorContratada[0].exemplos[0].descricao).toBe("TEM FOTO DA FACHADA?: faltou foto");
  });
});
