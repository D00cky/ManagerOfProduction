import type { Conceito, Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { buildOsScope, type SessionUserScope } from "@/lib/scope";

export type RelatorioOverall = { total: number; mediaPercentual: number };
export type ConceitoCount = { conceito: Conceito; count: number };
export type FiscalQualidade = { fiscalId: string; total: number; mediaPercentual: number };

export type RelatorioRepository = {
  overall(scope: Prisma.OrdemServicoWhereInput): Promise<RelatorioOverall>;
  countByConceito(scope: Prisma.OrdemServicoWhereInput): Promise<ConceitoCount[]>;
  mediaPorFiscal(scope: Prisma.OrdemServicoWhereInput): Promise<FiscalQualidade[]>;
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

  const scope = buildOsScope(user);
  const [overall, conceitoCounts, porFiscalRows] = await Promise.all([
    repository.overall(scope),
    repository.countByConceito(scope),
    repository.mediaPorFiscal(scope)
  ]);

  return {
    totalAvaliadas: overall.total,
    mediaPercentual: overall.mediaPercentual,
    conceitos: zeroFillConceitos(conceitoCounts),
    porFiscal: porFiscalRows
      .map((row) => ({ fiscalId: row.fiscalId, total: row.total, mediaPercentual: row.mediaPercentual }))
      .sort((a, b) => a.fiscalId.localeCompare(b.fiscalId))
  };
}

function zeroFillConceitos(counts: ConceitoCount[]): Record<Conceito, number> {
  const base = Object.fromEntries(conceitos.map((c) => [c, 0])) as Record<Conceito, number>;
  for (const row of counts) base[row.conceito] = row.count;
  return base;
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
