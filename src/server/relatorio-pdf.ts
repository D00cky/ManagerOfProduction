import { jsPDF } from "jspdf";
import type { RelatorioExportDataset } from "@/server/relatorio-export-service";

/**
 * Gera o PDF executivo de forma determinística (sem screenshot). Gráficos são
 * desenhados diretamente com primitivas do jsPDF: a "Situação das Inspeções" é
 * representada por uma barra 100% empilhada (substitui a pizza, mantendo simples e
 * determinístico) e as "Principais Não Conformidades" por barras horizontais.
 */

const MARGEM = 14;
const LARGURA = 210;
const ALTURA = 297;
const LIMITE_DETALHE = 50;

// Cores (RGB) — situação das inspeções
const COR_ATENDE: [number, number, number] = [34, 139, 84];
const COR_NAO_ATENDE: [number, number, number] = [200, 60, 55];
const COR_NAO_AVALIADA: [number, number, number] = [150, 150, 150];
const COR_PRIMARIA: [number, number, number] = [31, 78, 120];
const COR_BARRA_NC: [number, number, number] = [217, 119, 38];

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatarData(data: Date | null): string {
  return data ? data.toLocaleDateString("pt-BR") : "-";
}

export function gerarRelatorioPdf(dataset: RelatorioExportDataset): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGEM;

  const novaPaginaSeNecessario = (altura: number) => {
    if (y + altura > ALTURA - MARGEM) {
      doc.addPage();
      y = MARGEM;
    }
  };

  // --- Título e subtítulo ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COR_PRIMARIA);
  doc.text("Relatório de Inspeções", MARGEM, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(`Período: ${dataset.periodo.label}`, MARGEM, y);
  y += 10;

  // --- Cards de KPIs ---
  const kpis = dataset.kpis;
  const cards: Array<[string, string]> = [
    ["Total OS", String(kpis.totalOS)],
    ["Inspecionadas", String(kpis.inspecionadas)],
    ["Pendentes", String(kpis.pendentes)],
    ["Não Avaliada", String(kpis.naoAvaliada)],
    ["Atende", String(kpis.atende)],
    ["Não Atende", String(kpis.naoAtende)],
    ["IQES", pct(kpis.iqes)]
  ];
  const colunas = 4;
  const gap = 4;
  const cardW = (LARGURA - 2 * MARGEM - gap * (colunas - 1)) / colunas;
  const cardH = 18;
  cards.forEach((card, idx) => {
    const col = idx % colunas;
    const linha = Math.floor(idx / colunas);
    if (col === 0 && linha > 0) y += cardH + gap;
    const x = MARGEM + col * (cardW + gap);
    const top = y;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(x, top, cardW, cardH, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(card[0], x + 3, top + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...COR_PRIMARIA);
    doc.text(card[1], x + 3, top + 14);
    doc.setFont("helvetica", "normal");
  });
  y += cardH + 12;

  // --- Gráfico: Situação das Inspeções (barra 100% empilhada) ---
  novaPaginaSeNecessario(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Situação das Inspeções", MARGEM, y);
  y += 6;

  const totalSit = dataset.situacaoInspecoes.reduce((s, i) => s + i.quantidade, 0);
  const barW = LARGURA - 2 * MARGEM;
  const barH = 9;
  const cores = [COR_ATENDE, COR_NAO_ATENDE, COR_NAO_AVALIADA];
  let cursorX = MARGEM;
  if (totalSit > 0) {
    dataset.situacaoInspecoes.forEach((item, idx) => {
      const w = (item.quantidade / totalSit) * barW;
      if (w <= 0) return;
      doc.setFillColor(...cores[idx]);
      doc.rect(cursorX, y, w, barH, "F");
      cursorX += w;
    });
  } else {
    doc.setDrawColor(220, 220, 220);
    doc.rect(MARGEM, y, barW, barH, "S");
  }
  y += barH + 6;

  // Legenda
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let legX = MARGEM;
  dataset.situacaoInspecoes.forEach((item, idx) => {
    doc.setFillColor(...cores[idx]);
    doc.rect(legX, y - 3, 4, 4, "F");
    doc.setTextColor(60, 60, 60);
    const rotulo = `${item.nome}: ${item.quantidade} (${pct(item.percentual)})`;
    doc.text(rotulo, legX + 6, y);
    legX += doc.getTextWidth(rotulo) + 16;
  });
  y += 12;

  // --- Gráfico: Principais Não Conformidades (barras horizontais) ---
  novaPaginaSeNecessario(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Principais Não Conformidades", MARGEM, y);
  y += 7;

  const ncs = dataset.principaisNaoConformidades;
  const maxQtd = ncs.reduce((m, n) => Math.max(m, n.quantidade), 0);
  const areaBar = LARGURA - 2 * MARGEM;
  const labelW = areaBar * 0.55;
  const barMaxW = areaBar - labelW - 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const nc of ncs) {
    novaPaginaSeNecessario(8);
    const texto = doc.splitTextToSize(nc.criterio, labelW)[0] as string;
    doc.setTextColor(60, 60, 60);
    doc.text(texto, MARGEM, y + 3.5);
    const w = maxQtd > 0 ? (nc.quantidade / maxQtd) * barMaxW : 0;
    doc.setFillColor(...COR_BARRA_NC);
    doc.rect(MARGEM + labelW, y, Math.max(w, 0.5), 5, "F");
    doc.setTextColor(40, 40, 40);
    doc.text(String(nc.quantidade), MARGEM + labelW + Math.max(w, 0.5) + 2, y + 4);
    y += 7;
  }
  y += 6;

  // --- Tabela resumida das principais NC ---
  novaPaginaSeNecessario(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Ranking de Não Conformidades", MARGEM, y);
  y += 6;

  const colsRanking = [
    { titulo: "#", largura: 10 },
    { titulo: "Critério", largura: 120 },
    { titulo: "Qtd", largura: 18 },
    { titulo: "% insp.", largura: 24 }
  ];
  desenharCabecalhoTabela(doc, colsRanking, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ncs.forEach((nc, idx) => {
    novaPaginaSeNecessario(6);
    const valores = [
      String(idx + 1),
      doc.splitTextToSize(nc.criterio, colsRanking[1].largura - 2)[0] as string,
      String(nc.quantidade),
      pct(nc.percentualSobreInspecionadas)
    ];
    desenharLinhaTabela(doc, colsRanking, valores, y);
    y += 6;
  });
  y += 8;

  // --- Tabela de detalhamento (limitada) ---
  novaPaginaSeNecessario(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Detalhamento das Não Conformidades", MARGEM, y);
  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  const total = dataset.detalhesNaoConformidades.length;
  const mostrados = Math.min(total, LIMITE_DETALHE);
  doc.text(
    total > LIMITE_DETALHE
      ? `Exibindo ${mostrados} de ${total} registros. Detalhamento completo no Excel.`
      : `${total} registro(s).`,
    MARGEM,
    y
  );
  y += 6;

  const colsDet = [
    { titulo: "OS", largura: 22 },
    { titulo: "Município", largura: 30 },
    { titulo: "Tipo", largura: 28 },
    { titulo: "Critério", largura: 76 },
    { titulo: "Conc.", largura: 14 },
    { titulo: "% FFR", largura: 12 }
  ];
  desenharCabecalhoTabela(doc, colsDet, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  for (const d of dataset.detalhesNaoConformidades.slice(0, LIMITE_DETALHE)) {
    novaPaginaSeNecessario(6);
    const valores = [
      d.numeroOS,
      doc.splitTextToSize(d.municipio ?? "-", colsDet[1].largura - 2)[0] as string,
      String(d.tipoServico),
      doc.splitTextToSize(d.criterio, colsDet[3].largura - 2)[0] as string,
      d.conceito,
      pct(d.percentual)
    ];
    desenharLinhaTabela(doc, colsDet, valores, y);
    y += 5.5;
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

type Coluna = { titulo: string; largura: number };

function desenharCabecalhoTabela(doc: jsPDF, colunas: Coluna[], y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setFillColor(...COR_PRIMARIA);
  const larguraTotal = colunas.reduce((s, c) => s + c.largura, 0);
  doc.rect(MARGEM, y - 4, larguraTotal, 6, "F");
  doc.setTextColor(255, 255, 255);
  let x = MARGEM;
  for (const col of colunas) {
    doc.text(col.titulo, x + 1, y);
    x += col.largura;
  }
}

function desenharLinhaTabela(doc: jsPDF, colunas: Coluna[], valores: string[], y: number) {
  doc.setTextColor(50, 50, 50);
  let x = MARGEM;
  colunas.forEach((col, idx) => {
    doc.text(valores[idx] ?? "", x + 1, y);
    x += col.largura;
  });
}
