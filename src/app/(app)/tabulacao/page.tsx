import { redirect } from "next/navigation";
import { FiscalResumoCards } from "@/components/tabulacao/fiscal-resumo";
import { Card, CardContent } from "@/components/ui/card";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { getFiscalHome } from "@/server/fiscal-service";
import { prismaFiscalRepository } from "@/server/prisma-fiscal-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

// Fiscal landing: jump straight into the next OS to tabulate; if the backlog is
// empty, show their dashboard with an all-clear message.
export default async function TabulacaoIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "tabulacao:write")) redirect(defaultRedirect(user.perfil));

  const home = await getFiscalHome(prismaFiscalRepository, user);
  if (home.proximaOrdemId) redirect(`/tabulacao/${home.proximaOrdemId}`);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Minhas OS</h1>
      <FiscalResumoCards resumo={home.resumo} concluidasHoje={home.concluidasHoje} />
      <Card>
        <CardContent className="p-6 text-sm text-[hsl(var(--muted-foreground))]">
          Nenhuma OS pendente para tabular no momento. Bom trabalho!
        </CardContent>
      </Card>
    </div>
  );
}
