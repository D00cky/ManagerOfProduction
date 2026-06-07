import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { listEquipe } from "@/server/equipe-service";
import { prismaEquipeRepository } from "@/server/prisma-equipe-repository";
import { listPolos } from "@/server/polo-service";
import { prismaPoloRepository } from "@/server/prisma-polo-repository";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.perfil, "equipe:read")) redirect(defaultRedirect(user.perfil));

  const [membros, polos] = await Promise.all([
    listEquipe(prismaEquipeRepository, user),
    listPolos(prismaPoloRepository, user)
  ]);
  const poloNome = new Map(polos.map((polo) => [polo.id, polo.nome]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Equipe</h1>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[hsl(var(--border))] text-xs uppercase text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Matricula</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Polo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ultimo acesso</th>
            </tr>
          </thead>
          <tbody>
            {membros.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                  Nenhum membro na equipe.
                </td>
              </tr>
            ) : (
              membros.map((membro) => (
                <tr key={membro.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-3 font-medium">{membro.name}</td>
                  <td className="px-4 py-3">{membro.matricula}</td>
                  <td className="px-4 py-3 capitalize">{membro.perfil}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {membro.poloId ? poloNome.get(membro.poloId) ?? "-" : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={cn(
                        membro.status === "ativo"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {membro.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {membro.lastSeenAt ? membro.lastSeenAt.toLocaleString("pt-BR") : "Nunca"}
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
