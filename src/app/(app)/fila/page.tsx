import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { listOrdens } from "@/server/os-service";
import { prismaOrdemRepository } from "@/server/prisma-os-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function FilaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "fila:read")) redirect(defaultRedirect(user.perfil));

  const ordens = await listOrdens(prismaOrdemRepository, user);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Fila de OS</h1>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Numero</th>
              <th className="px-4 py-3">Endereco</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fiscal</th>
              <th className="px-4 py-3">Programada</th>
            </tr>
          </thead>
          <tbody>
            {ordens.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                  Nenhuma OS na fila.
                </td>
              </tr>
            ) : (
              ordens.map((ordem) => (
                <tr key={ordem.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">{ordem.numero}</td>
                  <td className="px-4 py-3">
                    {ordem.enderecoCompleto}
                    {ordem.bairro ? `, ${ordem.bairro}` : ""}
                  </td>
                  <td className="px-4 py-3">{ordem.tipoServico}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ordem.status} />
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {ordem.fiscalId ? "Atribuida" : "Sem fiscal"}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {ordem.dataProgramada ? ordem.dataProgramada.toLocaleDateString("pt-BR") : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
