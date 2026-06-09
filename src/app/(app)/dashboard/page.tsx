import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GeoFilter } from "@/components/dashboard/geo-filter";
import { ESTADO } from "@/data/regioes-sp";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { formatPercent } from "@/lib/utils";
import { getDashboardResumo } from "@/server/dashboard-service";
import { prismaDashboardRepository } from "@/server/prisma-dashboard-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ regiao?: string | string[]; municipio?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "dashboard:read")) redirect(defaultRedirect(user.perfil));

  const params = await searchParams;
  const filtros = { regiao: firstParam(params.regiao), municipio: firstParam(params.municipio) };

  const resumo = await getDashboardResumo(prismaDashboardRepository, user, new Date(), filtros);
  const { metricas } = resumo;

  const metricCards = [
    { label: "Total", value: metricas.total },
    { label: "Na fila", value: metricas.naFila },
    { label: "Em execucao", value: metricas.emExecucao },
    { label: "Pendentes", value: metricas.pendentes },
    { label: "Concluidas", value: metricas.concluidas },
    { label: "Conclusao", value: formatPercent(metricas.percentualConclusao) }
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <GeoFilter
        estado={ESTADO}
        opcoes={resumo.opcoesGeograficas}
        regiao={resumo.filtros.regiao}
        municipio={resumo.filtros.municipio}
      />

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
            <CardTitle>OS paradas (2+ dias)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {resumo.osParadas.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma OS parada.</p>
            ) : (
              resumo.osParadas.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span>OS {item.numero}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{item.diasParada} dias</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividades recentes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {resumo.atividades.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sem atividades.</p>
          ) : (
            resumo.atividades.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <span>{log.descricao}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {log.createdAt.toLocaleString("pt-BR")}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
