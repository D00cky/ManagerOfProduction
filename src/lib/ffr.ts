import type { Conceito } from "@prisma/client";
import { gruposParaOrdem, type OrdemFfrContext, type ValorResposta } from "@/data/grupos-ffr";

export type RespostasFfr = Record<string, ValorResposta>;

export type ResultadoFfr = {
  somaObtida: number;
  somaPossivel: number;
  percentual: number;
  conceito: Conceito;
};

export function calcularConceito(ctx: OrdemFfrContext, respostas: RespostasFfr): ResultadoFfr {
  let somaObtida = 0;
  let somaPossivel = 0;

  for (const grupo of gruposParaOrdem(ctx)) {
    for (const item of grupo.itens) {
      const resposta = respostas[item.id];
      if (item.peso <= 0 || item.tipo === "texto" || resposta === "X" || resposta === null || resposta === undefined) {
        continue;
      }
      if (resposta === "1") {
        somaObtida += item.peso;
        somaPossivel += item.peso;
      } else if (resposta === "0") {
        somaPossivel += item.peso;
      }
    }
  }

  const percentual = somaPossivel > 0 ? somaObtida / somaPossivel : 0;
  return {
    somaObtida,
    somaPossivel,
    percentual,
    conceito: conceitoPorPercentual(percentual, somaPossivel)
  };
}

export function conceitoPorPercentual(percentual: number, somaPossivel: number): Conceito {
  if (somaPossivel <= 0) return "NaoAvaliado";
  if (percentual >= 0.9) return "A";
  if (percentual >= 0.75) return "B";
  if (percentual >= 0.6) return "C";
  return "D";
}

export type ContagemConformidade = { conforme: number; naoConforme: number };

/**
 * Conta, sem ponderar pelos pesos, quantos itens avaliáveis ficaram "Conforme" ("1")
 * e quantos "Não conforme" ("0"). Usa a mesma regra de exclusão do cálculo FFR
 * (itens informativos/texto, peso <= 0, "X" e respostas vazias ficam de fora), porém
 * conta itens em vez de somar pesos. É a base do indicador IQES.
 */
export function contarConformidade(ctx: OrdemFfrContext, respostas: RespostasFfr): ContagemConformidade {
  let conforme = 0;
  let naoConforme = 0;

  for (const grupo of gruposParaOrdem(ctx)) {
    for (const item of grupo.itens) {
      const resposta = respostas[item.id];
      if (item.peso <= 0 || item.tipo === "texto" || resposta === "X" || resposta === null || resposta === undefined) {
        continue;
      }
      if (resposta === "1") conforme += 1;
      else if (resposta === "0") naoConforme += 1;
    }
  }

  return { conforme, naoConforme };
}

/**
 * IQES como razão 0–1 (Conforme / (Conforme + Não conforme)). Retorna 0 quando não há
 * itens avaliados, para combinar com `formatPercent`.
 */
export function iqesPercentual(contagem: ContagemConformidade): number {
  const total = contagem.conforme + contagem.naoConforme;
  return total > 0 ? contagem.conforme / total : 0;
}
