import Link from "next/link";
import { redirect } from "next/navigation";
import { endOfMonth, startOfDay, startOfMonth, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GeoFilter } from "@/components/dashboard/geo-filter";
import { MesSelect } from "@/components/dashboard/mes-select";
import { ParadasPaginacao } from "@/components/dashboard/paradas-paginacao";
import { ESTADO } from "@/data/regioes-sp";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { cn, formatPercent } from "@/lib/utils";
import { getDashboardResumo } from "@/server/dashboard-service";
import { prismaDashboardRepository } from "@/server/prisma-dashboard-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatData(value: Date | null) {
  return value ? value.toLocaleDateString("pt-BR") : "—";
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{
    regiao?: string | string[];
    polo?: string | string[];
    municipio?: string | string[];
    page?: string | string[];
    from?: string | string[];
    to?: string | string[];
    mes?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "dashboard:read")) redirect(defaultRedirect(user.perfil));

  const params = await searchParams;
  const regiao = firstParam(params.regiao);
  const polo = firstParam(params.polo);
  const municipio = firstParam(params.municipio);
  const page = Math.max(1, Number(firstParam(params.page)) || 1);
  // O seletor mensal escolhe um mês importado (`mes=YYYY-MM`), que aqui vira a
  // janela from/to. Os atalhos Hoje/7 dias continuam usando `from` diretamente.
  const mesParam = firstParam(params.mes);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : undefined;
  const mesData = mes ? new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1) : undefined;
  const from = mesData ? startOfMonth(mesData) : parseDate(firstParam(params.from));
  const to = mesData ? endOfMonth(mesData) : parseDate(firstParam(params.to));
  const filtros = { regiao, polo, municipio, page, from, to };

  const now = new Date();
  const presets = [
    { label: "Hoje", from: undefined },
    { label: "7 dias", from: startOfDay(subDays(now, 6)) }
  ].map((preset) => {
    const search = new URLSearchParams();
    if (regiao) search.set("regiao", regiao);
    if (polo) search.set("polo", polo);
    if (municipio) search.set("municipio", municipio);
    if (preset.from) search.set("from", preset.from.toISOString());
    const href = search.toString() ? `/dashboard?${search.toString()}` : "/dashboard";
    // Um mês selecionado nunca marca Hoje/7 dias como ativo.
    const active =
      !mes && (preset.from?.toISOString() ?? undefined) === (from?.toISOString() ?? undefined);
    return { ...preset, href, active };
  });

  const resumo = await getDashboardResumo(prismaDashboardRepository, user, now, filtros);
  const { metricas, funnel } = resumo;
  const paradas = resumo.paradas;

  // Drill-in link from a backlog polo row: filter the dashboard to that
  // região + polo (which reveals the paginated OS list). Period is preserved.
  function paradaHref(regiaoDoPolo: string | null, poloId: string) {
    const search = new URLSearchParams();
    if (regiaoDoPolo) search.set("regiao", regiaoDoPolo);
    search.set("polo", poloId);
    if (mes) {
      search.set("mes", mes);
    } else {
      if (from) search.set("from", from.toISOString());
      if (to) search.set("to", to.toISOString());
    }
    return `/dashboard?${search.toString()}`;
  }

  const progressoFixo = [
    { titulo: "Progresso de hoje", dados: resumo.progressoHoje },
    { titulo: "Progresso do mes", dados: resumo.progressoMes }
  ];

  const funnelCards = [
    { label: "Entraram", value: funnel.entradas },
    { label: "Analisadas", value: funnel.analisadas },
    { label: "Concluidas", value: funnel.concluidas },
    { label: "Conclusao", value: formatPercent(funnel.percentualConclusao) },
    { label: "Fiscais ativos", value: resumo.fiscaisAtivos }
  ];

  const metricCards = [
    { label: "Total", value: metricas.total },
    { label: "Na fila", value: metricas.naFila },
    { label: "Em execucao", value: metricas.emExecucao },
    { label: "Pendentes", value: metricas.pendentes },
    { label: "Concluidas", value: metricas.concluidas },
    { label: "Conclusao", value: formatPercent(metricas.percentualConclusao) }
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <GeoFilter
        estado={ESTADO}
        opcoes={resumo.opcoesGeograficas}
        regiao={resumo.filtros.regiao}
        polo={resumo.filtros.polo}
        municipio={resumo.filtros.municipio}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {progressoFixo.map((bloco) => (
          <Card key={bloco.titulo}>
            <CardHeader>
              <CardTitle>{bloco.titulo}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs uppercase text-[hsl(var(--muted-foreground))]">Entraram</p>
                <p className="text-2xl font-semibold">{bloco.dados.entradas}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-[hsl(var(--muted-foreground))]">Analisadas</p>
                <p className="text-2xl font-semibold">{bloco.dados.analisadas}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-[hsl(var(--muted-foreground))]">Concluidas</p>
                <p className="text-2xl font-semibold">{bloco.dados.concluidas}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Periodo:</span>
          {presets.map((preset) => (
            <Link
              key={preset.label}
              href={preset.href}
              className={cn(
                "rounded-md border px-3 py-1 text-sm",
                preset.active
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "border-[hsl(var(--border))]"
              )}
            >
              {preset.label}
            </Link>
          ))}
          <MesSelect opcoes={resumo.mesesDisponiveis} selecionado={mes ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {funnelCards.map((card) => (
            <Card key={card.label}>
              <CardHeader>
                <CardTitle>{card.label}</CardTitle>
                <p className="text-2xl font-semibold">{card.value}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Entraram x Concluidas por regiao</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {resumo.porRegiao.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sem dados no periodo.</p>
          ) : (
            resumo.porRegiao.map((linha) => (
              <div key={linha.regiao ?? "sem-regiao"} className="flex items-center justify-between text-sm">
                <span>{linha.regiao ?? "Sem regiao"}</span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {linha.concluidas}/{linha.entradas}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por monitor → fiscal (periodo)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {resumo.arvoreDesempenho.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sem produção no periodo.</p>
          ) : (
            resumo.arvoreDesempenho.map((grupo) => (
              <div key={grupo.regiao ?? "sem-regiao"} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[hsl(var(--border))] pb-1">
                  <span className="text-sm font-semibold">{grupo.regiao ?? "Sem regiao"}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {grupo.monitores.length > 0
                      ? `Monitor: ${grupo.monitores.map((m) => `${m.name} (${m.matricula})`).join(", ")}`
                      : "Sem monitor"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 pl-3">
                  {grupo.fiscais.map((fiscal) => (
                    <div key={fiscal.fiscalId} className="flex items-center justify-between text-sm">
                      <span>
                        {fiscal.name}
                        {fiscal.matricula ? (
                          <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">
                            ({fiscal.matricula})
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {fiscal.concluidas} concl. · {fiscal.analisadas} anal.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">Situacao atual</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {metricCards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle>{card.label}</CardTitle>
              <p className="text-2xl font-semibold">{card.value}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Progresso por fiscal</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {resumo.progressoPorFiscal.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Sem dados.</p>
            ) : (
              resumo.progressoPorFiscal.map((item) => (
                <div key={item.fiscalId} className="flex items-center justify-between text-sm">
                  <span>
                    {item.name}
                    {item.matricula ? (
                      <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">({item.matricula})</span>
                    ) : null}
                  </span>
                  <span>
                    {item.concluidas}/{item.total} ({formatPercent(item.percentualConclusao)})
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {paradas.detalhe ? "OS paradas do polo (2+ dias)" : "OS paradas por polo (2+ dias)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {paradas.detalhe ? (
              paradas.detalhe.total === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma OS parada.</p>
              ) : (
                <>
                  {paradas.detalhe.rows.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        OS {item.numero}
                        <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">
                          Fim exec. {formatData(item.dataFimExecucao)}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-[hsl(var(--muted-foreground))]">
                        {item.diasParada} dias
                      </span>
                    </div>
                  ))}
                  <ParadasPaginacao
                    total={paradas.detalhe.total}
                    page={paradas.detalhe.page}
                    pageSize={paradas.detalhe.pageSize}
                  />
                </>
              )
            ) : paradas.porPolo.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma OS parada.</p>
            ) : (
              paradas.porPolo.map((linha) => (
                <Link
                  key={linha.poloId}
                  href={paradaHref(linha.regiao, linha.poloId)}
                  className="flex items-center justify-between gap-2 text-sm underline-offset-4 hover:underline"
                >
                  <span>
                    {linha.poloNome}
                    {linha.regiao ? (
                      <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">{linha.regiao}</span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap text-[hsl(var(--muted-foreground))]">
                    {linha.total} OS · até {linha.maxDias} dias
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
