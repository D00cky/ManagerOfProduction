import { redirect } from "next/navigation";
import { EquipeManager } from "@/components/equipe/equipe-manager";
import { defaultRedirect, hasPermission } from "@/lib/permissions";
import { allowedPoloIds } from "@/lib/scope";
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

  // Monitors may only assign within their own polos; supervisors get all polos.
  const allowed = allowedPoloIds(user);
  const poloOptions = (allowed ? polos.filter((polo) => allowed.includes(polo.id)) : polos).map(
    (polo) => ({ id: polo.id, nome: polo.nome })
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Equipe</h1>
      <EquipeManager
        membros={membros}
        polos={poloOptions}
        canEditPolo={hasPermission(user.perfil, "equipe:write")}
      />
    </div>
  );
}
