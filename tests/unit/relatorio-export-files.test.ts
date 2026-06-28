import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { gerarRelatorioExcel } from "@/server/relatorio-excel";
import { gerarRelatorioPdf } from "@/server/relatorio-pdf";
import type { RelatorioExportDataset } from "@/server/relatorio-export-service";

function dataset(): RelatorioExportDataset {
  return {
    periodo: {
      from: new Date("2026-05-01T00:00:00.000Z"),
      to: new Date("2026-05-31T23:59:59.999Z"),
      label: "01/05/2026 a 31/05/2026"
    },
    filtrosAplicados: { periodo: "01/05/2026 a 31/05/2026", regiao: "METROPOLITANA", polo: null, municipio: null, tipoServico: null, fiscalId: null, tipoPeriodo: "mensal" },
    kpis: { totalOS: 10, inspecionadas: 8, pendentes: 2, naoAvaliada: 1, atende: 5, naoAtende: 2, iqes: 0.82 },
    situacaoInspecoes: [
      { nome: "Atende", quantidade: 5, percentual: 0.625 },
      { nome: "Não Atende", quantidade: 2, percentual: 0.25 },
      { nome: "Não Avaliada", quantidade: 1, percentual: 0.125 }
    ],
    principaisNaoConformidades: [
      { itemId: "desobstrucao_q1", criterio: "TEM FOTO DA FACHADA?", grupo: "Desobstrucao", quantidade: 4, percentualSobreInspecionadas: 0.5 },
      { itemId: "gerais_q3", criterio: "AS COORDENADAS CONDIZEM?", grupo: "Itens Gerais", quantidade: 2, percentualSobreInspecionadas: 0.25 }
    ],
    naoConformidadesPorContratada: [
      {
        contrato: "Contrato Um",
        quantidadeNC: 6,
        totalAvaliado: 8,
        motivos: [
          { criterio: "TEM FOTO DA FACHADA?", quantidade: 4 },
          { criterio: "AS COORDENADAS CONDIZEM?", quantidade: 2 }
        ],
        exemplos: [{ numeroOS: "OS-1", descricao: "TEM FOTO DA FACHADA?: sem foto" }]
      }
    ],
    detalhesNaoConformidades: [
      {
        osId: "os-1",
        numeroOS: "OS-1",
        dataFimExecucao: new Date("2026-05-10T12:00:00.000Z"),
        municipio: "Sao Paulo",
        polo: "Polo Centro",
        regiao: "METROPOLITANA",
        tipoServico: "Desobstrucao",
        fiscalNome: "Fiscal Um",
        criterio: "TEM FOTO DA FACHADA?",
        observacao: "sem foto",
        descricaoNaoConformidade: "TEM FOTO DA FACHADA?: sem foto",
        conceito: "D",
        percentual: 0.4,
        contrato: "Contrato Um",
        codigoContrato: "C-1",
        descricaoContrato: "Contrato Um",
        status: "Concluida",
        unidadeExecutante: "Contratada Alfa"
      }
    ],
    quebras: {
      porRegiao: [{ chave: "METROPOLITANA", nome: "METROPOLITANA", quantidadeNC: 6, totalAvaliado: 8, mediaPercentual: 0.8, iqes: 0.82 }],
      porPolo: [{ chave: "Polo Centro", nome: "Polo Centro", quantidadeNC: 6, totalAvaliado: 8, mediaPercentual: 0.8, iqes: 0.82 }],
      porMunicipio: [{ chave: "Sao Paulo", nome: "Sao Paulo", quantidadeNC: 6, totalAvaliado: 8, mediaPercentual: 0.8, iqes: 0.82 }],
      porTipoServico: [{ chave: "Desobstrucao", nome: "Desobstrucao", quantidadeNC: 6, totalAvaliado: 8, mediaPercentual: 0.8, iqes: 0.82 }],
      porContrato: [{ chave: "Contrato Um", nome: "Contrato Um", quantidadeNC: 6, totalAvaliado: 8, mediaPercentual: 0.8, iqes: 0.82 }],
      porUnidadeExecutante: [{ chave: "Contratada Alfa", nome: "Contratada Alfa", quantidadeNC: 6, totalAvaliado: 8, mediaPercentual: 0.8, iqes: 0.82 }]
    }
  };
}

describe("gerarRelatorioExcel", () => {
  it("gera um workbook com todas as abas esperadas", async () => {
    const buffer = await gerarRelatorioExcel(dataset());
    expect(buffer.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const nomes = wb.worksheets.map((ws) => ws.name);
    expect(nomes).toEqual([
      "Resumo",
      "Principais NC",
      "Detalhamento NC",
      "Por Polo",
      "Por Municipio",
      "Por Tipo Servico",
      "Por Contrato",
      "Por Unidade",
      "NC por Contratada"
    ]);
  });

  it("inclui as colunas obrigatórias na aba Detalhamento NC", async () => {
    const buffer = await gerarRelatorioExcel(dataset());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Detalhamento NC")!;
    const headers = (ws.getRow(1).values as unknown[]).filter((v): v is string => typeof v === "string");
    for (const obrigatoria of [
      "No OS",
      "Fim execucao",
      "Municipio",
      "Polo",
      "Regiao",
      "Tipo servico",
      "Fiscal",
      "Criterio nao conforme",
      "Descricao nao conformidade",
      "Observacao",
      "Conceito",
      "% FFR",
      "Status",
      "Contrato",
      "Unidade executante"
    ]) {
      expect(headers).toContain(obrigatoria);
    }
  });
});

describe("gerarRelatorioPdf", () => {
  it("gera um PDF não vazio", () => {
    const bytes = gerarRelatorioPdf(dataset());
    expect(bytes.byteLength).toBeGreaterThan(0);
    // assinatura do PDF: "%PDF"
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("%PDF");
  });
});
