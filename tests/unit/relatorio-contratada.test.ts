import { describe, expect, it, vi } from "vitest";
import type { Conceito, StatusOS, TipoServico } from "@prisma/client";
import {
  buildRelatorioExportDataset,
  paginarDetalhamento,
  type NaoConformidadeDetalhe,
  type OrdemRelatorioRow,
  type RelatorioExportRepository
} from "@/server/relatorio-export-service";
import { chaveObsNaoConforme } from "@/data/grupos-ffr";
import type { RespostasFfr } from "@/lib/ffr";

function repo(rows: OrdemRelatorioRow[]): RelatorioExportRepository {
  return { listOrdensParaRelatorio: vi.fn(async () => rows) };
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

function tab(conceito: Conceito, respostas: RespostasFfr, percentual = 0.5) {
  return { conceito, respostas, percentual };
}

const supervisor = { id: "s1", perfil: "supervisor" as const };
const whereDe = (r: RelatorioExportRepository) =>
  (r.listOrdensParaRelatorio as ReturnType<typeof vi.fn>).mock.calls[0][0];

describe("descricaoNaoConformidade", () => {
  it("combina critério + observação quando há observação; só critério quando não há", async () => {
    const respostas: RespostasFfr = {
      desobstrucao_q1: "0",
      [chaveObsNaoConforme("desobstrucao_q1")]: "sem foto da fachada",
      desobstrucao_q2: "0"
    };
    const rows = [ordem({ tabulacao: tab("D", respostas) })];
    const { detalhesNaoConformidades } = await buildRelatorioExportDataset(repo(rows), supervisor, {});

    const q1 = detalhesNaoConformidades.find((d) => d.criterio.includes("FACHADA"))!;
    const q2 = detalhesNaoConformidades.find((d) => d.criterio.includes("EXECUÇÃO"))!;
    expect(q1.observacao).toBe("sem foto da fachada");
    expect(q1.descricaoNaoConformidade).toBe(`${q1.criterio}: sem foto da fachada`);
    expect(q2.observacao).toBeNull();
    expect(q2.descricaoNaoConformidade).toBe(q2.criterio);
  });

  it("inclui status, código e descrição do contrato no detalhe", async () => {
    const rows = [
      ordem({
        status: "Pendente",
        codigoContrato: "C-9",
        descricaoContrato: "Contrato Nove",
        tabulacao: tab("C", { desobstrucao_q1: "0" })
      })
    ];
    const { detalhesNaoConformidades } = await buildRelatorioExportDataset(repo(rows), supervisor, {});
    const d = detalhesNaoConformidades[0];
    expect(d.status).toBe("Pendente");
    expect(d.codigoContrato).toBe("C-9");
    expect(d.descricaoContrato).toBe("Contrato Nove");
  });
});

describe("filtros de contratada", () => {
  it("aplica contrato/codigoContrato/unidadeExecutante no where (AND com escopo)", async () => {
    const r = repo([]);
    await buildRelatorioExportDataset(r, supervisor, {
      codigoContrato: "C-1",
      unidadeExecutante: "Contratada Alfa",
      contrato: "Contrato Um"
    });
    const where = whereDe(r);
    expect(where.codigoContrato).toBe("C-1");
    expect(where.unidadeExecutante).toBe("Contratada Alfa");
    expect(where.descricaoContrato).toMatchObject({ contains: "Contrato Um" });
  });

  it("aplica conceito via relação de tabulação no where", async () => {
    const r = repo([]);
    await buildRelatorioExportDataset(r, supervisor, { conceito: "C" });
    expect(whereDe(r).tabulacao).toMatchObject({ conceito: "C" });
  });

  it("filtra o detalhamento por critério sem afetar o ranking", async () => {
    const rows = [ordem({ tabulacao: tab("D", { desobstrucao_q1: "0", desobstrucao_q2: "0" }) })];
    const dataset = await buildRelatorioExportDataset(repo(rows), supervisor, { criterio: "desobstrucao_q1" });
    expect(dataset.detalhesNaoConformidades).toHaveLength(1);
    expect(dataset.detalhesNaoConformidades[0].criterio).toContain("FACHADA");
    // O ranking continua refletindo todas as NC da contratada (não filtra por critério).
    expect(dataset.principaisNaoConformidades.length).toBe(2);
  });

  it("mantém o escopo do papel ao filtrar por contrato (monitor → polos)", async () => {
    const r = repo([]);
    await buildRelatorioExportDataset(r, { id: "m1", perfil: "monitor", polosPermitidos: ["p1"] }, {
      codigoContrato: "C-1"
    });
    const where = whereDe(r);
    expect(where.poloId).toEqual({ in: ["p1"] });
    expect(where.codigoContrato).toBe("C-1");
  });
});

describe("paginarDetalhamento", () => {
  const detalhes = Array.from({ length: 25 }, (_, i) => ({ numeroOS: `OS-${i}` })) as NaoConformidadeDetalhe[];

  it("retorna a fatia da página com total/page/pageSize", () => {
    const p2 = paginarDetalhamento(detalhes, 2, 10);
    expect(p2.total).toBe(25);
    expect(p2.page).toBe(2);
    expect(p2.pageSize).toBe(10);
    expect(p2.rows).toHaveLength(10);
    expect(p2.rows[0].numeroOS).toBe("OS-10");
  });

  it("normaliza página/tamanho inválidos", () => {
    const p = paginarDetalhamento(detalhes, 0, 0);
    expect(p.page).toBe(1);
    expect(p.pageSize).toBeGreaterThan(0);
    expect(p.rows.length).toBeGreaterThan(0);
  });
});
