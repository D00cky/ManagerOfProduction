import type { Conceito } from "@prisma/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GeoFilter } from "@/components/dashboard/geo-filter";
import { MesSelect } from "@/components/dashboard/mes-select";
import { RelatorioExportCard } from "@/components/relatorios/relatorio-export-card";
import { Label } from "@/components/ui/label";
import { ESTADO } from "@/data/regioes-sp";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { formatPercent } from "@/lib/utils";
import { getMesesRelatorio, getRelatorio, mesParaIntervalo, type NivelDesempenho } from "@/server/relatorio-service";
import { prismaRelatorioRepository } from "@/server/prisma-relatorio-repository";
import { getOpcoesGeograficas } from "@/server/dashboard-service";
import { prismaDashboardRepository } from "@/server/prisma-dashboard-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

const conceitoLabels: Record<Conceito, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  NaoAvaliado: "Nao avaliado"
};

function firstParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function RelatoriosPage({
  searchParams
}: {
  searchParams: Promise<{
    regiao?: string | string[];
    polo?: string | string[];
    municipio?: string | string[];
    mes?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "relatorios:read")) redirect(defaultRedirect(user.perfil));

  const params = await searchParams;
  const mes = firstParam(params.mes);
  const { from, to } = mesParaIntervalo(mes);
  const filtros = {
    regiao: firstParam(params.regiao),
    polo: firstParam(params.polo),
    municipio: firstParam(params.municipio),
    from,
    to
  };

  const [relatorio, opcoesGeograficas, mesesDisponiveis] = await Promise.all([
    getRelatorio(prismaRelatorioRepository, user, filtros),
    getOpcoesGeograficas(prismaDashboardRepository, user),
    getMesesRelatorio(prismaRelatorioRepository, user)
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Relatorios</h1>

      <GeoFilter
        estado={ESTADO}
        opcoes={opcoesGeograficas}
        regiao={filtros.regiao}
        polo={filtros.polo}
        municipio={filtros.municipio}
      />

      <RelatorioExportCard />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mes">Mes (fim de execucao)</Label>
          <MesSelect opcoes={mesesDisponiveis} selecionado={mes ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
        <Card>
          <CardHeader>
            <CardTitle>Tabulacoes</CardTitle>
            <p className="text-2xl font-semibold">{relatorio.totalAvaliadas}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Media FFR</CardTitle>
            <p className="text-2xl font-semibold">{formatPercent(relatorio.mediaPercentual)}</p>
          </CardHeader>
        </Card>
        {(Object.keys(relatorio.conceitos) as Conceito[]).map((conceito) => (
          <Card key={conceito}>
            <CardHeader>
              <CardTitle>{conceitoLabels[conceito]}</CardTitle>
              <p className="text-2xl font-semibold">{relatorio.conceitos[conceito]}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Qualidade por fiscal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">Fiscal</th>
                <th className="px-4 py-3">Tabulacoes</th>
                <th className="px-4 py-3">Media FFR</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.porFiscal.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    Sem tabulacoes no periodo.
                  </td>
                </tr>
              ) : (
                relatorio.porFiscal.map((item) => (
                  <tr key={item.fiscalId} className="border-b border-[hsl(var(--border))] last:border-0">
                    <td className="px-4 py-3">
                      {item.name}
                      {item.matricula ? (
                        <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">
                          ({item.matricula})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{item.total}</td>
                    <td className="px-4 py-3">{formatPercent(item.mediaPercentual)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <BreakdownTable title="Desempenho por regiao" nameHeader="Regiao" rows={relatorio.porRegiao} />

      <BreakdownTable title="Desempenho por polo" nameHeader="Polo" rows={relatorio.porPolo} />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Desempenho por contratada (Regiao &rarr; Polo &rarr; Contratada)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {relatorio.arvore.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sem tabulacoes no periodo.</p>
          ) : (
            relatorio.arvore.map((regiao) => (
              <div key={regiao.chave} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[hsl(var(--border))] pb-1">
                  <span className="text-sm font-semibold">{regiao.nome}</span>
                  <NivelResumo nivel={regiao} />
                </div>
                {regiao.polos.map((polo) => (
                  <div key={polo.chave} className="flex flex-col gap-1 pl-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{polo.nome}</span>
                      <NivelResumo nivel={polo} />
                    </div>
                    <div className="flex flex-col gap-1 pl-3">
                      {polo.contratadas.map((contratada) => (
                        <div
                          key={contratada.chave}
                          className="flex items-center justify-between text-sm text-[hsl(var(--muted-foreground))]"
                        >
                          <span>{contratada.nome}</span>
                          <NivelResumo nivel={contratada} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NivelResumo({ nivel }: { nivel: NivelDesempenho }) {
  return (
    <span className="whitespace-nowrap text-xs text-[hsl(var(--muted-foreground))]">
      {nivel.total} tab. &middot; FFR {formatPercent(nivel.mediaPercentual)} &middot; IQES {formatPercent(nivel.iqes)}
    </span>
  );
}

function BreakdownTable({
  title,
  nameHeader,
  rows
}: {
  title: string;
  nameHeader: string;
  rows: NivelDesempenho[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-y border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">{nameHeader}</th>
              <th className="px-4 py-3">Tabulacoes</th>
              <th className="px-4 py-3">Media FFR</th>
              <th className="px-4 py-3">IQES</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                  Sem tabulacoes no periodo.
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.chave} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3">{item.nome}</td>
                  <td className="px-4 py-3">{item.total}</td>
                  <td className="px-4 py-3">{formatPercent(item.mediaPercentual)}</td>
                  <td className="px-4 py-3">{formatPercent(item.iqes)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
