import { redirect } from "next/navigation";
import { ConfiguracoesForm } from "@/components/configuracoes/configuracoes-form";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { getConfiguracao } from "@/server/configuracao-service";
import { prismaConfiguracaoRepository } from "@/server/prisma-configuracao-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "configuracoes:write")) redirect(defaultRedirect(user.perfil));

  const configuracao = await getConfiguracao(prismaConfiguracaoRepository, user);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Configuracoes</h1>
      <ConfiguracoesForm configuracao={configuracao} />
    </div>
  );
}
