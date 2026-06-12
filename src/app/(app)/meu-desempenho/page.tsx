import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tipoServicoLabel } from "@/lib/os-labels";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { getFiscalDesempenho } from "@/server/fiscal-service";
import { prismaFiscalRepository } from "@/server/prisma-fiscal-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

// Dashboard pessoal do fiscal: o progresso dele sobre as próprias tarefas —
// hoje e no mês, com o detalhamento mensal por tipo de serviço.
export default async function MeuDesempenhoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "desempenho:read")) redirect(defaultRedirect(user.perfil));

  const desempenho = await getFiscalDesempenho(prismaFiscalRepository, user, new Date());

  const cards = [
    { label: "Importadas (atribuidas)", value: desempenho.importadas },
    { label: "Na fila", value: desempenho.naFila },
    { label: "Concluidas hoje", value: desempenho.concluidasHoje },
    { label: "Concluidas no mes", value: desempenho.concluidasMes }
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Meu desempenho</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle>{card.label}</CardTitle>
              <p className="text-2xl font-semibold">{card.value}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Concluidas no mes por tipo de servico</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {desempenho.porTipo.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Nenhuma OS concluida neste mes.
            </p>
          ) : (
            desempenho.porTipo.map((linha) => (
              <div key={linha.tipoServico} className="flex items-center justify-between text-sm">
                <span>{tipoServicoLabel(linha.tipoServico)}</span>
                <span className="text-[hsl(var(--muted-foreground))]">{linha.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
