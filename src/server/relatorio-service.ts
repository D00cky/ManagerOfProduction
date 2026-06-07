import type { Conceito, Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { buildOsScope, type SessionUserScope } from "@/lib/scope";

export type RelatorioTabulacao = {
  conceito: Conceito;
  percentual: number;
  fiscalId: string;
};

export type RelatorioRepository = {
  findTabulacoes(scope: Prisma.OrdemServicoWhereInput): Promise<RelatorioTabulacao[]>;
};

export type RelatorioResumo = {
  totalAvaliadas: number;
  mediaPercentual: number;
  conceitos: Record<Conceito, number>;
  porFiscal: Array<{ fiscalId: string; total: number; mediaPercentual: number }>;
};

const conceitos: Conceito[] = ["A", "B", "C", "D", "NaoAvaliado"];

export async function getRelatorio(
  repository: RelatorioRepository,
  user: SessionUserScope
): Promise<RelatorioResumo> {
  if (!hasPermission(user.perfil, "relatorios:read")) {
    throw new Error("Sem permissao para ver relatorios");
  }

  const tabulacoes = await repository.findTabulacoes(buildOsScope(user));
  return {
    totalAvaliadas: tabulacoes.length,
    mediaPercentual: media(tabulacoes.map((t) => t.percentual)),
    conceitos: distribuicaoConceitos(tabulacoes),
    porFiscal: porFiscal(tabulacoes)
  };
}

function distribuicaoConceitos(tabulacoes: RelatorioTabulacao[]): Record<Conceito, number> {
  const base = Object.fromEntries(conceitos.map((c) => [c, 0])) as Record<Conceito, number>;
  for (const tabulacao of tabulacoes) {
    base[tabulacao.conceito] += 1;
  }
  return base;
}

function porFiscal(tabulacoes: RelatorioTabulacao[]): RelatorioResumo["porFiscal"] {
  const byFiscal = new Map<string, number[]>();
  for (const tabulacao of tabulacoes) {
    const list = byFiscal.get(tabulacao.fiscalId) ?? [];
    list.push(tabulacao.percentual);
    byFiscal.set(tabulacao.fiscalId, list);
  }

  return [...byFiscal.entries()]
    .map(([fiscalId, percentuais]) => ({
      fiscalId,
      total: percentuais.length,
      mediaPercentual: media(percentuais)
    }))
    .sort((a, b) => a.fiscalId.localeCompare(b.fiscalId));
}

function media(valores: number[]) {
  if (valores.length === 0) return 0;
  return valores.reduce((sum, value) => sum + value, 0) / valores.length;
}

export async function exportRelatorioCsv(repository: RelatorioRepository, user: SessionUserScope) {
  const relatorio = await getRelatorio(repository, user);
  const rows = [
    ["Fiscal", "Tabulacoes", "Media FFR"],
    ...relatorio.porFiscal.map((item) => [
      item.fiscalId,
      String(item.total),
      `${(item.mediaPercentual * 100).toFixed(2)}%`
    ])
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
