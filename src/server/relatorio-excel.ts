import ExcelJS from "exceljs";
import type {
  QuebraAnalitica,
  RelatorioExportDataset
} from "@/server/relatorio-export-service";

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatarData(data: Date | null): string {
  return data ? data.toLocaleDateString("pt-BR") : "";
}

function estilizarCabecalho(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.alignment = { vertical: "middle" };
  });
}

function abaQuebra(
  wb: ExcelJS.Workbook,
  nome: string,
  rotuloChave: string,
  linhas: QuebraAnalitica[]
) {
  const ws = wb.addWorksheet(nome);
  ws.columns = [
    { header: rotuloChave, key: "nome", width: 34 },
    { header: "Nao conformidades", key: "qtd", width: 20 },
    { header: "Total avaliado", key: "total", width: 16 },
    { header: "Media FFR", key: "media", width: 14 },
    { header: "IQES", key: "iqes", width: 14 }
  ];
  estilizarCabecalho(ws.getRow(1));
  for (const item of linhas) {
    ws.addRow({
      nome: item.nome,
      qtd: item.quantidadeNC,
      total: item.totalAvaliado,
      media: pct(item.mediaPercentual),
      iqes: pct(item.iqes)
    });
  }
}

export async function gerarRelatorioExcel(dataset: RelatorioExportDataset): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ManagerOfProduction";
  wb.created = new Date();

  // --- Aba Resumo: filtros + KPIs + situação das inspeções ---
  const resumo = wb.addWorksheet("Resumo");
  resumo.columns = [{ width: 30 }, { width: 30 }];
  resumo.addRow(["Relatorio de Inspecoes"]).font = { bold: true, size: 16 };
  resumo.addRow(["Periodo", dataset.periodo.label]);
  resumo.addRow([]);

  resumo.addRow(["Filtros aplicados"]).font = { bold: true };
  for (const [chave, valor] of Object.entries(dataset.filtrosAplicados)) {
    resumo.addRow([chave, valor ?? "-"]);
  }
  resumo.addRow([]);

  resumo.addRow(["Indicadores"]).font = { bold: true };
  const kpis = dataset.kpis;
  const kpiRows: Array<[string, number | string]> = [
    ["Total OS", kpis.totalOS],
    ["Inspecionadas", kpis.inspecionadas],
    ["Pendentes", kpis.pendentes],
    ["Canceladas", kpis.canceladas],
    ["Nao Avaliada", kpis.naoAvaliada],
    ["Atende", kpis.atende],
    ["Nao Atende", kpis.naoAtende],
    ["IQES", pct(kpis.iqes)]
  ];
  for (const linha of kpiRows) resumo.addRow(linha);
  resumo.addRow([]);

  resumo.addRow(["Situacao das inspecoes"]).font = { bold: true };
  estilizarCabecalho(resumo.addRow(["Situacao", "Quantidade", "Percentual"]));
  for (const item of dataset.situacaoInspecoes) {
    resumo.addRow([item.nome, item.quantidade, pct(item.percentual)]);
  }

  // --- Aba Principais NC: ranking ---
  const ranking = wb.addWorksheet("Principais NC");
  ranking.columns = [
    { header: "#", key: "pos", width: 6 },
    { header: "Criterio", key: "criterio", width: 70 },
    { header: "Grupo", key: "grupo", width: 28 },
    { header: "Quantidade", key: "qtd", width: 14 },
    { header: "% sobre inspecionadas", key: "perc", width: 22 }
  ];
  estilizarCabecalho(ranking.getRow(1));
  dataset.principaisNaoConformidades.forEach((nc, idx) => {
    ranking.addRow({
      pos: idx + 1,
      criterio: nc.criterio,
      grupo: nc.grupo,
      qtd: nc.quantidade,
      perc: pct(nc.percentualSobreInspecionadas)
    });
  });

  // --- Aba Detalhamento NC: uma linha por OS x critério ---
  const detalhe = wb.addWorksheet("Detalhamento NC");
  detalhe.columns = [
    { header: "No OS", key: "numero", width: 16 },
    { header: "Fim execucao", key: "data", width: 14 },
    { header: "Municipio", key: "municipio", width: 20 },
    { header: "Polo", key: "polo", width: 20 },
    { header: "Regiao", key: "regiao", width: 20 },
    { header: "Tipo servico", key: "tipo", width: 20 },
    { header: "Fiscal", key: "fiscal", width: 22 },
    { header: "Criterio nao conforme", key: "criterio", width: 60 },
    { header: "Descricao nao conformidade", key: "descricao", width: 70 },
    { header: "Observacao", key: "obs", width: 40 },
    { header: "Conceito", key: "conceito", width: 10 },
    { header: "% FFR", key: "perc", width: 10 },
    { header: "Status", key: "status", width: 14 },
    { header: "Contrato", key: "contrato", width: 24 },
    { header: "Codigo contrato", key: "codigoContrato", width: 18 },
    { header: "Descricao contrato", key: "descricaoContrato", width: 30 },
    { header: "Unidade executante", key: "unidade", width: 24 }
  ];
  estilizarCabecalho(detalhe.getRow(1));
  for (const d of dataset.detalhesNaoConformidades) {
    detalhe.addRow({
      numero: d.numeroOS,
      data: formatarData(d.dataFimExecucao),
      municipio: d.municipio ?? "",
      polo: d.polo ?? "",
      regiao: d.regiao ?? "",
      tipo: d.tipoServico,
      fiscal: d.fiscalNome ?? "",
      criterio: d.criterio,
      descricao: d.descricaoNaoConformidade,
      obs: d.observacao ?? "",
      conceito: d.conceito,
      perc: pct(d.percentual),
      status: d.status,
      contrato: d.contrato ?? "",
      codigoContrato: d.codigoContrato ?? "",
      descricaoContrato: d.descricaoContrato ?? "",
      unidade: d.unidadeExecutante ?? ""
    });
  }

  // --- Abas de agregação ---
  abaQuebra(wb, "Por Polo", "Polo", dataset.quebras.porPolo);
  abaQuebra(wb, "Por Municipio", "Municipio", dataset.quebras.porMunicipio);
  abaQuebra(wb, "Por Tipo Servico", "Tipo de servico", dataset.quebras.porTipoServico);
  abaQuebra(wb, "Por Contrato", "Contrato", dataset.quebras.porContrato);
  abaQuebra(wb, "Por Unidade", "Unidade executante", dataset.quebras.porUnidadeExecutante);

  // --- Aba NC por Contratada: quem tem mais NC + motivos + exemplos de OS ---
  const contratadas = wb.addWorksheet("NC por Contratada");
  contratadas.columns = [
    { header: "Empresa / contrato", key: "empresa", width: 34 },
    { header: "Nao conformidades", key: "qtd", width: 18 },
    { header: "Total avaliado", key: "total", width: 14 },
    { header: "Principais motivos", key: "motivos", width: 80 },
    { header: "Exemplos de OS", key: "exemplos", width: 60 }
  ];
  estilizarCabecalho(contratadas.getRow(1));
  for (const c of dataset.naoConformidadesPorContratada) {
    contratadas.addRow({
      empresa: c.contrato,
      qtd: c.quantidadeNC,
      total: c.totalAvaliado,
      motivos: c.motivos.map((m) => `${m.criterio} (${m.quantidade})`).join("; "),
      exemplos: c.exemplos.map((e) => `${e.numeroOS}: ${e.descricao}`).join(" | ")
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
